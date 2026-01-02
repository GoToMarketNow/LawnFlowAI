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
  insertAccountPackageSchema,
} from "@shared/schema";
import { PolicyService } from "./policy";
import { growthAdvisor } from "./growth-advisor";
import { registerAuthRoutes } from "./auth-routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============================================
  // Authentication Routes (2FA)
  // ============================================
  registerAuthRoutes(app);

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
  // Growth Advisor API Routes
  // ============================================

  app.get("/api/growth-advisor/usage", async (req, res) => {
    try {
      const businessId = parseInt(req.query.businessId as string) || 1;
      const usageStats = await growthAdvisor.getUsageStats(businessId);
      res.json(usageStats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Failed to fetch usage stats" });
    }
  });

  app.get("/api/growth-advisor/recommendation", async (req, res) => {
    try {
      const businessId = parseInt(req.query.businessId as string) || 1;
      const recommendation = await growthAdvisor.generateRecommendation(businessId);
      
      if (!recommendation) {
        return res.status(404).json({ 
          error: "No account package found",
          message: "Please set up your account package first."
        });
      }
      
      res.json(recommendation);
    } catch (error) {
      console.error("Error generating recommendation:", error);
      res.status(500).json({ error: "Failed to generate recommendation" });
    }
  });

  app.get("/api/growth-advisor/package", async (req, res) => {
    try {
      const businessId = parseInt(req.query.businessId as string) || 1;
      const accountPackage = await storage.getAccountPackage(businessId);
      
      if (!accountPackage) {
        return res.status(404).json({ error: "Account package not found" });
      }
      
      res.json(accountPackage);
    } catch (error) {
      console.error("Error fetching account package:", error);
      res.status(500).json({ error: "Failed to fetch account package" });
    }
  });

  app.post("/api/growth-advisor/package", async (req, res) => {
    try {
      const parsed = insertAccountPackageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const existingPackage = await storage.getAccountPackage(parsed.data.businessId);
      if (existingPackage) {
        return res.status(409).json({ 
          error: "Account package already exists",
          message: "Use PATCH to update the existing package."
        });
      }
      
      const accountPackage = await storage.createAccountPackage(parsed.data);
      res.status(201).json(accountPackage);
    } catch (error) {
      console.error("Error creating account package:", error);
      res.status(500).json({ error: "Failed to create account package" });
    }
  });

  app.patch("/api/growth-advisor/package/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateSchema = insertAccountPackageSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const accountPackage = await storage.updateAccountPackage(id, parsed.data);
      res.json(accountPackage);
    } catch (error) {
      console.error("Error updating account package:", error);
      res.status(500).json({ error: "Failed to update account package" });
    }
  });

  app.post("/api/growth-advisor/recommendation/:id/action", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { action } = req.body;
      
      if (!["accepted", "dismissed", "ignored"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be: accepted, dismissed, or ignored" });
      }
      
      const recommendation = await storage.updateGrowthRecommendation(id, {
        userAction: action,
        userActionAt: new Date(),
      });
      
      res.json(recommendation);
    } catch (error) {
      console.error("Error updating recommendation action:", error);
      res.status(500).json({ error: "Failed to update recommendation" });
    }
  });

  app.get("/api/growth-advisor/history", async (req, res) => {
    try {
      const businessId = parseInt(req.query.businessId as string) || 1;
      const recommendations = await storage.getGrowthRecommendations(businessId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendation history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/growth-advisor/simulate-usage", async (req, res) => {
    try {
      const { businessId, actionType, count = 1 } = req.body;
      
      if (!businessId || !actionType) {
        return res.status(400).json({ error: "businessId and actionType are required" });
      }
      
      for (let i = 0; i < count; i++) {
        await storage.incrementActionUsage(businessId, actionType);
      }
      
      const todayUsage = await storage.getTodayUsage(businessId);
      res.json({
        success: true,
        message: `Added ${count} ${actionType} action(s)`,
        todayUsage,
      });
    } catch (error) {
      console.error("Error simulating usage:", error);
      res.status(500).json({ error: "Failed to simulate usage" });
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

        // Create account package for Growth Advisor
        const existingPackage = await storage.getAccountPackage(profile.id);
        if (!existingPackage) {
          await storage.createAccountPackage({
            businessId: profile.id,
            packageName: "starter",
            monthlyActionsIncluded: 3000,
            hardCapActions: 3500,
            packSizeActions: 1000,
            packPriceUsd: 25,
            peakMonths: [4, 5, 6, 9, 10],
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
  // Quote API Routes
  // ============================================

  const quoteRequestSchema = z.object({
    address: z.string().optional(),
    service: z.enum(["mowing", "cleanup", "mulch", "landscaping", "irrigation", "trimming", "other"]),
    frequency: z.enum(["weekly", "biweekly", "monthly", "one_time"]).optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    propertySize: z.enum(["small", "medium", "large", "unknown"]).optional(),
    notes: z.string().optional(),
    hasPhotos: z.boolean().optional(),
    conversationId: z.number().optional(),
    leadId: z.number().optional(),
  });

  app.post("/api/quote/generate", async (req, res) => {
    try {
      const parsed = quoteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { runQuotingAgent, getDefaultPricingRules, getDefaultPolicyThresholds } = await import("./agents/quoting");
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(400).json({ error: "Business profile not configured" });
      }

      const policyProfile = await storage.getPolicyProfile(profile.id);
      const tier = (policyProfile?.tier || "owner_operator") as "Owner" | "SMB" | "Commercial";
      const tierMapping: Record<string, "Owner" | "SMB" | "Commercial"> = {
        owner_operator: "Owner",
        smb: "SMB",
        commercial: "Commercial",
      };

      const lead = {
        name: parsed.data.customerName || null,
        address: parsed.data.address || null,
        service_requested: parsed.data.service,
        frequency: parsed.data.frequency,
        urgency: "flexible" as const,
        property_size_hint: parsed.data.propertySize || "unknown",
        notes: parsed.data.notes || "",
      };

      const pricing = getDefaultPricingRules();
      if (profile.mowingMinPrice) pricing.minimumPrice = profile.mowingMinPrice / 100;

      const policy = getDefaultPolicyThresholds(tierMapping[policyProfile?.tier || "owner_operator"] || "Owner");

      const context = {
        hasPhotos: parsed.data.hasPhotos || false,
        photoNotes: null,
        businessName: profile.name,
      };

      const quote = await runQuotingAgent(lead, pricing, policy, context);

      if (parsed.data.conversationId || parsed.data.leadId) {
        await storage.createPropertyQuoteContext({
          leadId: parsed.data.leadId,
          conversationId: parsed.data.conversationId,
          normalizedAddress: parsed.data.address,
          zip: parsed.data.address?.match(/\b(\d{5})\b/)?.[1],
          areaBand: quote.property_context?.area_band || null,
          lotAreaSqft: quote.property_context?.lot_area_sqft,
          source: quote.property_context?.data_source || "unknown",
          confidence: quote.confidence >= 0.8 ? "high" : quote.confidence >= 0.6 ? "medium" : "low",
          parcelCoverageStatus: quote.property_context?.parcel_coverage,
        });
      }

      res.json(quote);
    } catch (error) {
      console.error("Error generating quote:", error);
      res.status(500).json({ error: "Failed to generate quote" });
    }
  });

  app.get("/api/quote/context/:conversationId", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }

      const context = await storage.getPropertyQuoteContextByConversation(conversationId);
      if (!context) {
        return res.status(404).json({ error: "Quote context not found" });
      }

      res.json(context);
    } catch (error) {
      console.error("Error fetching quote context:", error);
      res.status(500).json({ error: "Failed to fetch quote context" });
    }
  });

  app.get("/api/parcel-coverage", async (req, res) => {
    try {
      const coverage = await storage.getAllParcelCoverage();
      res.json(coverage);
    } catch (error) {
      console.error("Error fetching parcel coverage:", error);
      res.status(500).json({ error: "Failed to fetch parcel coverage" });
    }
  });

  app.post("/api/parcel-coverage/seed", async (req, res) => {
    try {
      const { geoService } = await import("./services/geo");
      await geoService.seedParcelCoverageRegistry();
      const coverage = await storage.getAllParcelCoverage();
      res.json({ success: true, count: coverage.length, data: coverage });
    } catch (error) {
      console.error("Error seeding parcel coverage:", error);
      res.status(500).json({ error: "Failed to seed parcel coverage" });
    }
  });

  // ============================================
  // FREE-FIRST Lot Size API Routes
  // ============================================

  const lotSizeRequestSchema = z.object({
    address: z.string().min(1, "Address is required"),
  });

  app.post("/api/geo/lot-size", async (req, res) => {
    try {
      const parsed = lotSizeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { lotSizeResolver } = await import("./services/lotSizeResolver");
      const result = await lotSizeResolver.resolve(parsed.data.address);
      res.json(result);
    } catch (error) {
      console.error("Error resolving lot size:", error);
      res.status(500).json({ error: "Failed to resolve lot size" });
    }
  });

  app.post("/api/geo/lot-size/seed", async (req, res) => {
    try {
      const { lotSizeResolver } = await import("./services/lotSizeResolver");
      await lotSizeResolver.seedCountySources();
      await lotSizeResolver.seedZipCrosswalk();
      res.json({ success: true, message: "Seeded county sources and ZIP crosswalk" });
    } catch (error) {
      console.error("Error seeding lot size data:", error);
      res.status(500).json({ error: "Failed to seed lot size data" });
    }
  });

  // Admin County Sources API
  const countySourceSchema = z.object({
    stateFips: z.string(),
    countyFips: z.string(),
    countyName: z.string(),
    status: z.enum(["full", "partial", "none", "unknown"]).optional(),
    sourceType: z.enum(["arcgis_feature_service", "arcgis_rest", "manual_viewer", "none"]).optional(),
    serviceUrl: z.string().nullable().optional(),
    layerId: z.number().nullable().optional(),
    supportsPointQuery: z.boolean().optional(),
    areaFieldCandidates: z.array(z.string()).optional(),
    areaUnits: z.enum(["sqft", "sqm", "acres", "unknown"]).optional(),
    parcelIdField: z.string().nullable().optional(),
  });

  app.get("/api/admin/county-sources", async (req, res) => {
    try {
      const sources = await storage.getAllCountySources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching county sources:", error);
      res.status(500).json({ error: "Failed to fetch county sources" });
    }
  });

  app.get("/api/admin/county-sources/:countyFips", async (req, res) => {
    try {
      const source = await storage.getCountySource(req.params.countyFips);
      if (!source) {
        return res.status(404).json({ error: "County source not found" });
      }
      res.json(source);
    } catch (error) {
      console.error("Error fetching county source:", error);
      res.status(500).json({ error: "Failed to fetch county source" });
    }
  });

  app.post("/api/admin/county-sources", async (req, res) => {
    try {
      const parsed = countySourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const source = await storage.createCountySource(parsed.data);
      res.json(source);
    } catch (error) {
      console.error("Error creating county source:", error);
      res.status(500).json({ error: "Failed to create county source" });
    }
  });

  app.patch("/api/admin/county-sources/:countyFips", async (req, res) => {
    try {
      const parsed = countySourceSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const source = await storage.updateCountySource(req.params.countyFips, parsed.data);
      if (!source) {
        return res.status(404).json({ error: "County source not found" });
      }
      res.json(source);
    } catch (error) {
      console.error("Error updating county source:", error);
      res.status(500).json({ error: "Failed to update county source" });
    }
  });

  app.delete("/api/admin/county-sources/:countyFips", async (req, res) => {
    try {
      const deleted = await storage.deleteCountySource(req.params.countyFips);
      if (!deleted) {
        return res.status(404).json({ error: "County source not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting county source:", error);
      res.status(500).json({ error: "Failed to delete county source" });
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
  // ZIP Coverage Routes
  // ============================================

  const zipCoverageSchema = z.object({
    zipCodes: z.array(z.string().regex(/^\d{5}$/, "Invalid ZIP code")).min(1).max(100),
  });

  app.post("/api/geo/zip-coverage", async (req, res) => {
    try {
      const parsed = zipCoverageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { zipCodes } = parsed.data;
      
      // Get cached ZIPs
      const cachedGeos = await storage.getZipGeos(zipCodes);
      const cachedZipSet = new Set(cachedGeos.map((g) => g.zip));
      
      // Find missing ZIPs that need geocoding
      const missingZips = zipCodes.filter((z) => !cachedZipSet.has(z));
      
      // Geocode missing ZIPs (mock implementation for MVP)
      // In production, this would call Google Geocoding API
      const newGeos: Array<{
        zip: string;
        centerLat: number;
        centerLng: number;
        viewportNorth: number;
        viewportSouth: number;
        viewportEast: number;
        viewportWest: number;
      }> = [];

      for (const zip of missingZips) {
        // Mock geocoding based on ZIP prefix (for demo)
        // Real implementation would use Google Geocoding API
        const mockGeo = mockGeocodeZip(zip);
        if (mockGeo) {
          const saved = await storage.upsertZipGeo(mockGeo);
          newGeos.push(saved);
        }
      }

      // Combine cached and new geos
      const allGeos = [...cachedGeos, ...newGeos];
      
      // Calculate overall bounds
      const bounds = calculateBounds(allGeos);

      res.json({
        zipAreas: allGeos.map((g) => ({
          zip: g.zip,
          center: { lat: g.centerLat, lng: g.centerLng },
          bounds: {
            north: g.viewportNorth,
            south: g.viewportSouth,
            east: g.viewportEast,
            west: g.viewportWest,
          },
        })),
        bounds,
        cachedCount: cachedGeos.length,
        geocodedCount: newGeos.length,
      });
    } catch (error) {
      console.error("Error fetching ZIP coverage:", error);
      res.status(500).json({ error: "Failed to fetch ZIP coverage" });
    }
  });

  // Mock geocoding function for ZIP codes
  // In production, replace with Google Geocoding API call
  function mockGeocodeZip(zip: string): {
    zip: string;
    centerLat: number;
    centerLng: number;
    viewportNorth: number;
    viewportSouth: number;
    viewportEast: number;
    viewportWest: number;
  } | null {
    // Generate deterministic but varied coordinates based on ZIP
    // This is a placeholder - real implementation would use Google Geocoding API
    const zipNum = parseInt(zip);
    
    // Use ZIP prefix to determine rough region (US ZIP code patterns)
    // 0xxxx-1xxxx: Northeast, 2xxxx-3xxxx: Southeast, 4xxxx-5xxxx: Midwest
    // 6xxxx-7xxxx: South/Central, 8xxxx-9xxxx: West
    const prefix = Math.floor(zipNum / 10000);
    
    let baseLat: number;
    let baseLng: number;
    
    switch (prefix) {
      case 0:
      case 1:
        baseLat = 41 + (zipNum % 1000) * 0.003;
        baseLng = -73 - (zipNum % 500) * 0.002;
        break;
      case 2:
        baseLat = 38 + (zipNum % 1000) * 0.003;
        baseLng = -77 - (zipNum % 500) * 0.002;
        break;
      case 3:
        baseLat = 33 + (zipNum % 1000) * 0.003;
        baseLng = -84 - (zipNum % 500) * 0.002;
        break;
      case 4:
      case 5:
        baseLat = 41 + (zipNum % 1000) * 0.003;
        baseLng = -87 - (zipNum % 500) * 0.002;
        break;
      case 6:
      case 7:
        baseLat = 32 + (zipNum % 1000) * 0.003;
        baseLng = -97 - (zipNum % 500) * 0.002;
        break;
      case 8:
        baseLat = 39 + (zipNum % 1000) * 0.003;
        baseLng = -105 - (zipNum % 500) * 0.002;
        break;
      case 9:
        baseLat = 37 + (zipNum % 1000) * 0.003;
        baseLng = -122 - (zipNum % 500) * 0.002;
        break;
      default:
        baseLat = 38 + (zipNum % 1000) * 0.003;
        baseLng = -78 - (zipNum % 500) * 0.002;
    }
    
    // ZIP code areas are roughly 5-10 miles across
    const delta = 0.05; // ~3-5 miles
    
    return {
      zip,
      centerLat: baseLat,
      centerLng: baseLng,
      viewportNorth: baseLat + delta,
      viewportSouth: baseLat - delta,
      viewportEast: baseLng + delta,
      viewportWest: baseLng - delta,
    };
  }

  function calculateBounds(geos: Array<{
    viewportNorth: number;
    viewportSouth: number;
    viewportEast: number;
    viewportWest: number;
  }>): { north: number; south: number; east: number; west: number } | null {
    if (geos.length === 0) return null;
    
    return {
      north: Math.max(...geos.map((g) => g.viewportNorth)),
      south: Math.min(...geos.map((g) => g.viewportSouth)),
      east: Math.max(...geos.map((g) => g.viewportEast)),
      west: Math.min(...geos.map((g) => g.viewportWest)),
    };
  }

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
  // Quote Request Simulation Endpoint
  // ============================================

  app.post("/api/events/quote-request", async (req, res) => {
    try {
      const quoteRequestSchema = z.object({
        phone: z.string().min(1, "phone is required"),
        address: z.string().optional(),
        service: z.string().default("mowing"),
        customerName: z.string().optional(),
        message: z.string().optional(),
      });

      const parsed = quoteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const result = await processEvent({
        type: "quote_request",
        data: {
          phone: parsed.data.phone,
          address: parsed.data.address,
          service: parsed.data.service,
          customerName: parsed.data.customerName,
          message: parsed.data.message,
          channel: "api",
        },
      });

      res.json(result);
    } catch (error) {
      console.error("Error simulating quote request:", error);
      res.status(500).json({ error: "Failed to simulate quote request" });
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
  // Jobber Webhook Routes
  // ============================================
  
  app.post("/webhooks/jobber", async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { jobberWebhookProcessor, verifyJobberWebhookSignature } = await import("./connectors/jobber-webhook");
      const { jobberAccounts } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      const payload = req.body;
      
      if (!payload.webhookEventId || !payload.accountId || !payload.topic) {
        console.error("[Jobber Webhook] Invalid payload structure");
        return res.status(400).json({ error: "Invalid payload" });
      }
      
      const signature = req.headers["x-jobber-signature"] as string | undefined;
      
      if (signature) {
        const [account] = await db
          .select({ webhookSecret: jobberAccounts.webhookSecret })
          .from(jobberAccounts)
          .where(eq(jobberAccounts.jobberAccountId, payload.accountId))
          .limit(1);
        
        if (account?.webhookSecret) {
          const rawBody = (req as any).rawBody?.toString() || JSON.stringify(payload);
          const isValid = verifyJobberWebhookSignature(rawBody, signature, account.webhookSecret);
          
          if (!isValid) {
            console.error("[Jobber Webhook] Invalid signature");
            return res.status(401).json({ error: "Invalid signature" });
          }
        }
      }
      
      const result = await jobberWebhookProcessor.receiveWebhook(payload);
      
      if (payload.topic.startsWith("QUOTE_") || payload.topic.startsWith("JOB_")) {
        const { handleQuoteJobWebhook } = await import("./connectors/jobber-quote-job-worker");
        await handleQuoteJobWebhook(payload);
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[Jobber Webhook] Acknowledged ${payload.topic} in ${elapsed}ms`);
      
      res.status(200).json({ 
        acknowledged: result.acknowledged,
        eventId: result.eventId,
      });
    } catch (error) {
      console.error("[Jobber Webhook] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.get("/api/jobber/accounts", async (req, res) => {
    try {
      const { jobberAccounts } = await import("@shared/schema");
      const { db } = await import("./db");
      
      const accounts = await db
        .select({
          id: jobberAccounts.id,
          jobberAccountId: jobberAccounts.jobberAccountId,
          isActive: jobberAccounts.isActive,
          createdAt: jobberAccounts.createdAt,
        })
        .from(jobberAccounts);
      
      res.json(accounts);
    } catch (error) {
      console.error("[Jobber] Error fetching accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/jobber/events", async (req, res) => {
    try {
      const { jobberWebhookEvents } = await import("@shared/schema");
      const { db } = await import("./db");
      const { desc } = await import("drizzle-orm");
      
      const limit = parseInt(req.query.limit as string) || 50;
      
      const events = await db
        .select()
        .from(jobberWebhookEvents)
        .orderBy(desc(jobberWebhookEvents.receivedAt))
        .limit(limit);
      
      res.json(events);
    } catch (error) {
      console.error("[Jobber] Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/jobber/enrichments", async (req, res) => {
    try {
      const { jobberEnrichments } = await import("@shared/schema");
      const { db } = await import("./db");
      const { desc } = await import("drizzle-orm");
      
      const limit = parseInt(req.query.limit as string) || 50;
      
      const enrichments = await db
        .select()
        .from(jobberEnrichments)
        .orderBy(desc(jobberEnrichments.updatedAt))
        .limit(limit);
      
      res.json(enrichments);
    } catch (error) {
      console.error("[Jobber] Error fetching enrichments:", error);
      res.status(500).json({ error: "Failed to fetch enrichments" });
    }
  });

  app.get("/api/jobber/quote-job-sync", async (req, res) => {
    try {
      const { getSyncEvents } = await import("./connectors/jobber-quote-job-worker");
      const accountId = req.query.accountId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const events = await getSyncEvents(accountId, limit);
      res.json(events);
    } catch (error) {
      console.error("[Jobber] Error fetching sync events:", error);
      res.status(500).json({ error: "Failed to fetch sync events" });
    }
  });

  app.post("/api/jobber/test-harness/diff", async (req, res) => {
    try {
      const { computeLineItemDiff, evaluateRules, canAutoApply, getChangeOrderReason, DEFAULT_RULES } = 
        await import("./connectors/jobber-rules");
      
      const { quoteItems, jobItems, rules } = req.body;
      
      if (!quoteItems || !jobItems) {
        return res.status(400).json({ error: "quoteItems and jobItems required" });
      }
      
      const diffs = computeLineItemDiff(quoteItems, jobItems);
      const result = evaluateRules(diffs, rules || DEFAULT_RULES);
      
      res.json({
        ...result,
        canAutoApply: canAutoApply(result),
        changeOrderReason: getChangeOrderReason(result.violations),
      });
    } catch (error: any) {
      console.error("[Jobber] Test harness error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobber/test-harness/replay", async (req, res) => {
    try {
      const { replayCustomPayload } = await import("./connectors/jobber-test-harness");
      const { payload, rules } = req.body;
      
      if (!payload) {
        return res.status(400).json({ error: "payload required" });
      }
      
      await replayCustomPayload(payload, { rules });
      res.json({ success: true, message: "Webhook replayed" });
    } catch (error: any) {
      console.error("[Jobber] Replay error:", error);
      res.status(500).json({ error: error.message });
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

  // ============================================
  // Dispatch & Routing Routes
  // ============================================

  app.get("/api/dispatch/plans", async (req, res) => {
    try {
      const { dispatchPlans } = await import("@shared/schema");
      const plans = await db
        .select()
        .from(dispatchPlans)
        .orderBy(sql`${dispatchPlans.planDate} DESC`)
        .limit(20);
      res.json(plans);
    } catch (error: any) {
      console.error("[Dispatch] Error fetching plans:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dispatch/plans/:id", async (req, res) => {
    try {
      const { dispatchPlans, dispatchPlanEvents } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      
      const [plan] = await db
        .select()
        .from(dispatchPlans)
        .where(eq(dispatchPlans.id, id))
        .limit(1);
      
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      const events = await db
        .select()
        .from(dispatchPlanEvents)
        .where(eq(dispatchPlanEvents.planId, id))
        .orderBy(dispatchPlanEvents.createdAt);
      
      res.json({ ...plan, events });
    } catch (error: any) {
      console.error("[Dispatch] Error fetching plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dispatch/plans/:id/apply", async (req, res) => {
    try {
      const { dispatchPlans } = await import("@shared/schema");
      const { applyDispatchPlan } = await import("./workers/dispatch/dispatcher");
      const id = parseInt(req.params.id);
      
      const [plan] = await db
        .select()
        .from(dispatchPlans)
        .where(eq(dispatchPlans.id, id))
        .limit(1);
      
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      if (!plan.jobberAccountId) {
        return res.status(400).json({ error: "Plan has no Jobber account" });
      }
      
      const success = await applyDispatchPlan(id, plan.jobberAccountId);
      res.json({ success });
    } catch (error: any) {
      console.error("[Dispatch] Error applying plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dispatch/compute", async (req, res) => {
    try {
      const { processDispatch } = await import("./workers/dispatch/dispatcher");
      const { planDate, jobberAccountId } = req.body;
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const date = planDate ? new Date(planDate) : new Date();
      date.setDate(date.getDate() + 1);
      
      const plan = await processDispatch({
        businessId: profile.id,
        jobberAccountId: jobberAccountId || "mock",
        planDate: date,
        mode: "nightly",
      });
      
      res.json(plan || { message: "No plan created (no jobs or crews)" });
    } catch (error: any) {
      console.error("[Dispatch] Error computing plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dispatch/crews", async (req, res) => {
    try {
      const { crewRoster } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const crews = await db
        .select()
        .from(crewRoster)
        .where(eq(crewRoster.businessId, profile.id));
      
      res.json(crews);
    } catch (error: any) {
      console.error("[Dispatch] Error fetching crews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dispatch/crews", async (req, res) => {
    try {
      const { crewRoster, insertCrewRosterSchema } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const parsed = insertCrewRosterSchema.safeParse({
        ...req.body,
        businessId: profile.id,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const [crew] = await db
        .insert(crewRoster)
        .values(parsed.data)
        .returning();
      
      res.json(crew);
    } catch (error: any) {
      console.error("[Dispatch] Error creating crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/dispatch/crews/:id", async (req, res) => {
    try {
      const { crewRoster } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      
      const [crew] = await db
        .update(crewRoster)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crewRoster.id, id))
        .returning();
      
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      
      res.json(crew);
    } catch (error: any) {
      console.error("[Dispatch] Error updating crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/dispatch/crews/:id", async (req, res) => {
    try {
      const { crewRoster } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      
      await db
        .delete(crewRoster)
        .where(eq(crewRoster.id, id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Dispatch] Error deleting crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Margin & Variance API Endpoints
  // ============================================

  app.get("/api/margin/alerts", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const status = req.query.status as string | undefined;
      
      const conditions = [eq(marginAlerts.businessId, profile.id)];
      if (status) {
        conditions.push(eq(marginAlerts.status, status));
      }
      
      const alerts = await db
        .select()
        .from(marginAlerts)
        .where(and(...conditions))
        .orderBy(desc(marginAlerts.createdAt));
      
      res.json(alerts);
    } catch (error: any) {
      console.error("[Margin] Error fetching alerts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/margin/alerts/:id", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts, jobSnapshots } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const id = parseInt(req.params.id);
      
      const [alert] = await db
        .select()
        .from(marginAlerts)
        .where(eq(marginAlerts.id, id))
        .limit(1);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      const [snapshot] = await db
        .select()
        .from(jobSnapshots)
        .where(eq(jobSnapshots.id, alert.snapshotId))
        .limit(1);
      
      res.json({ alert, snapshot });
    } catch (error: any) {
      console.error("[Margin] Error fetching alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/margin/alerts/:id/acknowledge", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { acknowledgeAlert } = await import("./workers/margin/marginWorker");
      const id = parseInt(req.params.id);
      const { acknowledgedBy } = req.body;
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const [alert] = await db
        .select()
        .from(marginAlerts)
        .where(and(eq(marginAlerts.id, id), eq(marginAlerts.businessId, profile.id)))
        .limit(1);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      await acknowledgeAlert(id, acknowledgedBy || "user");
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Margin] Error acknowledging alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/margin/alerts/:id/resolve", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { resolveAlert } = await import("./workers/margin/marginWorker");
      const id = parseInt(req.params.id);
      const { resolvedBy, resolution } = req.body;
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const [alert] = await db
        .select()
        .from(marginAlerts)
        .where(and(eq(marginAlerts.id, id), eq(marginAlerts.businessId, profile.id)))
        .limit(1);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      await resolveAlert(id, resolvedBy || "user", resolution || "");
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Margin] Error resolving alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/margin/alerts/:id/dismiss", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { dismissAlert } = await import("./workers/margin/marginWorker");
      const id = parseInt(req.params.id);
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const [alert] = await db
        .select()
        .from(marginAlerts)
        .where(and(eq(marginAlerts.id, id), eq(marginAlerts.businessId, profile.id)))
        .limit(1);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      await dismissAlert(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Margin] Error dismissing alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/margin/snapshots", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { jobSnapshots } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const snapshots = await db
        .select()
        .from(jobSnapshots)
        .where(eq(jobSnapshots.businessId, profile.id))
        .orderBy(desc(jobSnapshots.updatedAt))
        .limit(50);
      
      res.json(snapshots);
    } catch (error: any) {
      console.error("[Margin] Error fetching snapshots:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/margin/snapshots/:jobId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { jobSnapshots } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { jobId } = req.params;
      
      const [snapshot] = await db
        .select()
        .from(jobSnapshots)
        .where(eq(jobSnapshots.jobberJobId, jobId))
        .limit(1);
      
      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }
      
      const { computeVariance } = await import("./workers/margin/varianceEngine");
      const variance = computeVariance(snapshot);
      
      res.json({ snapshot, variance });
    } catch (error: any) {
      console.error("[Margin] Error fetching snapshot:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/margin/summary", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { marginAlerts, jobSnapshots } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const openAlerts = await db
        .select()
        .from(marginAlerts)
        .where(and(
          eq(marginAlerts.businessId, profile.id),
          eq(marginAlerts.status, "open")
        ));
      
      const highRiskJobs = await db
        .select()
        .from(jobSnapshots)
        .where(and(
          eq(jobSnapshots.businessId, profile.id),
          eq(jobSnapshots.marginRisk, "high")
        ));
      
      const recentSnapshots = await db
        .select()
        .from(jobSnapshots)
        .where(eq(jobSnapshots.businessId, profile.id))
        .orderBy(desc(jobSnapshots.updatedAt))
        .limit(10);
      
      res.json({
        openAlertCount: openAlerts.length,
        highRiskJobCount: highRiskJobs.length,
        alertsBySeverity: {
          high: openAlerts.filter(a => a.severity === "high").length,
          medium: openAlerts.filter(a => a.severity === "medium").length,
          low: openAlerts.filter(a => a.severity === "low").length,
        },
        recentSnapshots,
      });
    } catch (error: any) {
      console.error("[Margin] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BILLING ORCHESTRATOR API ====================
  
  app.get("/api/billing/summary", async (req, res) => {
    try {
      const { getBusinessBillingSummary } = await import("./workers/billing/billingWorker");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const summary = await getBusinessBillingSummary(profile.id);
      res.json(summary);
    } catch (error: any) {
      console.error("[Billing] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/billing/states", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { jobBillingStates, billingInvoices } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const states = await db
        .select()
        .from(jobBillingStates)
        .where(eq(jobBillingStates.businessId, profile.id))
        .orderBy(desc(jobBillingStates.updatedAt))
        .limit(50);
      
      const invoices = await db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.businessId, profile.id));
      
      const statesWithInvoices = states.map(state => ({
        ...state,
        invoices: invoices.filter(inv => inv.billingStateId === state.id),
      }));
      
      res.json(statesWithInvoices);
    } catch (error: any) {
      console.error("[Billing] Error fetching states:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/billing/states/:jobId", async (req, res) => {
    try {
      const { getBillingStateForJob } = await import("./workers/billing/billingWorker");
      const { jobId } = req.params;
      const accountId = req.query.accountId as string;
      
      if (!accountId) {
        return res.status(400).json({ error: "accountId query param required" });
      }
      
      const result = await getBillingStateForJob(accountId, jobId);
      if (!result) {
        return res.status(404).json({ error: "Billing state not found" });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("[Billing] Error fetching job billing state:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/billing/invoices", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { billingInvoices } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const invoices = await db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.businessId, profile.id))
        .orderBy(desc(billingInvoices.createdAt))
        .limit(100);
      
      res.json(invoices);
    } catch (error: any) {
      console.error("[Billing] Error fetching invoices:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/billing/rules", async (req, res) => {
    try {
      const { BILLING_RULES, getBillingRule } = await import("./workers/billing/billingRules");
      const serviceType = req.query.serviceType as string;
      
      if (serviceType) {
        const rule = getBillingRule(serviceType);
        if (!rule) {
          return res.status(404).json({ error: "No billing rule for service type" });
        }
        return res.json(rule);
      }
      
      res.json(Object.values(BILLING_RULES));
    } catch (error: any) {
      console.error("[Billing] Error fetching rules:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reconciliation/summary", async (req, res) => {
    try {
      const { getReconciliationSummary } = await import("./workers/reconciliation/reconciliationWorker");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const summary = await getReconciliationSummary(profile.id);
      res.json(summary);
    } catch (error: any) {
      console.error("[Reconciliation] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reconciliation/alerts", async (req, res) => {
    try {
      const { getReconciliationAlerts } = await import("./workers/reconciliation/reconciliationWorker");
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const status = req.query.status as string;
      const alerts = await getReconciliationAlerts(profile.id, status);
      res.json(alerts);
    } catch (error: any) {
      console.error("[Reconciliation] Error fetching alerts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reconciliation/alerts/:id/acknowledge", async (req, res) => {
    try {
      const { acknowledgeAlert } = await import("./workers/reconciliation/reconciliationWorker");
      const alertId = parseInt(req.params.id);
      
      await acknowledgeAlert(alertId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Reconciliation] Error acknowledging alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reconciliation/alerts/:id/resolve", async (req, res) => {
    try {
      const { resolveAlert } = await import("./workers/reconciliation/reconciliationWorker");
      const alertId = parseInt(req.params.id);
      const { resolvedBy, notes } = req.body;
      
      await resolveAlert(alertId, resolvedBy || "admin", notes);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Reconciliation] Error resolving alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dlq/summary", async (req, res) => {
    try {
      const { getDLQSummary } = await import("./workers/reconciliation/dlqPipeline");
      const profile = await storage.getBusinessProfile();
      
      const summary = await getDLQSummary(profile?.id);
      res.json(summary);
    } catch (error: any) {
      console.error("[DLQ] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dlq/items", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { deadLetterQueue } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      
      const items = await db
        .select()
        .from(deadLetterQueue)
        .where(profile ? eq(deadLetterQueue.businessId, profile.id) : undefined)
        .orderBy(desc(deadLetterQueue.createdAt))
        .limit(100);
      
      res.json(items);
    } catch (error: any) {
      console.error("[DLQ] Error fetching items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dlq/items/:id/discard", async (req, res) => {
    try {
      const { discardItem } = await import("./workers/reconciliation/dlqPipeline");
      const itemId = parseInt(req.params.id);
      const { reason } = req.body;
      
      await discardItem(itemId, reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[DLQ] Error discarding item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/summary", async (req, res) => {
    try {
      const { getCommLogSummary } = await import("./workers/comms/customerCommsWorker");
      const profile = await storage.getBusinessProfile();
      
      const summary = await getCommLogSummary(profile?.id);
      res.json(summary);
    } catch (error: any) {
      console.error("[Comms] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/log", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { customerCommLog } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const profile = await storage.getBusinessProfile();
      
      let query = db.select().from(customerCommLog).orderBy(desc(customerCommLog.createdAt)).limit(100);
      
      if (profile) {
        query = query.where(eq(customerCommLog.businessId, profile.id)) as typeof query;
      }
      
      const entries = await query;
      res.json(entries);
    } catch (error: any) {
      console.error("[Comms] Error fetching log:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/:id", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { customerCommLog } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const logId = parseInt(req.params.id);
      
      const [entry] = await db
        .select()
        .from(customerCommLog)
        .where(eq(customerCommLog.id, logId))
        .limit(1);
      
      if (!entry) {
        return res.status(404).json({ error: "Communication log entry not found" });
      }
      
      res.json(entry);
    } catch (error: any) {
      console.error("[Comms] Error fetching log entry:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/templates/list", async (req, res) => {
    try {
      const { ALL_TEMPLATES } = await import("./workers/comms/messageTemplates");
      res.json(ALL_TEMPLATES);
    } catch (error: any) {
      console.error("[Comms] Error fetching templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upsell/scan", async (req, res) => {
    try {
      const { runUpsellScan, getJobberAccountForBusiness } = await import("./workers/upsell/upsellWorker");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(400).json({ error: "Business profile not found" });
      }

      const accountId = await getJobberAccountForBusiness(profile.id);
      if (!accountId) {
        return res.status(400).json({ error: "Jobber account not connected" });
      }

      const config = req.body || {};
      const summary = await runUpsellScan(accountId, config);
      res.json(summary);
    } catch (error: any) {
      console.error("[Upsell] Scan error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/upsell/preview/:clientId", async (req, res) => {
    try {
      const { previewUpsellOffers, getJobberAccountForBusiness } = await import("./workers/upsell/upsellWorker");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(400).json({ error: "Business profile not found" });
      }

      const accountId = await getJobberAccountForBusiness(profile.id);
      if (!accountId) {
        return res.status(400).json({ error: "Jobber account not connected" });
      }

      const lotSize = req.query.lotSize ? parseInt(req.query.lotSize as string, 10) : undefined;
      const offers = await previewUpsellOffers(accountId, req.params.clientId, lotSize);
      res.json(offers);
    } catch (error: any) {
      console.error("[Upsell] Preview error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/upsell/catalog", async (req, res) => {
    try {
      const { OFFER_CATALOG, getCurrentSeason, getLotSizeTier } = await import("./workers/upsell/offerCatalog");
      const season = getCurrentSeason();
      const seasonalOffers = OFFER_CATALOG.filter(o => o.applicableSeasons.includes(season));
      
      res.json({
        currentSeason: season,
        totalOffers: OFFER_CATALOG.length,
        seasonalOffers: seasonalOffers.length,
        catalog: OFFER_CATALOG,
      });
    } catch (error: any) {
      console.error("[Upsell] Catalog error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/upsell/config", async (req, res) => {
    try {
      const { UPSELL_OPT_IN_FIELD, LAWNFLOW_OFFER_ID_FIELD } = await import("./workers/upsell/upsellWorker");
      const { getCurrentSeason, LOT_SIZE_TIERS } = await import("./workers/upsell/offerCatalog");
      
      res.json({
        optInField: UPSELL_OPT_IN_FIELD,
        offerTrackingField: LAWNFLOW_OFFER_ID_FIELD,
        currentSeason: getCurrentSeason(),
        lotSizeTiers: LOT_SIZE_TIERS,
        defaultConfig: {
          maxDaysLookback: 60,
          maxOffersPerClient: 3,
          minDaysBetweenOffers: 14,
        },
      });
    } catch (error: any) {
      console.error("[Upsell] Config error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Agent Management Control Center API
  // ============================================

  const DEFAULT_AGENTS = [
    // Core agents - Orchestration & Lead Management
    {
      agentKey: "orchestration_engine",
      displayName: "Orchestration Engine",
      description: "AI-powered supervisor that generates and executes workflow plans for customer engagement",
      category: "core",
      schedule: "event-driven",
    },
    {
      agentKey: "intake_agent",
      displayName: "Intake & Qualification Agent",
      description: "Handles initial customer contact, lead qualification, and information extraction from inbound messages",
      category: "core",
      schedule: "event-driven",
    },
    {
      agentKey: "quoting_agent",
      displayName: "Quoting Agent",
      description: "Generates price quotes based on service type, lot size, and business pricing rules",
      category: "core",
      schedule: "event-driven",
    },
    {
      agentKey: "scheduling_agent",
      displayName: "Scheduling Agent",
      description: "Manages appointment booking, proposes available time slots, and handles rescheduling requests",
      category: "core",
      schedule: "event-driven",
    },
    // Operations agents - Dispatch & Routing
    {
      agentKey: "dispatch_worker",
      displayName: "Dispatch & Routing Worker",
      description: "Intelligent route planning and crew dispatch with optimal job assignment",
      category: "ops",
      schedule: "0 2 * * *", // Nightly at 2 AM
    },
    // Finance agents - Billing, Reconciliation & Margin
    {
      agentKey: "billing_agent",
      displayName: "Billing Agent",
      description: "Sends payment reminders, offers payment links, and handles collection escalation",
      category: "finance",
      schedule: "event-driven",
    },
    {
      agentKey: "billing_worker",
      displayName: "Billing Orchestrator",
      description: "Automated milestone-based invoicing for multi-phase projects",
      category: "finance",
      schedule: "event-driven",
    },
    {
      agentKey: "margin_worker",
      displayName: "Margin & Variance Worker",
      description: "Tracks job profitability, detects cost overruns, and creates alerts for margin issues",
      category: "finance",
      schedule: "event-driven",
    },
    {
      agentKey: "reconciliation_worker",
      displayName: "Reconciliation Worker",
      description: "Validates invoice/payment integrity and manages dead letter queue processing",
      category: "finance",
      schedule: "event-driven",
    },
    // Growth agents - Customer Comms, Reviews & Upsell
    {
      agentKey: "comms_worker",
      displayName: "Customer Comms Worker",
      description: "Sends compliant customer messages for job updates, reminders, and follow-ups",
      category: "comms",
      schedule: "event-driven",
    },
    {
      agentKey: "reviews_agent",
      displayName: "Reviews Agent",
      description: "Requests customer reviews after job completion with sentiment-aware timing",
      category: "comms",
      schedule: "event-driven",
    },
    {
      agentKey: "upsell_worker",
      displayName: "Renewal & Upsell Worker",
      description: "Generates next-best-offer recommendations and creates draft quotes in Jobber",
      category: "comms",
      schedule: "0 6 * * 1", // Weekly on Monday 6 AM
    },
  ];

  // Get all agents for the business
  app.get("/api/agents", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { agentRegistry } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      let agents = await db
        .select()
        .from(agentRegistry)
        .where(eq(agentRegistry.businessId, profile.id))
        .orderBy(agentRegistry.category, agentRegistry.displayName);

      // Seed default agents if none exist
      if (agents.length === 0) {
        for (const agent of DEFAULT_AGENTS) {
          await db.insert(agentRegistry).values({
            ...agent,
            businessId: profile.id,
            status: "active",
            healthScore: 100,
            successRate24h: 100,
            totalRuns: 0,
          });
        }
        agents = await db
          .select()
          .from(agentRegistry)
          .where(eq(agentRegistry.businessId, profile.id))
          .orderBy(agentRegistry.category, agentRegistry.displayName);
      }

      res.json(agents);
    } catch (error: any) {
      console.error("[Agents] Error fetching agents:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent summary metrics (MUST be before :id route)
  app.get("/api/agents/summary", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { agentRegistry } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const agents = await db
        .select()
        .from(agentRegistry)
        .where(eq(agentRegistry.businessId, profile.id));

      const summary = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === "active").length,
        pausedAgents: agents.filter(a => a.status === "paused").length,
        disabledAgents: agents.filter(a => a.status === "disabled").length,
        avgHealthScore: agents.length > 0 
          ? Math.round(agents.reduce((sum, a) => sum + (a.healthScore || 100), 0) / agents.length)
          : 100,
        totalTimeSavedMinutes: agents.reduce((sum, a) => sum + (a.timeSavedMinutes || 0), 0),
        totalCashAcceleratedCents: agents.reduce((sum, a) => sum + (a.cashAcceleratedCents || 0), 0),
        totalRevenueProtectedCents: agents.reduce((sum, a) => sum + (a.revenueProtectedCents || 0), 0),
        byCategory: {
          core: agents.filter(a => a.category === "core").length,
          ops: agents.filter(a => a.category === "ops").length,
          finance: agents.filter(a => a.category === "finance").length,
          comms: agents.filter(a => a.category === "comms").length,
        },
      };

      res.json(summary);
    } catch (error: any) {
      console.error("[Agents] Error fetching summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent details with recent runs
  app.get("/api/agents/:id", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and, desc } = await import("drizzle-orm");
      const { agentRegistry, agentRuns } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const id = parseInt(req.params.id);
      
      const [agent] = await db
        .select()
        .from(agentRegistry)
        .where(and(
          eq(agentRegistry.id, id),
          eq(agentRegistry.businessId, profile.id)
        ))
        .limit(1);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const recentRuns = await db
        .select()
        .from(agentRuns)
        .where(and(
          eq(agentRuns.agentId, id),
          eq(agentRuns.businessId, profile.id)
        ))
        .orderBy(desc(agentRuns.startedAt))
        .limit(20);

      res.json({ agent, recentRuns });
    } catch (error: any) {
      console.error("[Agents] Error fetching agent:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update agent status (pause/resume/disable)
  app.patch("/api/agents/:id/status", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const { agentRegistry } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["active", "paused", "disabled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be active, paused, or disabled" });
      }

      const [updated] = await db
        .update(agentRegistry)
        .set({ status, updatedAt: new Date() })
        .where(and(
          eq(agentRegistry.id, id),
          eq(agentRegistry.businessId, profile.id)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Agents] Error updating agent status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent runs with filtering
  app.get("/api/agents/:id/runs", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and, desc } = await import("drizzle-orm");
      const { agentRegistry, agentRuns } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const id = parseInt(req.params.id);
      
      // Verify agent belongs to this business
      const [agent] = await db
        .select()
        .from(agentRegistry)
        .where(and(
          eq(agentRegistry.id, id),
          eq(agentRegistry.businessId, profile.id)
        ))
        .limit(1);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      
      const conditions = [eq(agentRuns.agentId, id), eq(agentRuns.businessId, profile.id)];
      if (status) {
        conditions.push(eq(agentRuns.status, status));
      }

      const runs = await db
        .select()
        .from(agentRuns)
        .where(and(...conditions))
        .orderBy(desc(agentRuns.startedAt))
        .limit(limit);

      res.json(runs);
    } catch (error: any) {
      console.error("[Agents] Error fetching runs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record an agent run (used by workers internally)
  app.post("/api/agents/:agentKey/runs", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const { agentRegistry, agentRuns, insertAgentRunSchema } = await import("@shared/schema");
      const { agentKey } = req.params;
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const [agent] = await db
        .select()
        .from(agentRegistry)
        .where(and(
          eq(agentRegistry.businessId, profile.id),
          eq(agentRegistry.agentKey, agentKey)
        ))
        .limit(1);

      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const runData = insertAgentRunSchema.parse({
        agentId: agent.id,
        businessId: profile.id,
        ...req.body,
      });

      const [run] = await db.insert(agentRuns).values(runData).returning();
      
      // Update agent metrics (with businessId scoping for security)
      await db
        .update(agentRegistry)
        .set({
          lastRunAt: new Date(),
          totalRuns: (agent.totalRuns || 0) + 1,
          updatedAt: new Date(),
        })
        .where(and(
          eq(agentRegistry.id, agent.id),
          eq(agentRegistry.businessId, profile.id)
        ));

      res.json(run);
    } catch (error: any) {
      console.error("[Agents] Error recording run:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Complete an agent run
  app.patch("/api/agents/runs/:runId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const { agentRegistry, agentRuns } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      const { runId } = req.params;
      const { status, error, result, itemsProcessed, timeSavedMinutes, cashAcceleratedCents, revenueProtectedCents } = req.body;
      
      const [run] = await db
        .select()
        .from(agentRuns)
        .where(and(
          eq(agentRuns.runId, runId),
          eq(agentRuns.businessId, profile.id)
        ))
        .limit(1);

      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - new Date(run.startedAt).getTime();

      const [updatedRun] = await db
        .update(agentRuns)
        .set({
          status,
          completedAt,
          durationMs,
          error,
          result,
          itemsProcessed: itemsProcessed || 0,
          timeSavedMinutes: timeSavedMinutes || 0,
          cashAcceleratedCents: cashAcceleratedCents || 0,
          revenueProtectedCents: revenueProtectedCents || 0,
        })
        .where(and(
          eq(agentRuns.runId, runId),
          eq(agentRuns.businessId, profile.id)
        ))
        .returning();

      // Update agent metrics based on run result
      const [agent] = await db
        .select()
        .from(agentRegistry)
        .where(and(
          eq(agentRegistry.id, run.agentId),
          eq(agentRegistry.businessId, profile.id)
        ))
        .limit(1);

      if (agent) {
        const updates: any = { updatedAt: new Date() };
        
        if (status === "success") {
          updates.lastSuccessAt = completedAt;
          updates.failureStreak = 0;
          updates.timeSavedMinutes = (agent.timeSavedMinutes || 0) + (timeSavedMinutes || 0);
          updates.cashAcceleratedCents = (agent.cashAcceleratedCents || 0) + (cashAcceleratedCents || 0);
          updates.revenueProtectedCents = (agent.revenueProtectedCents || 0) + (revenueProtectedCents || 0);
        } else if (status === "failed") {
          updates.lastErrorAt = completedAt;
          updates.lastError = error;
          updates.failureStreak = (agent.failureStreak || 0) + 1;
        }

        await db
          .update(agentRegistry)
          .set(updates)
          .where(and(
            eq(agentRegistry.id, agent.id),
            eq(agentRegistry.businessId, profile.id)
          ));
      }

      res.json(updatedRun);
    } catch (error: any) {
      console.error("[Agents] Error completing run:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // SMS Intelligence Layer Routes
  // ============================================

  const smsModule = await import("./sms");

  app.post("/sms/inbound", async (req, res) => {
    try {
      const { From, To, Body, MessageSid, AccountSid, NumMedia } = req.body;
      
      if (!From || !Body) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`[SMS] Inbound from ${From}: ${Body.substring(0, 50)}...`);

      const businessId = 1;
      const accountId = AccountSid || "test_account";
      const profile = await storage.getBusinessProfile(businessId);
      const businessName = profile?.name || "LawnFlow";

      const existingSession = await storage.getSmsSessionByPhone(From);
      
      let sessionData: any = null;
      if (existingSession) {
        sessionData = {
          sessionId: existingSession.sessionId,
          accountId: existingSession.accountId,
          businessId: existingSession.businessId || businessId,
          fromPhone: existingSession.fromPhone,
          toPhone: existingSession.toPhone,
          status: existingSession.status,
          serviceTemplateId: existingSession.serviceTemplateId,
          state: existingSession.state,
          attemptCounters: (existingSession.attemptCounters as Record<string, number>) || {},
          confidence: (existingSession.confidence as Record<string, number>) || {},
          collected: (existingSession.collected as Record<string, any>) || {},
          derived: (existingSession.derived as Record<string, any>) || {},
          quote: (existingSession.quote as Record<string, any>) || {},
          scheduling: (existingSession.scheduling as Record<string, any>) || {},
          handoff: (existingSession.handoff as Record<string, any>) || {},
          audit: (existingSession.audit as Record<string, any>) || {},
        };
      }

      const result = await smsModule.handleInboundSms(
        {
          accountId,
          businessId,
          fromPhone: From,
          toPhone: To || "",
          text: Body,
          providerMessageId: MessageSid,
          providerPayload: req.body,
        },
        sessionData,
        businessName
      );

      await storage.upsertSmsSession({
        sessionId: result.session.sessionId || "",
        accountId: result.session.accountId || accountId,
        businessId: result.session.businessId || businessId,
        fromPhone: result.session.fromPhone || From,
        toPhone: result.session.toPhone || To || "",
        status: result.session.status || "active",
        serviceTemplateId: result.session.serviceTemplateId || "lawncare_v1",
        state: result.session.state || "INTENT",
        attemptCounters: result.session.attemptCounters || {},
        confidence: result.session.confidence || {},
        collected: result.session.collected || {},
        derived: result.session.derived || {},
        quote: result.session.quote || {},
        scheduling: result.session.scheduling || {},
        handoff: result.session.handoff || {},
        audit: result.session.audit || {},
      });

      await storage.createSmsEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId: result.session.sessionId || "",
        direction: "inbound",
        providerMessageId: MessageSid,
        text: Body,
        payloadJson: req.body,
        stateBefore: result.stateTransition?.from,
        stateAfter: result.stateTransition?.to || result.session.state,
      });

      for (const action of result.actions) {
        if (action.type === "create_handoff_ticket") {
          const reasons = smsModule.determineHandoffReasons({
            derived: (result.session.derived || {}) as Record<string, any>,
            state: result.session.state || "",
            attemptCounters: (result.session.attemptCounters || {}) as Record<string, number>,
          });
          const priority = smsModule.determinePriority(reasons, { derived: result.session.derived || {} });
          const summary = smsModule.generateHandoffSummary({
            fromPhone: From,
            collected: result.session.collected || {},
            derived: result.session.derived || {},
            state: result.session.state || "",
          }, reasons);
          
          await storage.createHandoffTicket({
            ticketId: `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sessionId: result.session.sessionId || "",
            accountId,
            businessId,
            status: "open",
            priority,
            reasonCodes: reasons,
            summary,
          });
        }

        if (action.type === "generate_click_to_call_token") {
          const tokenData = smsModule.generateClickToCallToken(result.session.sessionId || "");
          await storage.createClickToCallToken({
            tokenId: tokenData.tokenId,
            sessionId: result.session.sessionId || "",
            token: tokenData.token,
            expiresAt: tokenData.expiresAt,
          });
        }
      }

      for (const outbound of result.outboundMessages) {
        await twilioConnector.sendSMS(outbound.to, outbound.text);
        
        await storage.createSmsEvent({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sessionId: result.session.sessionId || "",
          direction: "outbound",
          text: outbound.text,
          stateAfter: result.session.state,
        });
      }

      res.setHeader("Content-Type", "text/xml");
      res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    } catch (error: any) {
      console.error("[SMS] Error processing inbound:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/sms/status", async (req, res) => {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;
      console.log(`[SMS] Status update for ${MessageSid}: ${MessageStatus}`);
      
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("[SMS] Error processing status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/sms/click-to-call/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const tokenData = await storage.getClickToCallToken(token);
      
      if (!tokenData) {
        return res.status(404).json({ error: "Token not found or expired" });
      }

      if (new Date() > new Date(tokenData.expiresAt)) {
        return res.status(410).json({ error: "Token expired" });
      }

      if (tokenData.usedAt) {
        return res.status(410).json({ error: "Token already used" });
      }

      await storage.markClickToCallTokenUsed(token);

      const session = await storage.getSmsSessionById(tokenData.sessionId);
      const businessProfile = session?.businessId 
        ? await storage.getBusinessProfile(session.businessId) 
        : null;

      const businessPhone = businessProfile?.phone || "+15551234567";

      await storage.createCallEvent({
        callEventId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId: tokenData.sessionId,
        type: "click",
        metadataJson: { token, userAgent: req.headers["user-agent"] },
      });

      res.redirect(`tel:${businessPhone}`);
    } catch (error: any) {
      console.error("[SMS] Error processing click-to-call:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sms/sessions", async (req, res) => {
    try {
      const sessions = await storage.getSmsSessions();
      res.json(sessions);
    } catch (error: any) {
      console.error("[SMS] Error fetching sessions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sms/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getSmsSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const events = await storage.getSmsEventsBySession(sessionId);
      
      res.json({ session, events });
    } catch (error: any) {
      console.error("[SMS] Error fetching session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sms/handoff-tickets", async (req, res) => {
    try {
      const tickets = await storage.getHandoffTickets();
      res.json(tickets);
    } catch (error: any) {
      console.error("[SMS] Error fetching tickets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sms/handoff-tickets/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status, assignedTo } = req.body;
      
      const ticket = await storage.updateHandoffTicket(ticketId, { status, assignedTo });
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      res.json(ticket);
    } catch (error: any) {
      console.error("[SMS] Error updating ticket:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sms/test-session", async (req, res) => {
    try {
      const { fromPhone, text, businessName } = req.body;
      
      if (!fromPhone || !text) {
        return res.status(400).json({ error: "fromPhone and text are required" });
      }

      const existingSession = await storage.getSmsSessionByPhone(fromPhone);
      
      let sessionData: any = null;
      if (existingSession) {
        sessionData = {
          sessionId: existingSession.sessionId,
          accountId: existingSession.accountId,
          businessId: existingSession.businessId || 1,
          fromPhone: existingSession.fromPhone,
          toPhone: existingSession.toPhone,
          status: existingSession.status,
          serviceTemplateId: existingSession.serviceTemplateId,
          state: existingSession.state,
          attemptCounters: (existingSession.attemptCounters as Record<string, number>) || {},
          confidence: (existingSession.confidence as Record<string, number>) || {},
          collected: (existingSession.collected as Record<string, any>) || {},
          derived: (existingSession.derived as Record<string, any>) || {},
          quote: (existingSession.quote as Record<string, any>) || {},
          scheduling: (existingSession.scheduling as Record<string, any>) || {},
          handoff: (existingSession.handoff as Record<string, any>) || {},
          audit: (existingSession.audit as Record<string, any>) || {},
        };
      }

      const result = await smsModule.handleInboundSms(
        {
          accountId: "test_account",
          businessId: 1,
          fromPhone,
          toPhone: "+15559999999",
          text,
        },
        sessionData,
        businessName || "Test Lawn Co"
      );

      await storage.upsertSmsSession({
        sessionId: result.session.sessionId || "",
        accountId: result.session.accountId || "test_account",
        businessId: result.session.businessId || 1,
        fromPhone: result.session.fromPhone || fromPhone,
        toPhone: result.session.toPhone || "+15559999999",
        status: result.session.status || "active",
        serviceTemplateId: result.session.serviceTemplateId || "lawncare_v1",
        state: result.session.state || "INTENT",
        attemptCounters: result.session.attemptCounters || {},
        confidence: result.session.confidence || {},
        collected: result.session.collected || {},
        derived: result.session.derived || {},
        quote: result.session.quote || {},
        scheduling: result.session.scheduling || {},
        handoff: result.session.handoff || {},
        audit: result.session.audit || {},
      });

      res.json({
        session: result.session,
        outboundMessages: result.outboundMessages,
        stateTransition: result.stateTransition,
        actions: result.actions.map(a => a.type),
      });
    } catch (error: any) {
      console.error("[SMS] Test session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
