import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processEvent, approveAction, rejectAction, simulateJobCompleted } from "./orchestrator";
import { twilioConnector } from "./connectors/twilio-mock";
import {
  insertBusinessProfileSchema,
  insertMessageSchema,
  insertJobSchema,
  insertPolicyProfileSchema,
  PolicyTiers,
} from "@shared/schema";
import { PolicyService } from "./policy";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============================================
  // Metrics API Route
  // ============================================

  app.get("/api/metrics", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      const jobs = await storage.getJobs();
      const leads = await storage.getLeads();
      const pendingActions = await storage.getPendingActions();

      // Calculate ROI metrics
      const leadsRecovered = conversations.filter(
        (c) => c.source === "missed_call" && c.status !== "lost"
      ).length;

      const jobsBooked = jobs.filter(
        (j) => j.status === "scheduled" || j.status === "completed"
      ).length;

      const completedJobs = jobs.filter((j) => j.status === "completed").length;

      // Estimate hours saved: 5 min per missed call response, 15 min per lead qualification, 10 min per scheduling
      const hoursFromCalls = (conversations.filter((c) => c.source === "missed_call").length * 5) / 60;
      const hoursFromQualification = (leads.length * 15) / 60;
      const hoursFromScheduling = (jobsBooked * 10) / 60;
      const hoursSaved = Math.round((hoursFromCalls + hoursFromQualification + hoursFromScheduling) * 10) / 10;

      // Revenue from completed jobs
      const totalRevenue = jobs
        .filter((j) => j.status === "completed")
        .reduce((sum, job) => sum + (job.estimatedPrice || 0), 0);

      // Conversion rate
      const conversionRate = conversations.length > 0
        ? Math.round((jobsBooked / conversations.length) * 100)
        : 0;

      // Active conversations
      const activeConversations = conversations.filter((c) => c.status === "active").length;
      const pendingApprovals = pendingActions.filter((a) => a.status === "pending").length;

      res.json({
        leadsRecovered,
        jobsBooked,
        completedJobs,
        hoursSaved,
        totalRevenue,
        conversionRate,
        activeConversations,
        pendingApprovals,
        totalConversations: conversations.length,
        totalLeads: leads.length,
      });
    } catch (error) {
      console.error("Error calculating metrics:", error);
      res.status(500).json({ error: "Failed to calculate metrics" });
    }
  });

  // ============================================
  // Seed Data Route (for development)
  // ============================================

  app.post("/api/seed", async (req, res) => {
    try {
      // Check if business profile already exists
      let profile = await storage.getBusinessProfile();
      
      if (!profile) {
        // Create Green Ridge Lawn Care business profile
        profile = await storage.createBusinessProfile({
          name: "Green Ridge Lawn Care",
          phone: "+14345551234",
          email: "info@greenridgelawncare.com",
          address: "123 Main St, Charlottesville, VA 22901",
          serviceArea: "Charlottesville + 20 miles",
          services: ["mowing", "cleanup", "mulch"],
          businessHours: "Mon-Fri 8AM-5PM",
          autoResponseEnabled: true,
        });

        // Create policy profile with owner_operator tier
        await PolicyService.createDefaultPolicy(profile.id, "owner_operator");

        // Update policy with Charlottesville zip codes
        const policyProfile = await storage.getPolicyProfile(profile.id);
        if (policyProfile) {
          await storage.updatePolicyProfile(policyProfile.id, {
            serviceAreaZips: ["22901", "22902", "22903", "22904", "22905", "22906", "22908", "22909", "22911"],
            serviceAreaRadius: 20,
            pricingRules: {
              services: {
                mowing: { basePrice: 4500, unit: "visit" }, // $45/visit
                cleanup: { minPrice: 25000, unit: "job" }, // min $250
                mulch: { minPrice: 30000, unit: "job" }, // min $300
              },
            },
          });
        }

        res.json({ 
          success: true, 
          message: "Seed data created successfully",
          profile,
        });
      } else {
        res.json({ 
          success: true, 
          message: "Seed data already exists",
          profile,
        });
      }
    } catch (error) {
      console.error("Error creating seed data:", error);
      res.status(500).json({ error: "Failed to create seed data" });
    }
  });

  // ============================================
  // Onboarding API Routes
  // ============================================

  // Get onboarding state (creates default profile if none exists)
  app.get("/api/onboarding", async (req, res) => {
    try {
      let profile = await storage.getBusinessProfile();
      
      if (!profile) {
        // Create a minimal profile for onboarding
        profile = await storage.createBusinessProfile({
          name: "",
          phone: "",
          email: "",
          onboardingStep: "welcome",
          isOnboardingComplete: false,
        });
      }
      
      res.json({
        id: profile.id,
        onboardingRoute: profile.onboardingRoute,
        onboardingStep: profile.onboardingStep || "welcome",
        isOnboardingComplete: profile.isOnboardingComplete || false,
        businessBasics: {
          businessName: profile.name,
          ownerName: profile.ownerName,
          email: profile.email,
          phone: profile.phone,
          address: profile.address,
        },
        serviceArea: {
          centerLat: profile.serviceAreaCenterLat,
          centerLng: profile.serviceAreaCenterLng,
          radiusMi: profile.serviceAreaRadiusMi,
          maxMi: profile.serviceAreaMaxMi,
          allowExtended: profile.serviceAreaAllowExtended,
        },
        integration: {
          fsmProvider: profile.fsmProvider,
          fsmConnected: profile.fsmConnected,
          fsmProviderOther: profile.fsmProviderOther,
        },
        communication: {
          phoneProvider: profile.phoneProvider,
          twilioAreaCode: profile.twilioAreaCode,
          textingEnabled: profile.textingEnabled,
        },
        services: {
          serviceTypes: profile.serviceTypes || profile.services,
          typicalResponseTime: profile.typicalResponseTime,
          weeklyCapacity: profile.weeklyCapacity,
        },
        pricing: {
          pricingModel: profile.pricingModel,
          mowingMinPrice: profile.mowingMinPrice,
          cleanupMinPrice: profile.cleanupMinPrice,
          mulchMinPrice: profile.mulchMinPrice,
        },
        automation: {
          missedCallRecoveryEnabled: profile.missedCallRecoveryEnabled,
          autoTextEnabled: profile.autoTextEnabled,
          autoQuoteEnabled: profile.autoQuoteEnabled,
          approvalsRequiredForBooking: profile.approvalsRequiredForBooking,
        },
        standalone: {
          trackCustomersEnabled: profile.trackCustomersEnabled,
          trackJobsEnabled: profile.trackJobsEnabled,
        },
        onboardingNotes: profile.onboardingNotes,
      });
    } catch (error) {
      console.error("Error fetching onboarding state:", error);
      res.status(500).json({ error: "Failed to fetch onboarding state" });
    }
  });

  // Save onboarding progress (partial updates)
  app.post("/api/onboarding", async (req, res) => {
    try {
      let profile = await storage.getBusinessProfile();
      
      if (!profile) {
        // Create profile if it doesn't exist
        profile = await storage.createBusinessProfile({
          name: req.body.businessBasics?.businessName || "",
          phone: req.body.businessBasics?.phone || "",
          email: req.body.businessBasics?.email || "",
          onboardingStep: req.body.onboardingStep || "welcome",
          isOnboardingComplete: false,
        });
      }
      
      // Build update object from request
      const updates: Record<string, any> = {};
      
      // Step tracking
      if (req.body.onboardingStep) {
        updates.onboardingStep = req.body.onboardingStep;
      }
      if (req.body.onboardingRoute) {
        updates.onboardingRoute = req.body.onboardingRoute;
      }
      
      // Business basics
      if (req.body.businessBasics) {
        const bb = req.body.businessBasics;
        if (bb.businessName !== undefined) updates.name = bb.businessName;
        if (bb.ownerName !== undefined) updates.ownerName = bb.ownerName;
        if (bb.email !== undefined) updates.email = bb.email;
        if (bb.phone !== undefined) updates.phone = bb.phone;
        if (bb.address !== undefined) updates.address = bb.address;
      }
      
      // Service area
      if (req.body.serviceArea) {
        const sa = req.body.serviceArea;
        if (sa.centerLat !== undefined) updates.serviceAreaCenterLat = sa.centerLat;
        if (sa.centerLng !== undefined) updates.serviceAreaCenterLng = sa.centerLng;
        if (sa.radiusMi !== undefined) updates.serviceAreaRadiusMi = sa.radiusMi;
        if (sa.maxMi !== undefined) updates.serviceAreaMaxMi = sa.maxMi;
        if (sa.allowExtended !== undefined) updates.serviceAreaAllowExtended = sa.allowExtended;
      }
      
      // Integration
      if (req.body.integration) {
        const int = req.body.integration;
        if (int.fsmProvider !== undefined) updates.fsmProvider = int.fsmProvider;
        if (int.fsmConnected !== undefined) updates.fsmConnected = int.fsmConnected;
        if (int.fsmProviderOther !== undefined) updates.fsmProviderOther = int.fsmProviderOther;
      }
      
      // Communication
      if (req.body.communication) {
        const comm = req.body.communication;
        if (comm.phoneProvider !== undefined) updates.phoneProvider = comm.phoneProvider;
        if (comm.twilioAreaCode !== undefined) updates.twilioAreaCode = comm.twilioAreaCode;
        if (comm.textingEnabled !== undefined) updates.textingEnabled = comm.textingEnabled;
      }
      
      // Services
      if (req.body.services) {
        const svc = req.body.services;
        if (svc.serviceTypes !== undefined) {
          updates.serviceTypes = svc.serviceTypes;
          updates.services = svc.serviceTypes; // Also update legacy field
        }
        if (svc.typicalResponseTime !== undefined) updates.typicalResponseTime = svc.typicalResponseTime;
        if (svc.weeklyCapacity !== undefined) updates.weeklyCapacity = svc.weeklyCapacity;
      }
      
      // Pricing
      if (req.body.pricing) {
        const price = req.body.pricing;
        if (price.pricingModel !== undefined) updates.pricingModel = price.pricingModel;
        if (price.mowingMinPrice !== undefined) updates.mowingMinPrice = price.mowingMinPrice;
        if (price.cleanupMinPrice !== undefined) updates.cleanupMinPrice = price.cleanupMinPrice;
        if (price.mulchMinPrice !== undefined) updates.mulchMinPrice = price.mulchMinPrice;
      }
      
      // Automation
      if (req.body.automation) {
        const auto = req.body.automation;
        if (auto.missedCallRecoveryEnabled !== undefined) updates.missedCallRecoveryEnabled = auto.missedCallRecoveryEnabled;
        if (auto.autoTextEnabled !== undefined) updates.autoTextEnabled = auto.autoTextEnabled;
        if (auto.autoQuoteEnabled !== undefined) updates.autoQuoteEnabled = auto.autoQuoteEnabled;
        if (auto.approvalsRequiredForBooking !== undefined) updates.approvalsRequiredForBooking = auto.approvalsRequiredForBooking;
      }
      
      // Standalone CRM
      if (req.body.standalone) {
        const sa = req.body.standalone;
        if (sa.trackCustomersEnabled !== undefined) updates.trackCustomersEnabled = sa.trackCustomersEnabled;
        if (sa.trackJobsEnabled !== undefined) updates.trackJobsEnabled = sa.trackJobsEnabled;
      }
      
      // Notes
      if (req.body.onboardingNotes !== undefined) {
        updates.onboardingNotes = req.body.onboardingNotes;
      }
      
      const updatedProfile = await storage.updateBusinessProfile(profile.id, updates);
      
      res.json({
        success: true,
        id: updatedProfile.id,
        onboardingStep: updatedProfile.onboardingStep,
      });
    } catch (error) {
      console.error("Error saving onboarding progress:", error);
      res.status(500).json({ error: "Failed to save onboarding progress" });
    }
  });

  // Complete onboarding
  app.post("/api/onboarding/complete", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "No profile found to complete" });
      }
      
      // Validate required fields
      if (!profile.name || !profile.phone || !profile.email) {
        return res.status(400).json({ 
          error: "Missing required fields: business name, phone, and email are required" 
        });
      }
      
      if (!profile.serviceAreaCenterLat || !profile.serviceAreaCenterLng || !profile.serviceAreaRadiusMi) {
        return res.status(400).json({ 
          error: "Missing required fields: service area must be configured" 
        });
      }
      
      if (!profile.serviceTypes?.length && !profile.services?.length) {
        return res.status(400).json({ 
          error: "Missing required fields: at least one service type must be selected" 
        });
      }
      
      // Mark onboarding as complete
      const updatedProfile = await storage.updateBusinessProfile(profile.id, {
        isOnboardingComplete: true,
        onboardingStep: "complete",
      });
      
      // Create policy profile if doesn't exist
      let policyProfile = await storage.getPolicyProfile(profile.id);
      if (!policyProfile) {
        await PolicyService.createDefaultPolicy(profile.id, "owner_operator");
        
        // Update policy with automation preferences
        policyProfile = await storage.getPolicyProfile(profile.id);
        if (policyProfile) {
          await storage.updatePolicyProfile(policyProfile.id, {
            autoSendMessages: profile.autoTextEnabled ?? true,
            autoSendQuotes: profile.autoQuoteEnabled ?? false,
            autoBookJobs: !(profile.approvalsRequiredForBooking ?? true),
            serviceAreaRadius: profile.serviceAreaRadiusMi,
          });
        }
      }
      
      res.json({
        success: true,
        message: "Onboarding completed successfully",
        profile: updatedProfile,
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // ============================================
  // Business Profile Routes
  // ============================================

  app.get("/api/business-profile", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching business profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/business-profile", async (req, res) => {
    try {
      const parsed = insertBusinessProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      // Validate service area configuration
      const { validateServiceAreaConfig, VALID_MAX_DISTANCES } = await import("./utils/service-area.js");
      const serviceAreaValidation = validateServiceAreaConfig({
        radiusMi: parsed.data.serviceAreaRadiusMi,
        maxMi: parsed.data.serviceAreaMaxMi,
        centerLat: parsed.data.serviceAreaCenterLat,
        centerLng: parsed.data.serviceAreaCenterLng,
      });
      
      if (!serviceAreaValidation.valid) {
        return res.status(400).json({ error: serviceAreaValidation.error });
      }
      
      // Clamp radius if necessary
      const profileData = { ...parsed.data };
      if (serviceAreaValidation.clampedRadiusMi !== undefined) {
        profileData.serviceAreaRadiusMi = serviceAreaValidation.clampedRadiusMi;
      }
      
      const profile = await storage.createBusinessProfile(profileData);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating business profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.patch("/api/business-profile/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Validate update data - only allow specific fields to be updated
      const updateSchema = insertBusinessProfileSchema.partial().omit({});
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      // Validate service area configuration if any fields are being updated
      const { validateServiceAreaConfig } = await import("./utils/service-area.js");
      
      // Get existing profile to merge with updates for validation
      const existingProfile = await storage.getBusinessProfile(id);
      const mergedConfig = {
        radiusMi: parsed.data.serviceAreaRadiusMi ?? existingProfile?.serviceAreaRadiusMi,
        maxMi: parsed.data.serviceAreaMaxMi ?? existingProfile?.serviceAreaMaxMi,
        centerLat: parsed.data.serviceAreaCenterLat ?? existingProfile?.serviceAreaCenterLat,
        centerLng: parsed.data.serviceAreaCenterLng ?? existingProfile?.serviceAreaCenterLng,
      };
      
      const serviceAreaValidation = validateServiceAreaConfig(mergedConfig);
      
      if (!serviceAreaValidation.valid) {
        return res.status(400).json({ error: serviceAreaValidation.error });
      }
      
      // Clamp radius if necessary
      const updateData = { ...parsed.data };
      if (serviceAreaValidation.clampedRadiusMi !== undefined) {
        updateData.serviceAreaRadiusMi = serviceAreaValidation.clampedRadiusMi;
      }
      
      const profile = await storage.updateBusinessProfile(id, updateData);
      res.json(profile);
    } catch (error) {
      console.error("Error updating business profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ============================================
  // Onboarding Routes
  // ============================================

  app.get("/api/onboarding", async (req, res) => {
    try {
      let profile = await storage.getBusinessProfile();
      
      // Create a default profile if none exists
      if (!profile) {
        profile = await storage.createBusinessProfile({
          name: "",
          phone: "",
          email: "",
          onboardingStep: "welcome",
          isOnboardingComplete: false,
        });
      }

      // Return onboarding state
      res.json({
        id: profile.id,
        onboardingRoute: profile.onboardingRoute,
        onboardingStep: profile.onboardingStep || "welcome",
        isOnboardingComplete: profile.isOnboardingComplete || false,
        businessBasics: {
          businessName: profile.name || "",
          ownerName: profile.ownerName || null,
          email: profile.email || "",
          phone: profile.phone || "",
          address: profile.address || null,
        },
        serviceArea: {
          centerLat: profile.serviceAreaCenterLat,
          centerLng: profile.serviceAreaCenterLng,
          radiusMi: profile.serviceAreaRadiusMi,
          maxMi: profile.serviceAreaMaxMi,
          allowExtended: profile.serviceAreaAllowExtended,
        },
        integration: {
          fsmProvider: profile.fsmProvider,
          fsmConnected: profile.fsmConnected,
          fsmProviderOther: profile.fsmProviderOther,
        },
        communication: {
          phoneProvider: profile.phoneProvider,
          twilioAreaCode: profile.twilioAreaCode,
          textingEnabled: profile.textingEnabled,
        },
        services: {
          serviceTypes: profile.serviceTypes,
          typicalResponseTime: profile.typicalResponseTime,
          weeklyCapacity: profile.weeklyCapacity,
        },
        pricing: {
          pricingModel: profile.pricingModel,
          mowingMinPrice: profile.mowingMinPrice,
          cleanupMinPrice: profile.cleanupMinPrice,
          mulchMinPrice: profile.mulchMinPrice,
        },
        automation: {
          missedCallRecoveryEnabled: profile.missedCallRecoveryEnabled,
          autoTextEnabled: profile.autoTextEnabled,
          autoQuoteEnabled: profile.autoQuoteEnabled,
          approvalsRequiredForBooking: profile.approvalsRequiredForBooking,
        },
        standalone: {
          trackCustomersEnabled: profile.trackCustomersEnabled,
          trackJobsEnabled: profile.trackJobsEnabled,
        },
      });
    } catch (error) {
      console.error("Error fetching onboarding state:", error);
      res.status(500).json({ error: "Failed to fetch onboarding state" });
    }
  });

  app.post("/api/onboarding", async (req, res) => {
    try {
      const data = req.body;
      let profile = await storage.getBusinessProfile();

      const updateData: any = {
        onboardingStep: data.onboardingStep,
        onboardingRoute: data.onboardingRoute,
      };

      // Map business basics
      if (data.businessBasics) {
        updateData.name = data.businessBasics.businessName || "";
        updateData.ownerName = data.businessBasics.ownerName || null;
        updateData.email = data.businessBasics.email || "";
        updateData.phone = data.businessBasics.phone || "";
        updateData.address = data.businessBasics.address || null;
      }

      // Map service area
      if (data.serviceArea) {
        updateData.serviceAreaCenterLat = data.serviceArea.centerLat;
        updateData.serviceAreaCenterLng = data.serviceArea.centerLng;
        updateData.serviceAreaRadiusMi = data.serviceArea.radiusMi;
        updateData.serviceAreaMaxMi = data.serviceArea.maxMi;
        updateData.serviceAreaAllowExtended = data.serviceArea.allowExtended;
      }

      // Map integration
      if (data.integration) {
        updateData.fsmProvider = data.integration.fsmProvider;
        updateData.fsmConnected = data.integration.fsmConnected;
        updateData.fsmProviderOther = data.integration.fsmProviderOther;
      }

      // Map communication
      if (data.communication) {
        updateData.phoneProvider = data.communication.phoneProvider;
        updateData.twilioAreaCode = data.communication.twilioAreaCode;
        updateData.textingEnabled = data.communication.textingEnabled;
      }

      // Map services
      if (data.services) {
        updateData.serviceTypes = data.services.serviceTypes;
        updateData.typicalResponseTime = data.services.typicalResponseTime;
        updateData.weeklyCapacity = data.services.weeklyCapacity;
      }

      // Map pricing
      if (data.pricing) {
        updateData.pricingModel = data.pricing.pricingModel;
        updateData.mowingMinPrice = data.pricing.mowingMinPrice;
        updateData.cleanupMinPrice = data.pricing.cleanupMinPrice;
        updateData.mulchMinPrice = data.pricing.mulchMinPrice;
      }

      // Map automation
      if (data.automation) {
        updateData.missedCallRecoveryEnabled = data.automation.missedCallRecoveryEnabled;
        updateData.autoTextEnabled = data.automation.autoTextEnabled;
        updateData.autoQuoteEnabled = data.automation.autoQuoteEnabled;
        updateData.approvalsRequiredForBooking = data.automation.approvalsRequiredForBooking;
      }

      // Map standalone
      if (data.standalone) {
        updateData.trackCustomersEnabled = data.standalone.trackCustomersEnabled;
        updateData.trackJobsEnabled = data.standalone.trackJobsEnabled;
      }

      if (profile) {
        profile = await storage.updateBusinessProfile(profile.id, updateData);
      } else {
        profile = await storage.createBusinessProfile({
          name: updateData.name || "",
          phone: updateData.phone || "",
          email: updateData.email || "",
          ...updateData,
        });
      }

      res.json({ success: true, profile });
    } catch (error) {
      console.error("Error saving onboarding state:", error);
      res.status(500).json({ error: "Failed to save onboarding state" });
    }
  });

  app.post("/api/onboarding/complete", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();

      if (!profile) {
        return res.status(400).json({ error: "No business profile found" });
      }

      // Validate required fields
      const errors: string[] = [];

      if (!profile.name) {
        errors.push("Business name is required");
      }
      if (!profile.email) {
        errors.push("Email is required");
      }
      if (!profile.phone) {
        errors.push("Phone number is required");
      }
      if (!profile.serviceAreaCenterLat || !profile.serviceAreaRadiusMi) {
        errors.push("Service area is required");
      }
      if (!profile.serviceTypes || profile.serviceTypes.length === 0) {
        errors.push("At least one service type is required");
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(", ") });
      }

      // Mark onboarding complete
      await storage.updateBusinessProfile(profile.id, {
        isOnboardingComplete: true,
        onboardingStep: "review",
      });

      // Create or update policy profile based on automation preferences
      let tier: "owner_operator" | "smb" | "commercial" = "owner_operator";
      if (profile.autoQuoteEnabled && !profile.approvalsRequiredForBooking) {
        tier = "commercial";
      } else if (profile.autoQuoteEnabled) {
        tier = "smb";
      }

      // Check if policy exists
      const existingPolicy = await storage.getPolicyProfile(profile.id);
      if (!existingPolicy) {
        await PolicyService.createDefaultPolicy(profile.id, tier);
      } else {
        await storage.updatePolicyProfile(existingPolicy.id, { tier });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // ============================================
  // Conversation Routes
  // ============================================

  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const messages = await storage.getMessagesByConversation(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, role } = req.body;

      const message = await storage.createMessage({
        conversationId,
        role: role || "ai",
        content,
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // ============================================
  // Pending Actions Routes
  // ============================================

  app.get("/api/pending-actions", async (req, res) => {
    try {
      const actions = await storage.getPendingActions();
      res.json(actions);
    } catch (error) {
      console.error("Error fetching pending actions:", error);
      res.status(500).json({ error: "Failed to fetch pending actions" });
    }
  });

  app.post("/api/pending-actions/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const result = await approveAction(id, notes);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      res.json(result);
    } catch (error) {
      console.error("Error approving action:", error);
      res.status(500).json({ error: "Failed to approve action" });
    }
  });

  app.post("/api/pending-actions/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const result = await rejectAction(id, notes);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      res.json(result);
    } catch (error) {
      console.error("Error rejecting action:", error);
      res.status(500).json({ error: "Failed to reject action" });
    }
  });

  // ============================================
  // Jobs Routes
  // ============================================

  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Validate update data
      const updateSchema = insertJobSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const job = await storage.updateJob(id, parsed.data);
      res.json(job);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // ============================================
  // Events Routes
  // ============================================

  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // ============================================
  // Audit Log Routes
  // ============================================

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ============================================
  // Event Simulation Routes
  // ============================================

  app.post("/api/simulate-event", async (req, res) => {
    try {
      const { type, data } = req.body;

      if (!type || !data) {
        return res.status(400).json({ error: "Missing type or data" });
      }

      const validTypes = ["missed_call", "inbound_sms", "web_lead"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid event type. Must be one of: ${validTypes.join(", ")}` });
      }

      const result = await processEvent({ type, data });
      res.json(result);
    } catch (error) {
      console.error("Error simulating event:", error);
      res.status(500).json({ error: "Failed to simulate event" });
    }
  });

  // ============================================
  // Simulate Job Completed (triggers review flow)
  // ============================================

  app.post("/api/jobs/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await simulateJobCompleted(id);
      res.json(result);
    } catch (error) {
      console.error("Error simulating job completion:", error);
      res.status(500).json({ error: "Failed to simulate job completion" });
    }
  });

  // ============================================
  // Missed Call Simulation Endpoint
  // ============================================

  app.post("/api/events/missed-call", async (req, res) => {
    try {
      const missedCallSchema = z.object({
        from_phone: z.string().min(1, "from_phone is required"),
      });

      const parsed = missedCallSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const result = await processEvent({
        type: "missed_call",
        data: {
          phone: parsed.data.from_phone,
          channel: "call",
        },
      });

      res.json(result);
    } catch (error) {
      console.error("Error simulating missed call:", error);
      res.status(500).json({ error: "Failed to simulate missed call" });
    }
  });

  // ============================================
  // Twilio Webhooks
  // ============================================

  app.post("/webhooks/twilio/sms", async (req, res) => {
    try {
      const signature = req.headers["x-twilio-signature"] as string | undefined;
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const isValid = twilioConnector.validateSignature(signature, fullUrl, req.body);
      
      if (!isValid) {
        console.warn("[Webhook] Invalid Twilio signature, rejecting request");
        return res.status(403).send("Forbidden");
      }

      const { From, Body, MessageSid } = req.body;

      const result = await processEvent({
        type: "inbound_sms",
        data: {
          from: From,
          body: Body,
          sid: MessageSid,
          channel: "sms",
        },
        eventId: MessageSid ? `twilio_sms_${MessageSid}` : undefined,
      });

      console.log(`[Webhook] Processed inbound SMS from ${From}: ${result.success ? "success" : "failed"}`);

      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    } catch (error) {
      console.error("Error handling Twilio SMS webhook:", error);
      res.status(500).send();
    }
  });

  app.post("/api/webhooks/twilio/sms", async (req, res) => {
    try {
      const signature = req.headers["x-twilio-signature"] as string | undefined;
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const isValid = twilioConnector.validateSignature(signature, fullUrl, req.body);
      
      if (!isValid) {
        console.warn("[Webhook] Invalid Twilio signature, rejecting request");
        return res.status(403).send("Forbidden");
      }

      const { From, Body, MessageSid } = req.body;

      const result = await processEvent({
        type: "inbound_sms",
        data: {
          from: From,
          body: Body,
          sid: MessageSid,
          channel: "sms",
        },
        eventId: MessageSid ? `twilio_sms_${MessageSid}` : undefined,
      });

      console.log(`[Webhook] Processed inbound SMS from ${From}: ${result.success ? "success" : "failed"}`);

      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    } catch (error) {
      console.error("Error handling Twilio SMS webhook:", error);
      res.status(500).send();
    }
  });

  app.post("/api/webhooks/twilio/voice", async (req, res) => {
    try {
      const { From, To, CallStatus } = req.body;

      if (CallStatus === "no-answer" || CallStatus === "busy") {
        await processEvent({
          type: "missed_call",
          data: {
            phone: From,
            to: To,
            status: CallStatus,
            channel: "call",
          },
        });
      }

      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    } catch (error) {
      console.error("Error handling Twilio voice webhook:", error);
      res.status(500).send();
    }
  });

  // ============================================
  // Policy Profile Routes
  // ============================================

  app.get("/api/policy", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      let policyProfile = await storage.getPolicyProfile(profile.id);
      
      // Create default policy if none exists
      if (!policyProfile) {
        policyProfile = await PolicyService.createDefaultPolicy(profile.id, "owner_operator");
      }
      
      res.json(policyProfile);
    } catch (error) {
      console.error("Error fetching policy profile:", error);
      res.status(500).json({ error: "Failed to fetch policy" });
    }
  });

  app.get("/api/policy/tiers", async (req, res) => {
    res.json({
      tiers: PolicyTiers,
      descriptions: {
        owner_operator: {
          name: "Owner Operator",
          description: "Basic automation with human approval for quotes and scheduling",
          features: {
            autoSendMessages: true,
            autoSendQuotes: false,
            autoBookJobs: false,
            afterHoursAutomation: false,
            confidenceThreshold: 0.85,
          },
        },
        smb: {
          name: "SMB",
          description: "Enhanced automation with auto-quotes for range estimates",
          features: {
            autoSendMessages: true,
            autoSendQuotes: "Range quotes only when confidence >= 85%",
            autoBookJobs: false,
            afterHoursAutomation: "Configurable",
            confidenceThreshold: 0.85,
          },
        },
        commercial: {
          name: "Commercial",
          description: "Full automation with auto-booking for high-confidence opportunities",
          features: {
            autoSendMessages: true,
            autoSendQuotes: "Range and fixed quotes when confidence >= 90%",
            autoBookJobs: "When confidence >= 90% and slot score >= threshold",
            afterHoursAutomation: "Configurable",
            confidenceThreshold: 0.90,
          },
        },
      },
    });
  });

  app.patch("/api/policy/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateSchema = insertPolicyProfileSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const policyProfile = await storage.updatePolicyProfile(id, parsed.data);
      res.json(policyProfile);
    } catch (error) {
      console.error("Error updating policy profile:", error);
      res.status(500).json({ error: "Failed to update policy" });
    }
  });

  app.post("/api/policy/blocked-phones", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const policyProfile = await storage.getPolicyProfile(profile.id);
      if (!policyProfile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }
      
      const blockedPhones = [...(policyProfile.blockedPhones || []), phone];
      const updated = await storage.updatePolicyProfile(policyProfile.id, { blockedPhones });
      
      res.json(updated);
    } catch (error) {
      console.error("Error adding blocked phone:", error);
      res.status(500).json({ error: "Failed to add blocked phone" });
    }
  });

  app.delete("/api/policy/blocked-phones/:phone", async (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const policyProfile = await storage.getPolicyProfile(profile.id);
      if (!policyProfile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }
      
      const blockedPhones = (policyProfile.blockedPhones || []).filter(p => p !== phone);
      const updated = await storage.updatePolicyProfile(policyProfile.id, { blockedPhones });
      
      res.json(updated);
    } catch (error) {
      console.error("Error removing blocked phone:", error);
      res.status(500).json({ error: "Failed to remove blocked phone" });
    }
  });

  app.post("/api/policy/service-area", async (req, res) => {
    try {
      const { zipCodes, radius } = req.body;
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const policyProfile = await storage.getPolicyProfile(profile.id);
      if (!policyProfile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }
      
      const updates: any = {};
      if (zipCodes) updates.serviceAreaZips = zipCodes;
      if (radius !== undefined) updates.serviceAreaRadius = radius;
      
      const updated = await storage.updatePolicyProfile(policyProfile.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating service area:", error);
      res.status(500).json({ error: "Failed to update service area" });
    }
  });

  return httpServer;
}
