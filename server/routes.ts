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
