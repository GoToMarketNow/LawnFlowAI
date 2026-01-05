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
import onboardingRoutes from "./onboarding/routes";
import { z } from "zod";
import { 
  getEligibleCrews, 
  filterEligibleCrewsWithThresholds, 
  DEFAULT_THRESHOLDS,
  type EligibleCrew,
  type EligibilityThresholds 
} from "./agents/crewIntelligence";
import { evaluateFeasibility, type FeasibilityResult } from "./agents/jobFeasibility";
import { getCrewToJobTravelMinutes, type TravelEstimate } from "./agents/routeCost";
import { computeMarginScore, type MarginBurnResult } from "./agents/marginBurn";
import { runSimulations, type SimulationResult } from "./agents/simulationRanking";
import { 
  createDecision as orchestratorCreateDecision, 
  approveDecision as orchestratorApproveDecision,
  type OrchestratorConfig 
} from "./agents/orchestrator";
import {
  startOrchestration,
  runNextStep,
  handleInboundMessage,
  handleOpsApproval,
  handleOpsOverride,
  getOrchestrationRun,
  getRunsForJobRequest,
} from "./orchestrator/leadToCash";
import { db } from "./db";
import { 
  orchestrationRuns, 
  orchestrationSteps, 
  jobRequests,
  agentRuns,
  agentRegistry,
  reconciliationAlerts,
  deadLetterQueue,
  customerProfiles,
  customerMemories,
  scheduleItems,
  decisionLogs,
  humanActionLogs,
  outcomeLogs,
  policyVersions,
  policyTuningSuggestions,
  killSwitches,
} from "@shared/schema";
import { eq, desc, and, sql, or, isNull, gte } from "drizzle-orm";
import {
  startOrchestrationInputSchema,
  opsApprovalInputSchema,
  opsOverrideInputSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============================================
  // Authentication Routes (2FA)
  // ============================================
  registerAuthRoutes(app);

  // ============================================
  // Onboarding Routes
  // ============================================
  app.use("/api/onboarding", onboardingRoutes);

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
  // Global Search API
  // ============================================

  app.get("/api/search", async (req, res) => {
    try {
      const query = (req.query.query as string || "").toLowerCase().trim();
      
      if (query.length < 2) {
        return res.json([]);
      }

      const results: Array<{
        id: string;
        type: 'customer' | 'job' | 'quote';
        title: string;
        subtitle?: string;
        href: string;
      }> = [];

      // Search leads as "customers"
      try {
        const leads = await storage.getLeads();
        const matchingLeads = leads.filter(l => 
          l.customerName?.toLowerCase().includes(query) ||
          l.customerPhone?.includes(query) ||
          l.customerEmail?.toLowerCase().includes(query)
        ).slice(0, 5);

        for (const lead of matchingLeads) {
          results.push({
            id: String(lead.id),
            type: 'customer',
            title: lead.customerName || 'Unknown Customer',
            subtitle: lead.customerPhone || lead.customerEmail || undefined,
            href: `/customers/${lead.id}`,
          });
        }
      } catch (e) {
        console.warn("[Search] Could not search leads:", e);
      }

      // Search jobs
      try {
        const jobs = await storage.getJobs();
        const matchingJobs = jobs.filter(j => 
          j.customerName?.toLowerCase().includes(query) ||
          j.customerPhone?.includes(query) ||
          j.serviceType?.toLowerCase().includes(query)
        ).slice(0, 5);

        for (const job of matchingJobs) {
          results.push({
            id: String(job.id),
            type: 'job',
            title: job.customerName || 'Unknown Job',
            subtitle: job.serviceType || undefined,
            href: `/jobs?id=${job.id}`,
          });
        }
      } catch (e) {
        console.warn("[Search] Could not search jobs:", e);
      }

      // Search quote proposals
      try {
        const profile = await storage.getBusinessProfile();
        const businessId = profile?.id || 1;
        const quotes = await storage.getQuoteProposals(businessId);
        const matchingQuotes = (quotes || []).filter(q => 
          q.customerName?.toLowerCase().includes(query) ||
          q.customerPhone?.includes(query)
        ).slice(0, 5);

        for (const quote of matchingQuotes) {
          results.push({
            id: String(quote.id),
            type: 'quote',
            title: quote.customerName || 'Unknown Quote',
            subtitle: quote.status ? `$${(quote.totalCents || 0) / 100} - ${quote.status}` : undefined,
            href: `/quotes?id=${quote.id}`,
          });
        }
      } catch (e) {
        console.warn("[Search] Could not search quotes:", e);
      }

      res.json(results.slice(0, 10));
    } catch (error: any) {
      console.error("[Search] Error:", error);
      res.json([]); // Return empty array instead of 500
    }
  });

  // ============================================
  // System Health API
  // ============================================

  app.get("/api/system/health", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { agentRegistry } = await import("@shared/schema");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.json({
          status: 'healthy',
          activeAgents: 0,
          totalAgents: 0,
          lastCheck: new Date().toISOString(),
        });
      }

      const agents = await db
        .select()
        .from(agentRegistry)
        .where(eq(agentRegistry.businessId, profile.id));

      const activeCount = agents.filter(a => a.status === "active").length;
      const errorCount = agents.filter(a => a.status === "error").length;
      
      let status: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (errorCount > 0 && errorCount < agents.length / 2) {
        status = 'degraded';
      } else if (errorCount >= agents.length / 2) {
        status = 'down';
      }

      res.json({
        status,
        activeAgents: activeCount,
        totalAgents: agents.length,
        lastCheck: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[System Health] Error:", error);
      res.json({
        status: 'degraded',
        activeAgents: 0,
        totalAgents: 0,
        lastCheck: new Date().toISOString(),
      });
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
        billing: {
          useQuickBooks: profile.useQuickBooks,
          quickBooksConnected: profile.quickBooksConnected,
          invoiceTerms: profile.invoiceTerms,
          defaultTaxRate: profile.defaultTaxRate,
          taxEnabled: profile.taxEnabled,
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
      
      // Billing
      if (req.body.billing) {
        const bill = req.body.billing;
        if (bill.useQuickBooks !== undefined) updates.useQuickBooks = bill.useQuickBooks;
        if (bill.quickBooksConnected !== undefined) updates.quickBooksConnected = bill.quickBooksConnected;
        if (bill.invoiceTerms !== undefined) updates.invoiceTerms = bill.invoiceTerms;
        if (bill.defaultTaxRate !== undefined) updates.defaultTaxRate = bill.defaultTaxRate;
        if (bill.taxEnabled !== undefined) updates.taxEnabled = bill.taxEnabled;
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
  // Quotes Routes (stub)
  // ============================================

  app.get("/api/quotes", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      const quotes = jobs
        .filter((job) => job.estimatedPrice && job.estimatedPrice > 0)
        .map((job) => {
          let status: string = "draft";
          const notes = job.notes || "";
          const needsApproval = notes.includes("Needs Approval: true");
          
          if (job.status === "scheduled" || job.status === "completed") {
            status = "accepted";
          } else if (notes.includes("SENT")) {
            status = "sent";
          } else if (needsApproval) {
            status = "awaiting_approval";
          }
          
          const servicesMatch = notes.match(/Services: ([^\n]+)/);
          const services = servicesMatch 
            ? servicesMatch[1].split(", ").map(s => s.trim())
            : [job.serviceType];
          
          const frequencyMatch = notes.match(/Frequency: ([^\n]+)/);
          const frequency = frequencyMatch ? frequencyMatch[1].trim() : null;
          
          const priceRangeMatch = notes.match(/Price Range: \$([0-9.]+) - \$([0-9.]+)/);
          const amountLow = priceRangeMatch ? Math.round(parseFloat(priceRangeMatch[1]) * 100) : null;
          const amountHigh = priceRangeMatch ? Math.round(parseFloat(priceRangeMatch[2]) * 100) : null;
          
          return {
            id: job.id,
            customerName: job.customerName || "Unknown Customer",
            customerPhone: job.customerPhone,
            customerAddress: job.customerAddress,
            amount: job.estimatedPrice || 0,
            amountLow,
            amountHigh,
            status,
            services,
            frequency,
            createdAt: job.createdAt,
            expiresAt: null,
          };
        });
      res.json({ quotes });
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes/:id/send", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Quote not found" });
      }
      const newNotes = (job.notes || "") + `\nSENT: ${new Date().toISOString()}`;
      await storage.updateJob(id, { notes: newNotes });
      res.json({ success: true, message: "Quote sent successfully" });
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      
      if (!user || (user.role !== "owner" && user.role !== "admin")) {
        return res.status(403).json({ error: "Only owners/admins can approve quotes" });
      }
      
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      let newNotes = (job.notes || "").replace("Needs Approval: true", "Needs Approval: false");
      newNotes += `\nAPPROVED: ${new Date().toISOString()} by ${user.email || user.id}`;
      
      await storage.updateJob(id, { notes: newNotes });
      
      res.json({ success: true, message: "Quote approved" });
    } catch (error) {
      console.error("Error approving quote:", error);
      res.status(500).json({ error: "Failed to approve quote" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      // Validate ID is a purely numeric string before parsing
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }
      
      const id = parseInt(req.params.id, 10);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const notes = job.notes || "";
      const needsApproval = notes.includes("Needs Approval: true");
      const isSent = notes.includes("SENT");
      
      let status: string = "draft";
      if (job.status === "scheduled" || job.status === "completed") {
        status = "accepted";
      } else if (isSent) {
        status = "sent";
      } else if (needsApproval) {
        status = "awaiting_approval";
      }
      
      const servicesMatch = notes.match(/Services: ([^\n]+)/);
      const services = servicesMatch 
        ? servicesMatch[1].split(", ").map(s => s.trim())
        : [job.serviceType];
      
      const frequencyMatch = notes.match(/Frequency: ([^\n]+)/);
      const frequency = frequencyMatch ? frequencyMatch[1].trim() : null;
      
      const lotSizeMatch = notes.match(/Lot Size: ([0-9]+)/);
      const lotSize = lotSizeMatch ? parseInt(lotSizeMatch[1]) : null;
      
      const priceRangeMatch = notes.match(/Price Range: \$([0-9.]+) - \$([0-9.]+)/);
      const amountLow = priceRangeMatch ? Math.round(parseFloat(priceRangeMatch[1]) * 100) : null;
      const amountHigh = priceRangeMatch ? Math.round(parseFloat(priceRangeMatch[2]) * 100) : null;
      
      const auditTrail = [
        { id: 1, action: "Quote Created", createdAt: job.createdAt },
      ];
      
      if (notes.includes("APPROVED:")) {
        const approvedMatch = notes.match(/APPROVED: ([^\n]+)/);
        if (approvedMatch) {
          auditTrail.push({ id: 2, action: "Quote Approved", createdAt: approvedMatch[1] });
        }
      }
      
      if (isSent) {
        const sentMatch = notes.match(/SENT: ([^\n]+)/);
        if (sentMatch) {
          auditTrail.push({ id: 3, action: "Quote Sent", createdAt: sentMatch[1] });
        }
      }
      
      const quote = {
        id: job.id,
        customerName: job.customerName || "Unknown Customer",
        customerPhone: job.customerPhone,
        customerAddress: job.customerAddress,
        amount: job.estimatedPrice || 0,
        amountLow,
        amountHigh,
        status,
        services,
        frequency,
        lotSize,
        assumptions: lotSize ? [] : ["Lot size estimated based on typical residential property"],
        createdAt: job.createdAt,
        auditTrail,
      };
      
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes/quick", async (req, res) => {
    try {
      const user = (req as any).user;
      const { customerName, customerPhone, customerAddress, services, frequency, propertySize, notes } = req.body;
      
      if (!customerName) {
        return res.status(400).json({ error: "Customer name is required" });
      }
      if (!services || services.length === 0) {
        return res.status(400).json({ error: "At least one service is required" });
      }

      const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";
      
      const lotSizeMap: Record<string, number> = {
        xs: 3000,
        small: 7500,
        medium: 15000,
        large: 30000,
        xl: 35000,
        xxl: 60000,
        unknown: 10000,
      };
      const lotSizeSqft = lotSizeMap[propertySize] || 10000;
      
      const baseMinutes: Record<string, number> = {
        mowing: 30,
        cleanup: 60,
        mulch: 90,
        landscaping: 120,
        irrigation: 45,
        trimming: 30,
        other: 45,
      };
      
      const hourlyRate = 60;
      let totalMinutesLow = 0;
      let totalMinutesHigh = 0;
      
      for (const service of services) {
        const base = baseMinutes[service] || 45;
        const sizeMultiplier = lotSizeSqft / 10000;
        totalMinutesLow += base * sizeMultiplier * 0.8;
        totalMinutesHigh += base * sizeMultiplier * 1.3;
      }
      
      const frequencyMultipliers: Record<string, number> = {
        weekly: 0.85,
        biweekly: 0.95,
        monthly: 1.0,
        one_time: 1.15,
      };
      const freqMult = frequencyMultipliers[frequency] || 1.0;
      
      const priceLow = Math.round((totalMinutesLow / 60) * hourlyRate * freqMult * 100);
      const priceHigh = Math.round((totalMinutesHigh / 60) * hourlyRate * freqMult * 100);
      const priceAvg = Math.round((priceLow + priceHigh) / 2);
      
      const job = await storage.createJob({
        customerName,
        customerPhone: customerPhone || "N/A",
        customerAddress: customerAddress || null,
        serviceType: services[0] || "other",
        estimatedPrice: priceAvg,
        status: "pending",
        notes: notes ? `${notes}\n\nServices: ${services.join(", ")}\nFrequency: ${frequency}\nProperty Size: ${propertySize}\nLot Size: ${lotSizeSqft} sq ft\nPrice Range: $${(priceLow/100).toFixed(2)} - $${(priceHigh/100).toFixed(2)}\nNeeds Approval: ${!isOwnerOrAdmin}` : `Services: ${services.join(", ")}\nFrequency: ${frequency}\nProperty Size: ${propertySize}\nLot Size: ${lotSizeSqft} sq ft\nPrice Range: $${(priceLow/100).toFixed(2)} - $${(priceHigh/100).toFixed(2)}\nNeeds Approval: ${!isOwnerOrAdmin}`,
      });
      
      res.json({ 
        success: true, 
        quote: {
          id: job.id,
          customerName,
          amount: priceAvg,
          amountLow: priceLow,
          amountHigh: priceHigh,
          status: isOwnerOrAdmin ? "draft" : "awaiting_approval",
          services,
        },
        message: isOwnerOrAdmin ? "Quote created" : "Quote submitted for approval",
      });
    } catch (error) {
      console.error("Error creating quick quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
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

  app.get("/api/unified-feed", async (req, res) => {
    try {
      const { channel, customerType, status } = req.query;
      
      const [events, conversations, smsSessions] = await Promise.all([
        storage.getEvents(),
        storage.getConversations(),
        storage.getSmsSessions(),
      ]);

      type UnifiedItem = {
        id: string;
        type: "event" | "conversation" | "sms_session";
        channel: "phone" | "sms" | "web";
        customerType: "prospect" | "customer";
        status: string;
        customerName: string | null;
        customerPhone: string | null;
        summary: string;
        createdAt: Date | null;
        updatedAt: Date | null;
        metadata: Record<string, any>;
      };

      const unifiedItems: UnifiedItem[] = [];

      for (const event of events) {
        const payload = (event.payload || {}) as Record<string, any>;
        let eventChannel: "phone" | "sms" | "web" = "phone";
        if (event.type === "inbound_sms") eventChannel = "sms";
        if (event.type === "web_lead") eventChannel = "web";
        
        unifiedItems.push({
          id: `event_${event.id}`,
          type: "event",
          channel: eventChannel,
          customerType: "prospect",
          status: event.status,
          customerName: payload.name || null,
          customerPhone: payload.phone || payload.from || null,
          summary: payload.body || `${event.type} event`,
          createdAt: event.createdAt,
          updatedAt: null,
          metadata: { eventType: event.type, conversationId: event.conversationId, ...payload },
        });
      }

      for (const conv of conversations) {
        let convChannel: "phone" | "sms" | "web" = "phone";
        if (conv.source === "inbound_sms") convChannel = "sms";
        if (conv.source === "web_lead") convChannel = "web";
        
        const isCustomer = conv.status === "completed" || conv.status === "scheduled";
        
        unifiedItems.push({
          id: `conv_${conv.id}`,
          type: "conversation",
          channel: convChannel,
          customerType: isCustomer ? "customer" : "prospect",
          status: conv.status,
          customerName: conv.customerName,
          customerPhone: conv.customerPhone,
          summary: conv.agentType ? `${conv.agentType} conversation` : "Customer conversation",
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          metadata: { source: conv.source, agentType: conv.agentType },
        });
      }

      for (const session of smsSessions) {
        const collected = (session.collected || {}) as Record<string, any>;
        const derived = (session.derived || {}) as Record<string, any>;
        const isBooked = session.state === "BOOKED" || session.status === "completed";
        
        let summary = "SMS lead conversation";
        if (collected.intent === "recurring") summary = "Recurring service inquiry";
        if (collected.intent === "one_time") summary = "One-time service inquiry";
        if (derived.address_one_line) summary = `${summary} - ${derived.address_one_line}`;
        
        unifiedItems.push({
          id: `sms_${session.id}`,
          type: "sms_session",
          channel: "sms",
          customerType: isBooked ? "customer" : "prospect",
          status: session.status,
          customerName: null,
          customerPhone: session.fromPhone,
          summary,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metadata: { 
            sessionId: session.sessionId, 
            state: session.state, 
            collected, 
            derived,
            serviceTemplateId: session.serviceTemplateId,
          },
        });
      }

      let filtered = unifiedItems;
      
      if (channel && channel !== "all") {
        filtered = filtered.filter(item => item.channel === channel);
      }
      if (customerType && customerType !== "all") {
        filtered = filtered.filter(item => item.customerType === customerType);
      }
      if (status && status !== "all") {
        filtered = filtered.filter(item => item.status === status);
      }

      filtered.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      const stats = {
        total: unifiedItems.length,
        byChannel: {
          phone: unifiedItems.filter(i => i.channel === "phone").length,
          sms: unifiedItems.filter(i => i.channel === "sms").length,
          web: unifiedItems.filter(i => i.channel === "web").length,
        },
        byCustomerType: {
          prospect: unifiedItems.filter(i => i.customerType === "prospect").length,
          customer: unifiedItems.filter(i => i.customerType === "customer").length,
        },
        byStatus: {
          active: unifiedItems.filter(i => ["active", "pending", "processing"].includes(i.status)).length,
          completed: unifiedItems.filter(i => i.status === "completed").length,
          handoff: unifiedItems.filter(i => i.status === "handoff").length,
        },
      };

      res.json({ items: filtered, stats });
    } catch (error: any) {
      console.error("Error fetching unified feed:", error);
      res.status(500).json({ error: error.message });
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

  // Twilio SMS delivery status webhook
  app.post("/api/webhooks/twilio/status", async (req, res) => {
    try {
      const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;
      
      if (!MessageSid || !MessageStatus) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Validate Twilio signature in production
      const signature = req.headers["x-twilio-signature"] as string | undefined;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      
      const isValid = await twilioConnector.validateSignature(signature, url, req.body);
      if (!isValid) {
        console.warn("[Twilio Status] Invalid signature, rejecting webhook");
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      const status = await twilioConnector.handleDeliveryStatus({
        MessageSid,
        MessageStatus,
        To,
        ErrorCode,
        ErrorMessage,
      });
      
      console.log(`[Twilio Status] ${MessageSid}: ${MessageStatus}`);
      
      res.status(200).json({ acknowledged: true, status: status.status });
    } catch (error) {
      console.error("Error handling Twilio status webhook:", error);
      res.status(500).json({ error: "Status processing failed" });
    }
  });

  // Twilio message queue stats endpoint
  app.get("/api/twilio/queue-stats", async (req, res) => {
    try {
      const stats = twilioConnector.getQueueStats();
      const recentMessages = twilioConnector.getRecentMessages(20);
      const isConfigured = await twilioConnector.isRealTwilioConfigured();
      
      res.json({
        configured: isConfigured,
        messagingServiceReady: twilioConnector.isMessagingServiceReady(),
        stats,
        recentMessages: recentMessages.map(m => ({
          sid: m.sid,
          to: m.to.slice(0, -4).replace(/\d/g, '*') + m.to.slice(-4),
          status: m.status,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error("[Twilio] Error getting queue stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Jobber OAuth Flow Routes
  // ============================================
  
  // In-memory OAuth state store with expiration (production should use Redis/DB)
  const oauthStateStore: Map<string, { businessId: number; userId: number; expiresAt: number }> = new Map();
  
  // Cleanup expired states periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of oauthStateStore.entries()) {
      if (value.expiresAt < now) {
        oauthStateStore.delete(key);
      }
    }
  }, 60 * 1000); // Clean every minute

  app.get("/api/jobber/oauth/authorize", (req, res) => {
    // Require authentication
    if (!req.isAuthenticated?.() || !(req.user as any)?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const clientId = process.env.JOBBER_CLIENT_ID;
    const redirectUri = process.env.JOBBER_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/jobber/oauth/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: "JOBBER_CLIENT_ID not configured" });
    }
    
    const scopes = [
      "read_clients", "write_clients",
      "read_jobs", "write_jobs",
      "read_quotes", "write_quotes",
      "read_invoices", "write_invoices",
      "read_properties", "write_properties",
      "read_visits", "write_visits",
      "read_users",
      "read_webhooks", "write_webhooks",
    ].join(" ");
    
    // Generate cryptographically secure state token
    const stateNonce = require('crypto').randomBytes(32).toString('hex');
    const businessId = (req.user as any).businessId;
    const userId = (req.user as any).id;
    
    // Store state with 10 minute expiration
    oauthStateStore.set(stateNonce, {
      businessId,
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    
    const authUrl = new URL("https://api.getjobber.com/api/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", stateNonce);
    
    res.json({ 
      authorizationUrl: authUrl.toString(),
      redirectUri,
    });
  });

  app.get("/api/jobber/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error("[Jobber OAuth] Authorization denied:", error);
      return res.redirect(`/settings?jobber_error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code) {
      return res.redirect("/settings?jobber_error=no_code");
    }
    
    if (!state || typeof state !== 'string') {
      console.error("[Jobber OAuth] Missing state parameter");
      return res.redirect("/settings?jobber_error=invalid_state");
    }
    
    // Validate state against stored nonce
    const storedState = oauthStateStore.get(state);
    if (!storedState) {
      console.error("[Jobber OAuth] Invalid or expired state token");
      return res.redirect("/settings?jobber_error=invalid_state");
    }
    
    if (storedState.expiresAt < Date.now()) {
      oauthStateStore.delete(state);
      console.error("[Jobber OAuth] State token expired");
      return res.redirect("/settings?jobber_error=state_expired");
    }
    
    // Remove used state (single-use)
    oauthStateStore.delete(state);
    const { businessId } = storedState;
    
    try {
      const clientId = process.env.JOBBER_CLIENT_ID;
      const clientSecret = process.env.JOBBER_CLIENT_SECRET;
      const redirectUri = process.env.JOBBER_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/jobber/oauth/callback`;
      
      // Exchange code for tokens
      const tokenResponse = await fetch("https://api.getjobber.com/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code as string,
        }),
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      // Get account info from Jobber
      const accountResponse = await fetch("https://api.getjobber.com/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenData.access_token}`,
          "X-JOBBER-GRAPHQL-VERSION": "2024-06-24",
        },
        body: JSON.stringify({
          query: `query { account { id name } }`,
        }),
      });
      
      let accountId = tokenData.resource_owner_id || `unknown_${Date.now()}`;
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        if (accountData.data?.account?.id) {
          accountId = accountData.data.account.id;
        }
      }
      
      // Save to database
      const { saveJobberAccount } = await import("./connectors/jobber-client");
      await saveJobberAccount({
        jobberAccountId: accountId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scopes: tokenData.scope?.split(" "),
        businessId,
      });
      
      console.log(`[Jobber OAuth] Successfully connected account ${accountId} to business ${businessId}`);
      
      res.redirect("/settings?jobber_connected=true");
    } catch (error: any) {
      console.error("[Jobber OAuth] Error exchanging code:", error);
      res.redirect(`/settings?jobber_error=${encodeURIComponent(error.message)}`);
    }
  });

  app.delete("/api/jobber/oauth/disconnect", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { jobberAccounts } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      await db.update(jobberAccounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(jobberAccounts.businessId, businessId));
      
      res.json({ success: true, message: "Jobber account disconnected" });
    } catch (error: any) {
      console.error("[Jobber OAuth] Error disconnecting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobber/status", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { jobberAccounts } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      
      const [account] = await db.select({
        id: jobberAccounts.id,
        jobberAccountId: jobberAccounts.jobberAccountId,
        isActive: jobberAccounts.isActive,
        tokenExpiresAt: jobberAccounts.tokenExpiresAt,
        createdAt: jobberAccounts.createdAt,
      })
      .from(jobberAccounts)
      .where(and(
        eq(jobberAccounts.businessId, businessId),
        eq(jobberAccounts.isActive, true)
      ))
      .limit(1);
      
      res.json({
        connected: !!account,
        accountId: account?.jobberAccountId,
        tokenValid: account ? new Date(account.tokenExpiresAt) > new Date() : false,
        connectedAt: account?.createdAt,
      });
    } catch (error: any) {
      console.error("[Jobber] Error checking status:", error);
      res.status(500).json({ error: error.message });
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
  // Jobber Integration Stub Endpoints (MVP)
  // These prepare the system for real Jobber overlay integration
  // ============================================

  // Webhook receiver at the canonical integration path
  app.post("/api/integrations/jobber/webhook", async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { jobberWebhookProcessor } = await import("./connectors/jobber-webhook");
      const { jobberWebhookEvents } = await import("@shared/schema");
      const { db } = await import("./db");
      
      const payload = req.body;
      
      // For MVP stub: accept any payload and log it
      if (!payload.webhookEventId) {
        payload.webhookEventId = `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      if (!payload.accountId) {
        payload.accountId = "stub_account";
      }
      if (!payload.topic) {
        payload.topic = payload.event_type || "UNKNOWN";
      }
      
      // Log the event
      await db.insert(jobberWebhookEvents).values({
        webhookEventId: payload.webhookEventId,
        jobberAccountId: payload.accountId,
        topic: payload.topic,
        objectId: payload.resource_id || payload.objectId || "unknown",
        payload: payload,
        status: "received",
        receivedAt: new Date(),
      }).onConflictDoNothing();
      
      const elapsed = Date.now() - startTime;
      console.log(`[Jobber Integration] Webhook stub received ${payload.topic} in ${elapsed}ms`);
      
      res.status(200).json({ 
        acknowledged: true,
        stub: true,
        eventId: payload.webhookEventId,
        message: "Webhook received (stub mode)",
      });
    } catch (error) {
      console.error("[Jobber Integration] Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Refresh endpoint - stub for syncing data from Jobber
  app.post("/api/integrations/jobber/refresh", async (req, res) => {
    try {
      const { scheduleItems, crews, jobRequests, businessProfiles } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      // Get the business profile
      const [profile] = await db.select().from(businessProfiles).limit(1);
      if (!profile) {
        return res.status(404).json({ error: "No business profile found" });
      }
      
      // Get crews for this business
      const allCrews = await db.select().from(crews).where(eq(crews.businessId, profile.id));
      
      if (allCrews.length === 0) {
        return res.status(200).json({
          stub: true,
          message: "No crews found to seed schedule items",
          scheduleItemsCreated: 0,
        });
      }
      
      // Generate stub schedule items for the next 7 days
      const now = new Date();
      const scheduleItemsToCreate = [];
      
      for (const crew of allCrews) {
        // Create 2-4 jobs per day for each crew for the next 5 days
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const date = new Date(now);
          date.setDate(date.getDate() + dayOffset);
          date.setHours(8, 0, 0, 0);
          
          const jobsPerDay = 2 + Math.floor(Math.random() * 3); // 2-4 jobs
          
          for (let jobNum = 0; jobNum < jobsPerDay; jobNum++) {
            const startHour = 8 + jobNum * 2; // Jobs at 8am, 10am, 12pm, 2pm
            const durationMinutes = 45 + Math.floor(Math.random() * 60); // 45-105 min
            
            const startAt = new Date(date);
            startAt.setHours(startHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setMinutes(endAt.getMinutes() + durationMinutes);
            
            // Atlanta area coordinates with some variation
            const baseLat = 33.749;
            const baseLng = -84.388;
            const latOffset = (Math.random() - 0.5) * 0.2;
            const lngOffset = (Math.random() - 0.5) * 0.2;
            
            scheduleItemsToCreate.push({
              businessId: profile.id,
              externalProvider: "jobber",
              externalId: `jobber_visit_${crew.id}_${dayOffset}_${jobNum}`,
              crewId: crew.id,
              startAt,
              endAt,
              lat: baseLat + latOffset,
              lng: baseLng + lngOffset,
              address: `${1000 + jobNum * 100} Peachtree St, Atlanta, GA 30309`,
              description: `Lawn maintenance - Crew ${crew.name}`,
              status: "scheduled",
            });
          }
        }
      }
      
      // Insert schedule items (ignore duplicates by externalId)
      let created = 0;
      for (const item of scheduleItemsToCreate) {
        try {
          await db.insert(scheduleItems).values(item).onConflictDoNothing();
          created++;
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
      
      console.log(`[Jobber Integration] Refresh stub created ${created} schedule items for ${allCrews.length} crews`);
      
      res.json({
        stub: true,
        message: "Refresh completed (stub mode) - seeded schedule items",
        scheduleItemsCreated: created,
        crewsProcessed: allCrews.length,
      });
    } catch (error) {
      console.error("[Jobber Integration] Refresh error:", error);
      res.status(500).json({ error: "Refresh failed" });
    }
  });

  // Get connection status
  app.get("/api/integrations/jobber/status", async (req, res) => {
    try {
      const { jobberAccounts } = await import("@shared/schema");
      const { db } = await import("./db");
      
      const accounts = await db.select().from(jobberAccounts);
      
      res.json({
        connected: accounts.length > 0 && accounts.some(a => a.isActive),
        accountCount: accounts.length,
        stub: true,
        message: "Jobber integration in stub mode - ready for real connection",
      });
    } catch (error) {
      console.error("[Jobber Integration] Status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // ============================================
  // JobRequest Seed Endpoint (MVP Demo Data)
  // Creates 8 clustered JobRequests around Charlottesville area
  // ============================================

  app.post("/api/seed/job-requests", async (req, res) => {
    try {
      const { jobRequests, businessProfiles } = await import("@shared/schema");
      const { db } = await import("./db");

      // Get the business profile
      const [profile] = await db.select().from(businessProfiles).limit(1);
      if (!profile) {
        return res.status(404).json({ error: "No business profile found" });
      }

      // Charlottesville area clusters with coordinates
      const CLUSTERS = {
        cville_north: { center: { lat: 38.0550, lng: -78.4700 }, jitter: 0.015 },
        cville_uva: { center: { lat: 38.0336, lng: -78.5080 }, jitter: 0.012 },
        cville_east: { center: { lat: 38.0300, lng: -78.4400 }, jitter: 0.010 },
        hollymead: { center: { lat: 38.1100, lng: -78.4500 }, jitter: 0.020 },
        crozet: { center: { lat: 38.0700, lng: -78.7000 }, jitter: 0.025 },
        scottsville: { center: { lat: 37.8000, lng: -78.4900 }, jitter: 0.020 },
        stanardsville: { center: { lat: 38.3000, lng: -78.4400 }, jitter: 0.015 },
        ruckersville: { center: { lat: 38.2300, lng: -78.3700 }, jitter: 0.018 },
      };

      type ClusterKey = keyof typeof CLUSTERS;
      type Service = "mowing" | "edging" | "blowing" | "cleanup" | "shrub_trim" | "mulch";

      const SERVICE_SETS: Array<{
        services: Service[];
        frequency: string;
        lotSqft: number | null;
        lotConfidence: string;
      }> = [
        { services: ["mowing", "edging", "blowing"], frequency: "weekly", lotSqft: 6500, lotConfidence: "high" },
        { services: ["mowing", "edging"], frequency: "weekly", lotSqft: 16000, lotConfidence: "high" },
        { services: ["mowing"], frequency: "biweekly", lotSqft: 22000, lotConfidence: "medium" },
        { services: ["mowing", "blowing"], frequency: "weekly", lotSqft: 9000, lotConfidence: "high" },
        { services: ["cleanup"], frequency: "one_time", lotSqft: 20000, lotConfidence: "low" },
        { services: ["shrub_trim"], frequency: "one_time", lotSqft: 14000, lotConfidence: "low" },
        { services: ["mulch"], frequency: "one_time", lotSqft: 25000, lotConfidence: "medium" },
        { services: ["mowing", "cleanup"], frequency: "monthly", lotSqft: 52000, lotConfidence: "medium" },
      ];

      function deriveRequirements(services: Service[], lotSqft: number | null) {
        const requiredSkills = new Set<string>();
        const requiredEquipment = new Set<string>();
        let crewSizeMin = 1;

        const has = (s: Service) => services.includes(s);

        if (has("mowing")) {
          requiredSkills.add("mow");
          requiredEquipment.add("mower");
          if (lotSqft && lotSqft > 30000) requiredEquipment.add("rider_mower");
        }
        if (has("edging")) {
          requiredSkills.add("trim");
          requiredEquipment.add("edger_or_trimmer");
        }
        if (has("blowing")) {
          requiredSkills.add("cleanup");
          requiredEquipment.add("blower");
        }
        if (has("cleanup")) {
          requiredSkills.add("cleanup");
          requiredEquipment.add("blower");
          requiredEquipment.add("trailer");
          crewSizeMin = Math.max(crewSizeMin, 2);
        }
        if (has("shrub_trim")) {
          requiredSkills.add("shrub_trim");
          requiredEquipment.add("hedge_trimmer");
          crewSizeMin = Math.max(crewSizeMin, 2);
        }
        if (has("mulch")) {
          requiredSkills.add("mulch");
          requiredEquipment.add("trailer");
          crewSizeMin = Math.max(crewSizeMin, 2);
        }

        const band =
          lotSqft == null
            ? "unknown"
            : lotSqft <= 10000
            ? "small"
            : lotSqft <= 20000
            ? "medium"
            : lotSqft <= 43560
            ? "large"
            : "xlarge";

        const base = {
          small: { low: 35, high: 55 },
          medium: { low: 50, high: 80 },
          large: { low: 70, high: 110 },
          xlarge: { low: 95, high: 160 },
          unknown: { low: 60, high: 130 },
        }[band];

        let extraLow = 0;
        let extraHigh = 0;
        if (has("cleanup")) { extraLow += 40; extraHigh += 90; }
        if (has("shrub_trim")) { extraLow += 25; extraHigh += 70; }
        if (has("mulch")) { extraLow += 60; extraHigh += 140; }

        return {
          requiredSkills: [...requiredSkills],
          requiredEquipment: [...requiredEquipment],
          crewSizeMin,
          laborLowMinutes: base.low + extraLow,
          laborHighMinutes: base.high + extraHigh,
        };
      }

      function clusterToZip(clusterKey: ClusterKey): string {
        const zipMap: Record<ClusterKey, string> = {
          cville_north: "22901",
          cville_uva: "22903",
          cville_east: "22911",
          crozet: "22932",
          scottsville: "24590",
          hollymead: "22911",
          stanardsville: "22973",
          ruckersville: "22968",
        };
        return zipMap[clusterKey] || "22901";
      }

      const clusterKeys: ClusterKey[] = [
        "cville_north", "cville_uva", "cville_east", "hollymead",
        "crozet", "scottsville", "stanardsville", "ruckersville",
      ];

      const fakeNames = [
        "Jamie Parker", "Casey Nguyen", "Taylor Reed", "Morgan Hill",
        "Jordan Patel", "Riley Chen", "Avery Brooks", "Sam Wilson",
      ];

      const streets = ["Oak", "Maple", "Pine", "Cedar", "Ridge", "Park", "Grove", "Hill"];
      const suffixes = ["St", "Ave", "Rd", "Ln", "Dr", "Ct"];
      const phoneBase = 4345550200;

      let created = 0;
      for (let i = 0; i < 8; i++) {
        const profile_data = SERVICE_SETS[i];
        const clusterKey = clusterKeys[i % clusterKeys.length];
        const cluster = CLUSTERS[clusterKey];
        
        // Jitter the coordinates
        const lat = cluster.center.lat + (Math.random() - 0.5) * cluster.jitter * 2;
        const lng = cluster.center.lng + (Math.random() - 0.5) * cluster.jitter * 2;
        const zip = clusterToZip(clusterKey);

        const req = deriveRequirements(profile_data.services, profile_data.lotSqft);

        const addressNum = 120 + Math.floor(Math.random() * 850);
        const street = streets[Math.floor(Math.random() * streets.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

        const locality =
          clusterKey === "crozet" ? "Crozet, VA"
          : clusterKey === "scottsville" ? "Scottsville, VA"
          : clusterKey === "stanardsville" ? "Stanardsville, VA"
          : clusterKey === "ruckersville" ? "Ruckersville, VA"
          : "Charlottesville, VA";

        try {
          await db.insert(jobRequests).values({
            businessId: profile.id,
            customerName: fakeNames[i],
            customerPhone: `+1${phoneBase + i}`,
            address: `${addressNum} ${street} ${suffix}, ${locality} ${zip}`,
            lat,
            lng,
            zip,
            servicesJson: profile_data.services,
            frequency: profile_data.frequency,
            lotAreaSqft: profile_data.lotSqft,
            lotConfidence: profile_data.lotConfidence,
            requiredSkillsJson: req.requiredSkills,
            requiredEquipmentJson: req.requiredEquipment,
            crewSizeMin: req.crewSizeMin,
            laborLowMinutes: req.laborLowMinutes,
            laborHighMinutes: req.laborHighMinutes,
            status: "new",
          });
          created++;
        } catch (e) {
          console.log(`[Seed] JobRequest ${i} already exists or error:`, e);
        }
      }

      console.log(`[Seed] Created ${created} clustered JobRequests for simulations`);

      res.json({
        success: true,
        message: `Created ${created} clustered JobRequests`,
        jobRequestsCreated: created,
      });
    } catch (error) {
      console.error("[Seed] JobRequest error:", error);
      res.status(500).json({ error: "Failed to seed job requests" });
    }
  });

  // ============================================
  // Agent Registry Seed Endpoint (MVP Demo Data)
  // Registers all agents including dispatch & crew assignment agents
  // ============================================

  app.post("/api/seed/agents", async (req, res) => {
    try {
      const { agentRegistry, businessProfiles } = await import("@shared/schema");
      const { db } = await import("./db");

      const [profile] = await db.select().from(businessProfiles).limit(1);
      if (!profile) {
        return res.status(404).json({ error: "No business profile found" });
      }

      const agents = [
        // Core agents
        {
          agentKey: "orchestration_engine",
          displayName: "Orchestration Engine",
          description: "Central supervisor that coordinates all agents and manages event-driven workflows",
          category: "core",
          status: "active",
          healthScore: 95,
          totalRuns: 1247,
          timeSavedMinutes: 420,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "intake_agent",
          displayName: "Intake Agent",
          description: "Qualifies leads and extracts property details from inbound SMS and calls",
          category: "core",
          status: "active",
          healthScore: 88,
          totalRuns: 523,
          timeSavedMinutes: 185,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 125000,
        },
        {
          agentKey: "quoting_agent",
          displayName: "Quoting Agent",
          description: "Generates accurate quotes based on lot size, services, and pricing rules",
          category: "core",
          status: "active",
          healthScore: 92,
          totalRuns: 312,
          timeSavedMinutes: 156,
          cashAcceleratedCents: 450000,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "scheduling_agent",
          displayName: "Scheduling Agent",
          description: "Books jobs into optimal time slots based on crew availability",
          category: "core",
          status: "active",
          healthScore: 90,
          totalRuns: 189,
          timeSavedMinutes: 95,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 85000,
        },

        // Dispatch & Crew agents
        {
          agentKey: "crew_intelligence",
          displayName: "Crew Intelligence Agent",
          description: "Evaluates crew skills, equipment, and availability for job matching",
          category: "dispatch",
          status: "active",
          healthScore: 94,
          totalRuns: 856,
          timeSavedMinutes: 285,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "job_feasibility",
          displayName: "Job Feasibility Agent",
          description: "Validates job requirements against crew capabilities and constraints",
          category: "dispatch",
          status: "active",
          healthScore: 91,
          totalRuns: 642,
          timeSavedMinutes: 128,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 45000,
        },
        {
          agentKey: "route_cost",
          displayName: "Route Cost Agent",
          description: "Calculates travel time and distance costs between jobs using Haversine",
          category: "dispatch",
          status: "active",
          healthScore: 96,
          totalRuns: 1423,
          timeSavedMinutes: 356,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "simulation_ranking",
          displayName: "Simulation & Ranking Agent",
          description: "Runs crew-job simulations and ranks by travel, margin, and risk scores",
          category: "dispatch",
          status: "active",
          healthScore: 93,
          totalRuns: 428,
          timeSavedMinutes: 214,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "optimizer_orchestrator",
          displayName: "Optimizer Orchestrator Agent",
          description: "Creates decisions from simulations, handles approvals with RBAC enforcement",
          category: "dispatch",
          status: "active",
          healthScore: 89,
          totalRuns: 156,
          timeSavedMinutes: 78,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 62000,
        },
        {
          agentKey: "margin_burn",
          displayName: "Margin Burn Agent",
          description: "Computes margin impact from travel and labor costs for job assignments",
          category: "dispatch",
          status: "active",
          healthScore: 94,
          totalRuns: 734,
          timeSavedMinutes: 146,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "dispatch_worker",
          displayName: "Dispatch Worker",
          description: "Applies optimized routes to Jobber and manages crew assignments",
          category: "dispatch",
          status: "active",
          healthScore: 87,
          totalRuns: 245,
          timeSavedMinutes: 122,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 38000,
        },

        // Operations agents
        {
          agentKey: "reconciliation_worker",
          displayName: "Reconciliation Worker",
          description: "Validates invoice/payment integrity and creates alerts for mismatches",
          category: "ops",
          status: "active",
          healthScore: 98,
          totalRuns: 892,
          timeSavedMinutes: 178,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 23500,
        },

        // Finance agents
        {
          agentKey: "billing_worker",
          displayName: "Billing Worker",
          description: "Automates invoice generation and payment processing workflows",
          category: "finance",
          status: "active",
          healthScore: 96,
          totalRuns: 456,
          timeSavedMinutes: 228,
          cashAcceleratedCents: 125000,
          revenueProtectedCents: 0,
        },
        {
          agentKey: "renewal_upsell",
          displayName: "Renewal & Upsell Worker",
          description: "Scans for upsell opportunities and creates seasonal service offers",
          category: "finance",
          status: "active",
          healthScore: 85,
          totalRuns: 89,
          timeSavedMinutes: 45,
          cashAcceleratedCents: 185000,
          revenueProtectedCents: 0,
        },

        // Communications agents
        {
          agentKey: "comms_worker",
          displayName: "Customer Comms Worker",
          description: "Produces customer-facing messages with compliance and tone rules",
          category: "comms",
          status: "active",
          healthScore: 91,
          totalRuns: 1534,
          timeSavedMinutes: 384,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 56000,
        },
        {
          agentKey: "inbound_engagement",
          displayName: "Inbound Engagement Agent",
          description: "Responds to SMS inquiries with intelligent, context-aware messages",
          category: "comms",
          status: "active",
          healthScore: 88,
          totalRuns: 723,
          timeSavedMinutes: 181,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 92000,
        },
        {
          agentKey: "reviews_agent",
          displayName: "Reviews Agent",
          description: "Requests reviews after job completion and manages reputation",
          category: "comms",
          status: "paused",
          healthScore: 75,
          totalRuns: 34,
          timeSavedMinutes: 17,
          cashAcceleratedCents: 0,
          revenueProtectedCents: 0,
        },
      ];

      let created = 0;
      let updated = 0;

      for (const agent of agents) {
        try {
          const [existing] = await db
            .select()
            .from(agentRegistry)
            .where((await import("drizzle-orm")).eq(agentRegistry.agentKey, agent.agentKey))
            .limit(1);

          if (existing) {
            await db
              .update(agentRegistry)
              .set({
                ...agent,
                businessId: profile.id,
                updatedAt: new Date(),
              })
              .where((await import("drizzle-orm")).eq(agentRegistry.id, existing.id));
            updated++;
          } else {
            await db.insert(agentRegistry).values({
              ...agent,
              businessId: profile.id,
            });
            created++;
          }
        } catch (e) {
          console.log(`[Seed] Agent ${agent.agentKey} error:`, e);
        }
      }

      console.log(`[Seed] Created ${created} agents, updated ${updated} agents`);

      res.json({
        success: true,
        message: `Created ${created} agents, updated ${updated} agents`,
        agentsCreated: created,
        agentsUpdated: updated,
        totalAgents: agents.length,
      });
    } catch (error) {
      console.error("[Seed] Agent error:", error);
      res.status(500).json({ error: "Failed to seed agents" });
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

  app.get("/api/comms/v2/templates", async (req, res) => {
    try {
      const { MESSAGE_TEMPLATES } = await import("./lib/comms/templates");
      const { intentType, serviceCategory } = req.query;
      
      let templates = MESSAGE_TEMPLATES;
      
      if (intentType) {
        templates = templates.filter(t => t.intentType === intentType);
      }
      if (serviceCategory) {
        templates = templates.filter(t => t.serviceCategory === serviceCategory);
      }
      
      res.json(templates);
    } catch (error: any) {
      console.error("[Comms] Error fetching v2 templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comms/v2/preview", async (req, res) => {
    try {
      const { previewMessage, getTemplate } = await import("./lib/comms");
      const { templateId, intentType, serviceCategory, context } = req.body;
      
      let template;
      if (templateId) {
        const { getTemplateById } = await import("./lib/comms/templates");
        template = getTemplateById(templateId);
      } else if (intentType) {
        template = getTemplate(intentType, serviceCategory);
      }
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const preview = previewMessage(template.template, context || {});
      res.json({
        template: {
          id: template.id,
          name: template.name,
          intentType: template.intentType,
        },
        ...preview,
      });
    } catch (error: any) {
      console.error("[Comms] Error previewing message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/v2/pending-approvals", async (req, res) => {
    try {
      const { commsOrchestrator } = await import("./lib/comms");
      const profile = await storage.getBusinessProfile();
      
      const approvals = commsOrchestrator.getPendingApprovals(profile?.id);
      res.json(approvals);
    } catch (error: any) {
      console.error("[Comms] Error fetching pending approvals:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comms/v2/approve/:intentId", async (req, res) => {
    try {
      const { commsOrchestrator } = await import("./lib/comms");
      const { intentId } = req.params;
      const userId = (req as any).user?.id || 1;
      
      const result = await commsOrchestrator.approveIntent(intentId, userId);
      res.json(result);
    } catch (error: any) {
      console.error("[Comms] Error approving intent:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comms/v2/reject/:intentId", async (req, res) => {
    try {
      const { commsOrchestrator } = await import("./lib/comms");
      const { intentId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id || 1;
      
      await commsOrchestrator.rejectIntent(intentId, userId, reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Comms] Error rejecting intent:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comms/v2/send", async (req, res) => {
    try {
      const { sendQuickSMS } = await import("./lib/comms");
      const profile = await storage.getBusinessProfile();
      
      if (!profile) {
        return res.status(400).json({ error: "Business profile not found" });
      }
      
      const { intentType, recipientPhone, recipientName, context } = req.body;
      
      if (!intentType || !recipientPhone) {
        return res.status(400).json({ error: "intentType and recipientPhone are required" });
      }
      
      const result = await sendQuickSMS(
        intentType,
        profile.id,
        recipientPhone,
        recipientName || "Customer",
        context
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("[Comms] Error sending message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comms/v2/intent-types", async (req, res) => {
    try {
      const { INTENT_METADATA } = await import("@shared/comms-schema");
      
      const intentTypes = Object.entries(INTENT_METADATA).map(([type, meta]) => ({
        type,
        ...meta,
      }));
      
      res.json(intentTypes);
    } catch (error: any) {
      console.error("[Comms] Error fetching intent types:", error);
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
    {
      agentKey: "sms_orchestrator",
      displayName: "SMS Intelligence Layer",
      description: "Deterministic state machine for SMS lead qualification with template-driven flows, range-first pricing, and human handoff",
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

  // Pricing Policy Routes (owner/operator only)
  app.get("/api/pricing/policies", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const policies = await storage.getPricingPolicies(profile.id);
      res.json(policies);
    } catch (error: any) {
      console.error("[Pricing] Error fetching policies:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pricing/policies/active", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const policy = await storage.getActivePricingPolicy(profile.id);
      if (!policy) {
        const { getDefaultPricingPolicy } = await import("./pricing/quoteRater");
        const defaultPolicy = getDefaultPricingPolicy();
        return res.json({ ...defaultPolicy, id: 0, businessId: profile.id, isDefault: true });
      }
      res.json(policy);
    } catch (error: any) {
      console.error("[Pricing] Error fetching active policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pricing/policies/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const policy = await storage.getPricingPolicy(parseInt(req.params.id));
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error: any) {
      console.error("[Pricing] Error fetching policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing/policies", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const existingPolicies = await storage.getPricingPolicies(profile.id);
      const maxVersion = existingPolicies.reduce((max, p) => Math.max(max, p.version), 0);
      
      if (req.body.isActive) {
        for (const existing of existingPolicies) {
          if (existing.isActive) {
            await storage.updatePricingPolicy(existing.id, { isActive: false });
          }
        }
      }

      const policy = await storage.createPricingPolicy({
        ...req.body,
        businessId: profile.id,
        version: maxVersion + 1,
      });
      res.json(policy);
    } catch (error: any) {
      console.error("[Pricing] Error creating policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/pricing/policies/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      
      if (req.body.isActive) {
        const existingPolicies = await storage.getPricingPolicies(profile.id);
        for (const existing of existingPolicies) {
          if (existing.isActive && existing.id !== parseInt(req.params.id)) {
            await storage.updatePricingPolicy(existing.id, { isActive: false });
          }
        }
      }

      const policy = await storage.updatePricingPolicy(parseInt(req.params.id), req.body);
      res.json(policy);
    } catch (error: any) {
      console.error("[Pricing] Error updating policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quote Proposal Routes
  app.get("/api/pricing/quotes", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const quotes = await storage.getQuoteProposals(profile.id);
      res.json(quotes);
    } catch (error: any) {
      console.error("[Pricing] Error fetching quotes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pricing/quotes/pending", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const quotes = await storage.getPendingQuoteProposals(profile.id);
      res.json(quotes);
    } catch (error: any) {
      console.error("[Pricing] Error fetching pending quotes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pricing/quotes/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const quote = await storage.getQuoteProposal(parseInt(req.params.id));
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error: any) {
      console.error("[Pricing] Error fetching quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing/quotes/calculate", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const { calculateQuote } = await import("./pricing/quoteRater");
      const policy = await storage.getActivePricingPolicy(profile.id);
      
      const { propertySignals, servicesRequested } = req.body;
      const result = calculateQuote(policy || null, propertySignals, servicesRequested);
      
      res.json(result);
    } catch (error: any) {
      console.error("[Pricing] Error calculating quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing/quotes", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const { calculateQuote } = await import("./pricing/quoteRater");
      const policy = await storage.getActivePricingPolicy(profile.id);
      
      const { propertySignals, servicesRequested, customerName, customerPhone, customerAddress } = req.body;
      const result = calculateQuote(policy || null, propertySignals, servicesRequested);

      const quote = await storage.createQuoteProposal({
        businessId: profile.id,
        policyId: policy?.id,
        customerName,
        customerPhone,
        customerAddress,
        propertySignals,
        servicesRequested,
        rangeLow: result.rangeLow,
        rangeHigh: result.rangeHigh,
        assumptions: result.assumptions,
        calculationBreakdown: result.calculationBreakdown,
        needsReview: result.needsReview,
        reviewReasons: result.reviewReasons,
        propertyTypeBand: result.propertyTypeBand,
        status: result.needsReview ? "pending" : "auto_approved",
      });

      res.json({ quote, calculation: result });
    } catch (error: any) {
      console.error("[Pricing] Error creating quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/pricing/quotes/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const existingQuote = await storage.getQuoteProposal(parseInt(req.params.id));
      if (!existingQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const { status, approvedAmount, adjustmentReason } = req.body;
      
      if (adjustmentReason && approvedAmount !== existingQuote.approvedAmount) {
        await storage.createQuoteAdjustmentLog({
          quoteProposalId: existingQuote.id,
          changeType: status === "approved" ? "approve" : status === "rejected" ? "decline" : "adjust_amount",
          beforeState: { status: existingQuote.status, approvedAmount: existingQuote.approvedAmount },
          afterState: { status, approvedAmount },
          reason: adjustmentReason,
          changedByUserId: (req.user as any)?.id,
          changedByRole: "owner",
        });
      }

      const quote = await storage.updateQuoteProposal(parseInt(req.params.id), {
        status,
        approvedAmount,
        approvedBy: (req.user as any)?.id,
        approvedAt: new Date(),
      });
      res.json(quote);
    } catch (error: any) {
      console.error("[Pricing] Error updating quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pricing/quotes/:id/adjustments", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const logs = await storage.getQuoteAdjustmentLogs(parseInt(req.params.id));
      res.json(logs);
    } catch (error: any) {
      console.error("[Pricing] Error fetching adjustments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Unified Quote Builder (UQB) API
  // ============================================

  // Get RBAC policy for business
  app.get("/api/uqb/rbac-policy", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const policy = await storage.getBusinessRbacPolicy(profile.id);
      res.json(policy || { businessId: profile.id, allowCrewLeadSend: false, allowStaffSend: true });
    } catch (error: any) {
      console.error("[UQB] Error fetching RBAC policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update RBAC policy
  app.patch("/api/uqb/rbac-policy", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = req.user as any;
      if (user?.role !== "owner" && user?.role !== "admin") {
        return res.status(403).json({ error: "Only owners and admins can modify RBAC policies" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const policy = await storage.upsertBusinessRbacPolicy(profile.id, req.body);
      res.json(policy);
    } catch (error: any) {
      console.error("[UQB] Error updating RBAC policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Parse voice transcript to structured input
  app.post("/api/uqb/parse-voice", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI();

      const systemPrompt = `You are a voice transcript parser for a lawn care quoting system.
Extract structured information from the user's voice transcript.

Return a JSON object with these fields (only include fields that were mentioned):
- customer_name: string (full name if provided)
- customer_phone: string (phone number if provided)
- service_address: string (full address if provided)
- services_requested: string[] (e.g., ["mowing", "leaf cleanup", "mulch"])
- frequency: "one_time" | "weekly" | "biweekly" | "monthly" | "unknown"
- complexity: "light" | "medium" | "heavy" | "unknown"
- lot_area_sqft: number (if they mention lot size)
- property_band: "townhome" | "small" | "medium" | "large" | "multi_acre" | "unknown"
- photos_provided: boolean

Also identify missing_fields (fields needed for a complete quote):
- For lawn care: need address, service type, and ideally frequency
- If no address, add "service_address" to missing
- If no service type, add "services_requested" to missing

Generate follow-up questions for missing fields.

Return JSON format:
{
  "extracted": { ...partial structured input },
  "missing_fields": ["field_name", ...],
  "questions": ["Natural language question to ask", ...]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "Failed to parse transcript" });
      }

      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (error: any) {
      console.error("[UQB] Error parsing voice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Detect voice commands (send quote, text customer)
  app.post("/api/uqb/detect-command", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const lowerTranscript = transcript.toLowerCase();
      const commands = {
        send_quote: false,
        clear_form: false,
        add_service: null as string | null,
      };

      // Check for send commands
      if (
        lowerTranscript.includes("send quote") ||
        lowerTranscript.includes("text the quote") ||
        lowerTranscript.includes("send it") ||
        lowerTranscript.includes("text them") ||
        lowerTranscript.includes("send that")
      ) {
        commands.send_quote = true;
      }

      // Check for clear commands
      if (
        lowerTranscript.includes("clear form") ||
        lowerTranscript.includes("start over") ||
        lowerTranscript.includes("reset")
      ) {
        commands.clear_form = true;
      }

      // Check for add service commands
      const serviceMatch = lowerTranscript.match(/add (mowing|cleanup|mulch|trimming|edging|leaf removal|lawn care)/i);
      if (serviceMatch) {
        commands.add_service = serviceMatch[1].toLowerCase();
      }

      res.json({ commands, detected: commands.send_quote || commands.clear_form || commands.add_service !== null });
    } catch (error: any) {
      console.error("[UQB] Error detecting command:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get quote drafts
  app.get("/api/uqb/drafts", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }
      const drafts = await storage.getQuoteDrafts(profile.id);
      res.json(drafts);
    } catch (error: any) {
      console.error("[UQB] Error fetching drafts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single draft
  app.get("/api/uqb/drafts/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const draft = await storage.getQuoteDraft(parseInt(req.params.id));
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error: any) {
      console.error("[UQB] Error fetching draft:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create quote draft
  app.post("/api/uqb/drafts", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = req.user as any;
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const draft = await storage.createQuoteDraft({
        businessId: profile.id,
        createdByUserId: user.id,
        ...req.body,
      });
      res.json(draft);
    } catch (error: any) {
      console.error("[UQB] Error creating draft:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update quote draft
  app.patch("/api/uqb/drafts/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const draft = await storage.updateQuoteDraft(parseInt(req.params.id), req.body);
      res.json(draft);
    } catch (error: any) {
      console.error("[UQB] Error updating draft:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate quote from draft input
  app.post("/api/uqb/calculate", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { serviceType, lotAreaSqft, complexity, frequency } = req.body;

      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      // Get active pricing policy
      const policy = await storage.getActivePricingPolicy(profile.id);
      
      const { calculateQuote } = await import("./pricing/quoteRater");
      
      // Build property signals
      const propertySignals = {
        lotAreaSqft: lotAreaSqft || 5000,
        complexity: complexity || "medium",
        dataSource: "user_input" as const,
        confidence: 0.9,
      };
      
      // Build service request
      const servicesRequested = [{
        serviceType: serviceType || "mowing",
        frequency: frequency || "one_time",
      }];
      
      const result = calculateQuote(policy || null, propertySignals, servicesRequested);

      res.json(result);
    } catch (error: any) {
      console.error("[UQB] Error calculating quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send quote via SMS with RBAC enforcement
  app.post("/api/uqb/send", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = req.user as any;
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      // Check RBAC permissions
      const rbacPolicy = await storage.getBusinessRbacPolicy(profile.id);
      const { customerPhone, rangeLow, rangeHigh, draftId } = req.body;

      // Owner and admin always can send
      if (user.role !== "owner" && user.role !== "admin") {
        // Check crew lead permission
        if (user.role === "crew_lead" && !rbacPolicy?.allowCrewLeadSend) {
          return res.status(403).json({ error: "Crew leads are not authorized to send quotes" });
        }
        // Check staff permission
        if (user.role === "staff" && !rbacPolicy?.allowStaffSend) {
          return res.status(403).json({ error: "Staff members are not authorized to send quotes" });
        }
        // Check amount threshold
        if (rbacPolicy?.requireApprovalAboveAmount && rangeHigh > rbacPolicy.requireApprovalAboveAmount) {
          return res.status(403).json({ 
            error: "Quote exceeds approval threshold",
            requiresApproval: true,
            threshold: rbacPolicy.requireApprovalAboveAmount
          });
        }
      }

      if (!customerPhone) {
        return res.status(400).json({ error: "Customer phone is required" });
      }

      // Format quote message
      const lowPrice = (rangeLow / 100).toFixed(0);
      const highPrice = (rangeHigh / 100).toFixed(0);
      const message = `Thanks for your interest! Based on what you've described, we estimate $${lowPrice}-$${highPrice} for this service. Want us to schedule a visit? Reply YES to confirm or call us for questions.`;

      // Send via SMS using twilioConnector
      let sent = false;
      try {
        const smsResult = await twilioConnector.sendSMS(customerPhone, message);
        sent = smsResult.success;
        if (!sent) {
          console.log("[UQB] SMS send returned failure:", smsResult);
        }
      } catch (smsError) {
        console.error("[UQB] SMS send failed:", smsError);
      }

      // Update draft status if provided
      if (draftId) {
        await storage.updateQuoteDraft(draftId, { status: "sent" });
      }

      // Create audit log
      await storage.createAuditLog({
        action: "quote_sent",
        entityType: "quote",
        entityId: draftId || 0,
        details: {
          customerPhone,
          rangeLow,
          rangeHigh,
          sentVia: sent ? "twilio" : "mock",
        },
      });

      res.json({ success: true, sent, message });
    } catch (error: any) {
      console.error("[UQB] Error sending quote:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Lead-to-Cash Orchestrator API
  // ============================================

  app.post("/api/orchestrator/l2c/start", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const input = startOrchestrationInputSchema.parse(req.body);
      const userId = (req as any).user?.id;

      const result = await startOrchestration({
        accountId: `account_${profile.id}`,
        businessId: profile.id,
        jobRequestId: input.jobRequestId,
        userId: userId || input.userId,
        channel: input.channel,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[L2C] Error starting orchestration:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orchestrator/l2c/run/:runId", async (req, res) => {
    try {
      const { run, steps, jobRequest } = await getOrchestrationRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json({ run, steps, jobRequest });
    } catch (error: any) {
      console.error("[L2C] Error fetching run:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orchestrator/l2c/runs", async (req, res) => {
    try {
      const jobRequestId = parseInt(req.query.jobRequestId as string);
      if (isNaN(jobRequestId)) {
        return res.status(400).json({ error: "jobRequestId required" });
      }
      const runs = await getRunsForJobRequest(jobRequestId);
      res.json(runs);
    } catch (error: any) {
      console.error("[L2C] Error fetching runs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orchestrator/l2c/run/:runId/next", async (req, res) => {
    try {
      const result = await runNextStep(req.params.runId);
      res.json(result);
    } catch (error: any) {
      console.error("[L2C] Error running next step:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orchestrator/l2c/run/:runId/approve", async (req, res) => {
    try {
      const userId = (req as any).user?.id || 1;
      const input = opsApprovalInputSchema.parse({
        runId: req.params.runId,
        ...req.body,
      });

      const result = await handleOpsApproval({
        runId: input.runId,
        userId,
        stage: input.stage as any,
        approvalData: input.approvalData,
        notes: input.notes,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[L2C] Error approving:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orchestrator/l2c/run/:runId/override", async (req, res) => {
    try {
      const userId = (req as any).user?.id || 1;
      const input = opsOverrideInputSchema.parse({
        runId: req.params.runId,
        ...req.body,
      });

      const result = await handleOpsOverride({
        runId: input.runId,
        userId,
        action: input.action as any,
        targetStage: input.targetStage as any,
        contextUpdate: input.contextUpdate,
        notes: input.notes,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[L2C] Error overriding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orchestrator/l2c/inbound-message", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const { from, to, body, messageId } = req.body;
      if (!from || !body) {
        return res.status(400).json({ error: "from and body required" });
      }

      const result = await handleInboundMessage({
        accountId: `account_${profile.id}`,
        businessId: profile.id,
        from,
        to: to || profile.phone || "",
        body,
        messageId,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[L2C] Error handling inbound message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Route Optimizer API
  // ============================================

  // --- Users API ---
  app.get("/api/users", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can list users" });
      }
      const profile = await storage.getBusinessProfile();
      const businessId = profile?.id;
      const allUsers = await storage.getUsers(businessId);
      res.json(allUsers);
    } catch (error: any) {
      console.error("[Users] Error listing users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Settings API (Phase 2 UX Redesign)
  // ============================================
  
  // --- Settings: Users & Roles ---
  app.get("/api/settings/users", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can view users" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const allUsers = await storage.getUsers(profile.id);
      res.json(allUsers);
    } catch (error: any) {
      console.error("[Settings] Error fetching users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/settings/users/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update users" });
      }
      const userId = parseInt(req.params.id);
      const { role: newRole, isActive } = req.body;
      const updated = await storage.updateUser(userId, { role: newRole, isActive });
      res.json(updated);
    } catch (error: any) {
      console.error("[Settings] Error updating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Settings: Message Templates ---
  app.get("/api/settings/templates", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { type, category, isActive } = req.query;
      const templates = await storage.getMessageTemplates(profile.id, {
        type: type as string | undefined,
        category: category as string | undefined,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
      });
      res.json(templates);
    } catch (error: any) {
      console.error("[Settings] Error fetching templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/templates/:id", async (req, res) => {
    try {
      const template = await storage.getMessageTemplate(parseInt(req.params.id));
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("[Settings] Error fetching template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings/templates", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can create templates" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const template = await storage.createMessageTemplate({
        ...req.body,
        accountId: profile.id,
      });
      res.status(201).json(template);
    } catch (error: any) {
      console.error("[Settings] Error creating template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/settings/templates/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update templates" });
      }
      const templateId = parseInt(req.params.id);
      const existing = await storage.getMessageTemplate(templateId);
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      const updated = await storage.updateMessageTemplate(templateId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("[Settings] Error updating template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/settings/templates/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can delete templates" });
      }
      const templateId = parseInt(req.params.id);
      await storage.deleteMessageTemplate(templateId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Settings] Error deleting template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Settings: Billing Configuration ---
  app.get("/api/settings/billing-config", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can view billing config" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const config = await storage.getBillingConfig(profile.id);
      if (!config) {
        return res.json({
          accountId: profile.id,
          invoiceTermsDays: 30,
          acceptedPaymentMethods: ["check", "card"],
          lateFeePercent: "0",
          collectionsReminderCadenceDays: [7, 14, 30],
          taxRatePercent: "0",
          taxId: null,
          quickbooksConnected: false,
          quickbooksCompanyId: null,
        });
      }
      res.json(config);
    } catch (error: any) {
      console.error("[Settings] Error fetching billing config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/settings/billing-config", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update billing config" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const config = await storage.upsertBillingConfig(profile.id, req.body);
      res.json(config);
    } catch (error: any) {
      console.error("[Settings] Error updating billing config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Comms Studio API Routes
  // ============================================

  // Get all automations
  app.get("/api/comms/automations", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role?.toUpperCase();
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const filters: { audienceType?: string; state?: string } = {};
      if (req.query.audienceType) filters.audienceType = req.query.audienceType as string;
      if (req.query.state) filters.state = req.query.state as string;
      const automations = await storage.getCommsAutomations(profile.id, filters);
      res.json(automations);
    } catch (error: any) {
      console.error("[CommsStudio] Error fetching automations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single automation
  app.get("/api/comms/automations/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role?.toUpperCase();
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied" });
      }
      const automation = await storage.getCommsAutomation(parseInt(req.params.id));
      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }
      res.json(automation);
    } catch (error: any) {
      console.error("[CommsStudio] Error fetching automation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update automation (toggle state, etc.)
  const updateAutomationSchema = z.object({
    state: z.enum(["ACTIVE", "PAUSED", "INACTIVE"]).optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    channelsJson: z.array(z.enum(["SMS", "EMAIL", "IN_APP", "PUSH"])).optional(),
    languageMode: z.enum(["AUTO", "EN", "ES"]).optional(),
    templateSetId: z.number().int().positive().nullable().optional(),
    filtersJson: z.record(z.unknown()).nullable().optional(),
  }).strict();

  app.patch("/api/comms/automations/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role?.toUpperCase();
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update automations" });
      }
      // Validate request body with Zod
      const parseResult = updateAutomationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      const updates = parseResult.data;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const automation = await storage.updateCommsAutomation(parseInt(req.params.id), updates);
      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }
      res.json(automation);
    } catch (error: any) {
      console.error("[CommsStudio] Error updating automation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all template sets
  app.get("/api/comms/template-sets", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role?.toUpperCase();
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const filters: { language?: string; channel?: string } = {};
      if (req.query.language) filters.language = req.query.language as string;
      if (req.query.channel) filters.channel = req.query.channel as string;
      const templateSets = await storage.getCommsTemplateSets(profile.id, filters);
      res.json(templateSets);
    } catch (error: any) {
      console.error("[CommsStudio] Error fetching template sets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get delivery logs
  app.get("/api/comms/delivery-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role?.toUpperCase();
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const filters: { automationId?: number; audienceType?: string; status?: string } = {};
      if (req.query.automationId) filters.automationId = parseInt(req.query.automationId as string);
      if (req.query.audienceType) filters.audienceType = req.query.audienceType as string;
      if (req.query.status) filters.status = req.query.status as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getCommsDeliveryLogs(profile.id, filters, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("[CommsStudio] Error fetching delivery logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crews ---
  app.get("/api/ops/crews", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const crewList = await storage.getCrews(profile.id);
      res.json(crewList);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching crews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/crews/:id", async (req, res) => {
    try {
      const crew = await storage.getCrew(parseInt(req.params.id));
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      const members = await storage.getCrewMembers(crew.id);
      res.json({ ...crew, members });
    } catch (error: any) {
      console.error("[Optimizer] Error fetching crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { name, homeBaseLat, homeBaseLng, serviceRadiusMiles, dailyCapacityMinutes, skillsJson, equipmentJson } = req.body;
      const crew = await storage.createCrew({
        businessId: profile.id,
        name,
        homeBaseLat,
        homeBaseLng,
        serviceRadiusMiles: serviceRadiusMiles || 20,
        dailyCapacityMinutes: dailyCapacityMinutes || 420,
        skillsJson: skillsJson || [],
        equipmentJson: equipmentJson || [],
      });
      res.json(crew);
    } catch (error: any) {
      console.error("[Optimizer] Error creating crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/crews/:id", async (req, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const updates = req.body;
      const crew = await storage.updateCrew(crewId, updates);
      res.json(crew);
    } catch (error: any) {
      console.error("[Optimizer] Error updating crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/crews/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can delete crews" });
      }
      const crewId = parseInt(req.params.id);
      const result = await storage.deleteCrew(crewId);
      if (!result) {
        return res.status(404).json({ error: "Crew not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Optimizer] Error deleting crew:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Crew Members API ---
  app.get("/api/ops/crews/:id/members", async (req, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const members = await storage.getCrewMembers(crewId);
      res.json(members);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching crew members:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews/:id/members", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can add crew members" });
      }
      const crewId = parseInt(req.params.id);
      const { displayName, userId, role: memberRole } = req.body;
      if (!displayName) {
        return res.status(400).json({ error: "displayName required" });
      }
      const member = await storage.addCrewMember({
        crewId,
        displayName,
        userId: userId || null,
        role: memberRole || "MEMBER",
      });
      res.json(member);
    } catch (error: any) {
      console.error("[Optimizer] Error adding crew member:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/crews/:crewId/members/:memberId", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update crew members" });
      }
      const memberId = parseInt(req.params.memberId);
      const updates = req.body;
      const member = await storage.updateCrewMember(memberId, updates);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json(member);
    } catch (error: any) {
      console.error("[Optimizer] Error updating crew member:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/crews/:crewId/members/:memberId", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can remove crew members" });
      }
      const memberId = parseInt(req.params.memberId);
      const member = await storage.removeCrewMember(memberId);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Optimizer] Error removing crew member:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews/:crewId/leader", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can set crew leader" });
      }
      const crewId = parseInt(req.params.crewId);
      const { memberId } = req.body;
      if (!memberId) {
        return res.status(400).json({ error: "memberId required" });
      }
      await storage.setCrewLeader(crewId, memberId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Optimizer] Error setting crew leader:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Skills Management ---
  app.get("/api/ops/skills", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const skillsList = await storage.getSkills(profile.id);
      res.json(skillsList);
    } catch (error: any) {
      console.error("[Skills] Error fetching skills:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/skills", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can create skills" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { name, description, category } = req.body;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      const skill = await storage.createSkill({
        businessId: profile.id,
        name,
        description: description || null,
        category: category || "general",
      });
      res.status(201).json(skill);
    } catch (error: any) {
      console.error("[Skills] Error creating skill:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/skills/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update skills" });
      }
      const skillId = parseInt(req.params.id);
      const updates = req.body;
      const skill = await storage.updateSkill(skillId, updates);
      res.json(skill);
    } catch (error: any) {
      console.error("[Skills] Error updating skill:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/skills/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can delete skills" });
      }
      const skillId = parseInt(req.params.id);
      await storage.deleteSkill(skillId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Skills] Error deleting skill:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Equipment Management ---
  app.get("/api/ops/equipment", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const equipmentList = await storage.getEquipment(profile.id);
      res.json(equipmentList);
    } catch (error: any) {
      console.error("[Equipment] Error fetching equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/equipment", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can create equipment" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { name, type, description, status } = req.body;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      const equip = await storage.createEquipment({
        businessId: profile.id,
        name,
        type: type || "other",
        description: description || null,
        status: status || "available",
      });
      res.status(201).json(equip);
    } catch (error: any) {
      console.error("[Equipment] Error creating equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/equipment/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update equipment" });
      }
      const equipId = parseInt(req.params.id);
      const updates = req.body;
      const equip = await storage.updateEquipment(equipId, updates);
      res.json(equip);
    } catch (error: any) {
      console.error("[Equipment] Error updating equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/equipment/:id", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can delete equipment" });
      }
      const equipId = parseInt(req.params.id);
      await storage.deleteEquipment(equipId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Equipment] Error deleting equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crew Skills Assignment ---
  app.get("/api/ops/crews/:crewId/skills", async (req, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const crewSkillsList = await storage.getCrewSkills(crewId);
      res.json(crewSkillsList);
    } catch (error: any) {
      console.error("[CrewSkills] Error fetching crew skills:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews/:crewId/skills", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can assign crew skills" });
      }
      const crewId = parseInt(req.params.crewId);
      const { skillId, proficiencyLevel } = req.body;
      if (!skillId) {
        return res.status(400).json({ error: "skillId is required" });
      }
      const crewSkill = await storage.addCrewSkill(crewId, skillId, proficiencyLevel || 1);
      res.status(201).json(crewSkill);
    } catch (error: any) {
      console.error("[CrewSkills] Error adding crew skill:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/crews/:crewId/skills/:skillId", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can remove crew skills" });
      }
      const crewId = parseInt(req.params.crewId);
      const skillId = parseInt(req.params.skillId);
      await storage.removeCrewSkill(crewId, skillId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CrewSkills] Error removing crew skill:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crew Equipment Assignment ---
  app.get("/api/ops/crews/:crewId/equipment", async (req, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const crewEquipList = await storage.getCrewEquipment(crewId);
      res.json(crewEquipList);
    } catch (error: any) {
      console.error("[CrewEquipment] Error fetching crew equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews/:crewId/equipment", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can assign crew equipment" });
      }
      const crewId = parseInt(req.params.crewId);
      const { equipmentId } = req.body;
      if (!equipmentId) {
        return res.status(400).json({ error: "equipmentId is required" });
      }
      const crewEquip = await storage.addCrewEquipment(crewId, equipmentId);
      res.status(201).json(crewEquip);
    } catch (error: any) {
      console.error("[CrewEquipment] Error adding crew equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/crews/:crewId/equipment/:equipmentId", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can remove crew equipment" });
      }
      const crewId = parseInt(req.params.crewId);
      const equipmentId = parseInt(req.params.equipmentId);
      await storage.removeCrewEquipment(crewId, equipmentId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CrewEquipment] Error removing crew equipment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crew Availability ---
  app.get("/api/ops/crews/:crewId/availability", async (req, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const availabilityList = await storage.getCrewAvailability(crewId);
      res.json(availabilityList);
    } catch (error: any) {
      console.error("[CrewAvailability] Error fetching crew availability:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/ops/crews/:crewId/availability", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN" && role !== "CREW_LEAD") {
        return res.status(403).json({ error: "Only OWNER, ADMIN or CREW_LEAD can set crew availability" });
      }
      const crewId = parseInt(req.params.crewId);
      const { availability } = req.body;
      if (!Array.isArray(availability)) {
        return res.status(400).json({ error: "availability must be an array" });
      }
      
      // Validate HH:MM format and ensure one slot per day
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const seenDays = new Set<number>();
      for (const slot of availability) {
        if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
          return res.status(400).json({ error: "dayOfWeek must be 0-6" });
        }
        if (seenDays.has(slot.dayOfWeek)) {
          return res.status(400).json({ error: `Duplicate entry for day ${slot.dayOfWeek}` });
        }
        seenDays.add(slot.dayOfWeek);
        if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
          return res.status(400).json({ error: "Times must be in HH:MM format" });
        }
      }
      
      const updated = await storage.setCrewAvailability(crewId, availability);
      res.json(updated);
    } catch (error: any) {
      console.error("[CrewAvailability] Error setting crew availability:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/crews/:crewId/availability/:slotId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN" && role !== "CREW_LEAD") {
        return res.status(403).json({ error: "Only OWNER, ADMIN or CREW_LEAD can update crew availability" });
      }
      const slotId = parseInt(req.params.slotId);
      const updates = req.body;
      
      // Validate time format if provided
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (updates.startTime && !timeRegex.test(updates.startTime)) {
        return res.status(400).json({ error: "startTime must be in HH:MM format" });
      }
      if (updates.endTime && !timeRegex.test(updates.endTime)) {
        return res.status(400).json({ error: "endTime must be in HH:MM format" });
      }
      
      const updated = await storage.updateCrewAvailabilitySlot(slotId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("[CrewAvailability] Error updating availability slot:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Time-Off Requests ---
  // Get time-off for a specific crew
  app.get("/api/ops/crews/:crewId/time-off", async (req, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const requests = await storage.getTimeOffRequests(crewId);
      res.json(requests);
    } catch (error: any) {
      console.error("[TimeOff] Error fetching crew time-off:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create time-off request for a specific crew
  app.post("/api/ops/crews/:crewId/time-off", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN" && role !== "CREW_LEAD") {
        return res.status(403).json({ error: "Only OWNER, ADMIN or CREW_LEAD can create time-off requests" });
      }
      const crewId = parseInt(req.params.crewId);
      const { startDate, endDate, notes } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      
      // Validate ISO date format and parse
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDateRegex.test(startDate) || !isoDateRegex.test(endDate)) {
        return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
      }
      
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ error: "Invalid date values" });
      }
      
      if (parsedStart > parsedEnd) {
        return res.status(400).json({ error: "startDate must be before or equal to endDate" });
      }
      
      const request = await storage.createTimeOffRequest({
        crewId,
        startDate: startDate, // Pass validated ISO string - storage layer handles conversion
        endDate: endDate,     // Pass validated ISO string - storage layer handles conversion
        reason: notes,
        requestedBy: (req.user as any)?.id,
        status: "pending",
      });
      res.status(201).json(request);
    } catch (error: any) {
      console.error("[TimeOff] Error creating time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/time-off", async (req, res) => {
    try {
      const crewId = req.query.crewId ? parseInt(req.query.crewId as string) : undefined;
      const status = req.query.status as string | undefined;
      const requests = await storage.getTimeOffRequests(crewId, status);
      res.json(requests);
    } catch (error: any) {
      console.error("[TimeOff] Error fetching time-off requests:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/time-off/:id", async (req, res) => {
    try {
      const request = await storage.getTimeOffRequest(parseInt(req.params.id));
      if (!request) {
        return res.status(404).json({ error: "Time-off request not found" });
      }
      res.json(request);
    } catch (error: any) {
      console.error("[TimeOff] Error fetching time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/time-off", async (req, res) => {
    try {
      const { crewId, startDate, endDate, reason, requestedBy } = req.body;
      if (!crewId || !startDate || !endDate) {
        return res.status(400).json({ error: "crewId, startDate, and endDate are required" });
      }
      
      // Validate ISO date format and parse
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDateRegex.test(startDate) || !isoDateRegex.test(endDate)) {
        return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
      }
      
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ error: "Invalid date values" });
      }
      
      if (parsedStart > parsedEnd) {
        return res.status(400).json({ error: "startDate must be before or equal to endDate" });
      }
      
      const request = await storage.createTimeOffRequest({
        crewId,
        startDate, // Pass validated ISO string - storage layer handles conversion
        endDate,   // Pass validated ISO string - storage layer handles conversion
        reason,
        requestedBy,
        status: "pending",
      });
      res.status(201).json(request);
    } catch (error: any) {
      console.error("[TimeOff] Error creating time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/time-off/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update time-off requests" });
      }
      const id = parseInt(req.params.id);
      const updated = await storage.updateTimeOffRequest(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("[TimeOff] Error updating time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/time-off/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can approve time-off requests" });
      }
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const { notes } = req.body;
      const approved = await storage.approveTimeOffRequest(id, userId, notes);
      res.json(approved);
    } catch (error: any) {
      console.error("[TimeOff] Error approving time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/time-off/:id/deny", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can deny time-off requests" });
      }
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const { notes } = req.body;
      const denied = await storage.denyTimeOffRequest(id, userId, notes);
      res.json(denied);
    } catch (error: any) {
      console.error("[TimeOff] Error denying time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH versions for approve/deny (UI uses PATCH)
  app.patch("/api/ops/time-off/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can approve time-off requests" });
      }
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const { notes } = req.body;
      const approved = await storage.approveTimeOffRequest(id, userId, notes);
      res.json(approved);
    } catch (error: any) {
      console.error("[TimeOff] Error approving time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/time-off/:id/deny", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can deny time-off requests" });
      }
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const { notes } = req.body;
      const denied = await storage.denyTimeOffRequest(id, userId, notes);
      res.json(denied);
    } catch (error: any) {
      console.error("[TimeOff] Error denying time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete time-off request
  app.delete("/api/ops/time-off/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN" && role !== "CREW_LEAD") {
        return res.status(403).json({ error: "Only OWNER, ADMIN or CREW_LEAD can delete time-off requests" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteTimeOffRequest(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[TimeOff] Error deleting time-off request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Service Zones ---
  app.get("/api/ops/zones", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const role = (req.user as any)?.role;
    if (!["OWNER", "ADMIN", "CREW_LEAD", "STAFF"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const zones = await storage.getServiceZones(profile.id);
      res.json(zones);
    } catch (error: any) {
      console.error("[Zones] Error fetching service zones:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/zones/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const role = (req.user as any)?.role;
    if (!["OWNER", "ADMIN", "CREW_LEAD", "STAFF"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const zone = await storage.getServiceZone(parseInt(req.params.id));
      if (!zone) {
        return res.status(404).json({ error: "Zone not found" });
      }
      res.json(zone);
    } catch (error: any) {
      console.error("[Zones] Error fetching zone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/zones", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can create zones" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { name, description, minLat, maxLat, minLng, maxLng, centerLat, centerLng, radiusMiles, color, priority } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Zone name is required" });
      }
      const zone = await storage.createServiceZone({
        businessId: profile.id,
        name,
        description,
        minLat,
        maxLat,
        minLng,
        maxLng,
        centerLat,
        centerLng,
        radiusMiles,
        color: color || "#22c55e",
        priority: priority || 0,
        isActive: true,
      });
      res.status(201).json(zone);
    } catch (error: any) {
      console.error("[Zones] Error creating zone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/zones/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update zones" });
      }
      const id = parseInt(req.params.id);
      const { name, description, minLat, maxLat, minLng, maxLng, centerLat, centerLng, radiusMiles, color, priority, isActive } = req.body;
      const zone = await storage.updateServiceZone(id, {
        name,
        description,
        minLat,
        maxLat,
        minLng,
        maxLng,
        centerLat,
        centerLng,
        radiusMiles,
        color,
        priority,
        isActive,
      });
      res.json(zone);
    } catch (error: any) {
      console.error("[Zones] Error updating zone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/zones/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can delete zones" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteServiceZone(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Zones] Error deleting zone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get crews assigned to a zone
  app.get("/api/ops/zones/:id/crews", async (req, res) => {
    try {
      const zoneId = parseInt(req.params.id);
      const assignments = await storage.getZoneCrewAssignments(zoneId);
      res.json(assignments);
    } catch (error: any) {
      console.error("[Zones] Error fetching zone crews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crew Zone Assignments ---
  app.get("/api/ops/crews/:crewId/zones", async (req, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const assignments = await storage.getCrewZoneAssignments(crewId);
      res.json(assignments);
    } catch (error: any) {
      console.error("[Zones] Error fetching crew zones:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/crews/:crewId/zones", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can assign crews to zones" });
      }
      const crewId = parseInt(req.params.crewId);
      const { zoneId, isPrimary, priority } = req.body;
      if (!zoneId) {
        return res.status(400).json({ error: "Zone ID is required" });
      }
      const userId = (req.user as any)?.id;
      const assignment = await storage.assignCrewToZone(crewId, zoneId, isPrimary ?? true, priority ?? 0, userId);
      res.status(201).json(assignment);
    } catch (error: any) {
      console.error("[Zones] Error assigning crew to zone:", error);
      // Handle unique constraint violation
      if (error.message?.includes("unique") || error.code === "23505") {
        return res.status(409).json({ error: "Crew is already assigned to this zone" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ops/crew-zones/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can update zone assignments" });
      }
      const id = parseInt(req.params.id);
      const { isPrimary, priority } = req.body;
      const assignment = await storage.updateCrewZoneAssignment(id, { isPrimary, priority });
      res.json(assignment);
    } catch (error: any) {
      console.error("[Zones] Error updating zone assignment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ops/crews/:crewId/zones/:zoneId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const role = (req.user as any)?.role;
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can remove zone assignments" });
      }
      const crewId = parseInt(req.params.crewId);
      const zoneId = parseInt(req.params.zoneId);
      await storage.removeCrewFromZone(crewId, zoneId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Zones] Error removing crew from zone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/zones/crews-for-location", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const role = (req.user as any)?.role;
    if (!["OWNER", "ADMIN", "CREW_LEAD", "STAFF"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Valid lat and lng query parameters are required" });
      }
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const allZones = await storage.getServiceZones(profile.id);
      const matchingZones: Array<{ zone: typeof allZones[0]; isPrimary: boolean }> = [];
      for (const zone of allZones) {
        if (!zone.isActive) continue;
        const hasBoundingBox = zone.minLat != null && zone.maxLat != null && zone.minLng != null && zone.maxLng != null;
        const hasCircle = zone.centerLat != null && zone.centerLng != null && zone.radiusMiles != null;
        let isInZone = false;
        if (hasBoundingBox) {
          isInZone = lat >= Number(zone.minLat) && lat <= Number(zone.maxLat) && 
                     lng >= Number(zone.minLng) && lng <= Number(zone.maxLng);
        } else if (hasCircle) {
          const R = 3959;
          const dLat = (lat - Number(zone.centerLat)) * Math.PI / 180;
          const dLng = (lng - Number(zone.centerLng)) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(Number(zone.centerLat) * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          isInZone = distance <= Number(zone.radiusMiles);
        }
        if (isInZone) {
          matchingZones.push({ zone, isPrimary: false });
        }
      }
      const matchingCrews: Array<{
        crew: any;
        zone: typeof allZones[0];
        isPrimary: boolean;
        priority: number;
      }> = [];
      for (const { zone } of matchingZones) {
        const zoneCrews = await storage.getZoneCrewAssignments(zone.id);
        for (const assignment of zoneCrews) {
          const existingIdx = matchingCrews.findIndex(mc => mc.crew.id === assignment.crew.id);
          if (existingIdx >= 0) {
            if (assignment.isPrimary && !matchingCrews[existingIdx].isPrimary) {
              matchingCrews[existingIdx] = {
                crew: assignment.crew,
                zone: zone,
                isPrimary: assignment.isPrimary ?? false,
                priority: assignment.priority ?? 0,
              };
            }
          } else {
            matchingCrews.push({
              crew: assignment.crew,
              zone: zone,
              isPrimary: assignment.isPrimary ?? false,
              priority: assignment.priority ?? 0,
            });
          }
        }
      }
      matchingCrews.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.priority - a.priority;
      });
      res.json({
        location: { lat, lng },
        matchingZones: matchingZones.map(mz => mz.zone),
        eligibleCrews: matchingCrews,
      });
    } catch (error: any) {
      console.error("[Zones] Error finding crews for location:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Crew Analytics ---
  app.get("/api/ops/crews/:crewId/analytics", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const role = (req.user as any)?.role;
    if (!["OWNER", "ADMIN", "CREW_LEAD", "STAFF"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const crewId = parseInt(req.params.crewId);
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const analytics = await storage.getCrewAnalytics(crewId, startDate, endDate);
      const summary = await storage.getCrewAnalyticsSummary(crewId, days);
      
      res.json({ analytics, summary, period: { startDate, endDate, days } });
    } catch (error: any) {
      console.error("[Analytics] Error fetching crew analytics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/analytics/crews", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const role = (req.user as any)?.role;
    if (!["OWNER", "ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Only OWNER or ADMIN can view all crew analytics" });
    }
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const analytics = await storage.getAllCrewsAnalytics(profile.id, startDate, endDate);
      
      const crewSummaries = new Map<number, {
        crewId: number;
        totalJobsCompleted: number;
        totalRevenue: number;
        avgUtilization: number;
        avgZoneCompliance: number;
        totalDriveMinutes: number;
        snapshots: number;
      }>();
      
      for (const snap of analytics) {
        if (!crewSummaries.has(snap.crewId)) {
          crewSummaries.set(snap.crewId, {
            crewId: snap.crewId,
            totalJobsCompleted: 0,
            totalRevenue: 0,
            avgUtilization: 0,
            avgZoneCompliance: 0,
            totalDriveMinutes: 0,
            snapshots: 0,
          });
        }
        const summary = crewSummaries.get(snap.crewId)!;
        summary.totalJobsCompleted += snap.jobsCompleted || 0;
        summary.totalRevenue += snap.revenueGenerated || 0;
        summary.avgUtilization += snap.utilizationPercent || 0;
        summary.avgZoneCompliance += snap.zoneCompliancePercent || 0;
        summary.totalDriveMinutes += snap.totalDriveMinutes || 0;
        summary.snapshots += 1;
      }
      
      const summaries = Array.from(crewSummaries.values()).map(s => ({
        ...s,
        avgUtilization: s.snapshots > 0 ? Math.round(s.avgUtilization / s.snapshots) : 0,
        avgZoneCompliance: s.snapshots > 0 ? Math.round(s.avgZoneCompliance / s.snapshots) : 0,
      }));
      
      res.json({ summaries, period: { startDate, endDate, days } });
    } catch (error: any) {
      console.error("[Analytics] Error fetching all crews analytics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Job Requests ---
  app.get("/api/ops/jobs", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const status = req.query.status as string | undefined;
      let jobList;
      if (status) {
        jobList = await storage.getJobRequestsByStatus(profile.id, status);
      } else {
        jobList = await storage.getJobRequests(profile.id);
      }
      res.json(jobList);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching job requests:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ops/jobs/:id", async (req, res) => {
    try {
      const jobRequest = await storage.getJobRequest(parseInt(req.params.id));
      if (!jobRequest) {
        return res.status(404).json({ error: "Job request not found" });
      }
      res.json(jobRequest);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching job request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ops/jobs", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const { 
        customerName, customerPhone, address, lat, lng, zip,
        servicesJson, frequency, lotAreaSqft, lotConfidence,
        requiredSkillsJson, requiredEquipmentJson, crewSizeMin,
        laborLowMinutes, laborHighMinutes 
      } = req.body;
      
      const jobRequest = await storage.createJobRequest({
        businessId: profile.id,
        customerName,
        customerPhone,
        address,
        lat,
        lng,
        zip,
        servicesJson: servicesJson || [],
        frequency: frequency || "unknown",
        lotAreaSqft,
        lotConfidence,
        requiredSkillsJson: requiredSkillsJson || [],
        requiredEquipmentJson: requiredEquipmentJson || [],
        crewSizeMin: crewSizeMin || 1,
        laborLowMinutes,
        laborHighMinutes,
        status: "new",
      });
      res.json(jobRequest);
    } catch (error: any) {
      console.error("[Optimizer] Error creating job request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Simulations ---
  app.get("/api/ops/simulations", async (req, res) => {
    try {
      const jobRequestId = parseInt(req.query.jobRequestId as string);
      if (!jobRequestId) {
        return res.status(400).json({ error: "jobRequestId required" });
      }
      const simulations = await storage.getSimulationsForJobRequest(jobRequestId);
      res.json(simulations);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching simulations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Optimizer API: Simulate ---
  app.post("/api/optimizer/simulate", async (req, res) => {
    try {
      const { 
        jobRequestId, 
        dateRangeDays = 7,
        skillMatchMinPct = 100,
        equipmentMatchMinPct = 100,
        persistTopN = 10,
        returnTopN = 3
      } = req.body;
      
      if (!jobRequestId) {
        return res.status(400).json({ error: "jobRequestId required" });
      }

      const jobRequest = await storage.getJobRequest(jobRequestId);
      if (!jobRequest) {
        return res.status(404).json({ error: "Job request not found" });
      }

      const profile = await storage.getBusinessProfile(jobRequest.businessId);
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      // Use Simulation & Ranking Agent to generate and persist simulations
      const result = await runSimulations(profile.id, jobRequestId, {
        dateRangeDays,
        skillMatchMinPct,
        equipmentMatchMinPct,
        persistTopN,
        returnTopN,
      });

      res.json({
        simulations: result.simulations,
        eligibleCrews: result.eligibleCrews,
        thresholdsUsed: result.thresholdsUsed,
        candidatesGenerated: result.candidatesGenerated,
        candidatesPersisted: result.candidatesPersisted,
      });
    } catch (error: any) {
      console.error("[Optimizer] Error simulating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Optimizer API: Decide ---
  app.post("/api/optimizer/decide", async (req, res) => {
    try {
      const { jobRequestId, simulationId } = req.body;
      if (!jobRequestId || !simulationId) {
        return res.status(400).json({ error: "jobRequestId and simulationId required" });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const result = await orchestratorCreateDecision(
        profile.id,
        jobRequestId,
        simulationId,
        userId
      );

      if (!result.success) {
        const statusCode = result.error?.includes("not authorized") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }

      res.json({
        decision: result.decision,
        reasoningJson: result.reasoningJson,
      });
    } catch (error: any) {
      console.error("[Optimizer] Error creating decision:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Optimizer API: Approve ---
  app.post("/api/optimizer/approve", async (req, res) => {
    try {
      const { decisionId, allowCrewLeadApprove } = req.body;
      if (!decisionId) {
        return res.status(400).json({ error: "decisionId required" });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const config: OrchestratorConfig = {
        allowCrewLeadApprove: allowCrewLeadApprove === true,
      };

      const result = await orchestratorApproveDecision(decisionId, userId, config);

      if (!result.success) {
        const statusCode = result.error?.includes("not authorized") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }

      res.json({
        decision: result.decision,
        writebackTriggered: result.writebackTriggered,
        message: "Assignment approved",
      });
    } catch (error: any) {
      console.error("[Optimizer] Error approving decision:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Ops API: Schedule Items ---
  app.get("/api/ops/schedule", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      const crewId = req.query.crewId ? parseInt(req.query.crewId as string) : undefined;
      const scheduleList = await storage.getScheduleItems(profile.id, crewId);
      res.json(scheduleList);
    } catch (error: any) {
      console.error("[Optimizer] Error fetching schedule:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Customer Memory API Routes
  // ============================================
  const {
    upsertCustomer,
    createMemory,
    getCustomerById,
    getRecentMemories,
    listCustomers,
  } = await import("./memory/storage");
  const { searchMemories, getCustomerWithMemories } = await import("./memory/search");
  const { isEmbeddingsAvailable } = await import("./memory/embedder");
  const {
    memoryUpsertInputSchema,
    memorySearchInputSchema,
  } = await import("@shared/schema");

  // POST /api/memory/upsert - Upsert customer and create memory
  app.post("/api/memory/upsert", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const parsed = memoryUpsertInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { customer, memory } = parsed.data;

      const customerResult = await upsertCustomer(profile.id, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      });

      const memoryResult = await createMemory({
        businessId: profile.id,
        customerId: customerResult.customerId,
        memoryType: memory.memoryType,
        serviceType: memory.serviceType,
        channel: memory.channel,
        importance: memory.importance,
        sentiment: memory.sentiment,
        npsScore: memory.npsScore,
        occurredAt: memory.occurredAt ? new Date(memory.occurredAt) : undefined,
        text: memory.text,
        tagsJson: memory.tagsJson as Record<string, unknown> | undefined,
        sourceEntityType: memory.sourceEntityType,
        sourceEntityId: memory.sourceEntityId,
      });

      res.json({
        customerId: customerResult.customerId,
        customerIsNew: customerResult.isNew,
        memoryId: memoryResult.memoryId,
        memoryIsNew: memoryResult.isNew,
        hasEmbedding: memoryResult.hasEmbedding,
      });
    } catch (error: any) {
      console.error("[Memory] Error upserting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/memory/search - Search customer memories
  app.post("/api/memory/search", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const parsed = memorySearchInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { customerId, queryText, limit, memoryTypes, serviceType } = parsed.data;

      const results = await searchMemories({
        businessId: profile.id,
        customerId,
        queryText,
        limit,
        memoryTypes,
        serviceType,
      });

      res.json({
        results: results.map(r => ({
          memory: r.memory,
          similarity: r.similarity,
          matchType: r.matchType,
        })),
        embeddingsEnabled: isEmbeddingsAvailable(),
      });
    } catch (error: any) {
      console.error("[Memory] Error searching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/memory/customer - Get customer with memories
  app.get("/api/memory/customer", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const customerIdStr = req.query.customerId as string;
      if (!customerIdStr) {
        return res.status(400).json({ error: "customerId required" });
      }
      const customerId = parseInt(customerIdStr, 10);
      if (isNaN(customerId) || customerId <= 0) {
        return res.status(400).json({ error: "customerId must be a valid positive integer" });
      }

      const data = await getCustomerWithMemories(profile.id, customerId);
      if (!data.customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json({
        customer: data.customer,
        memories: data.memories,
        preferences: data.preferences,
        embeddingsEnabled: isEmbeddingsAvailable(),
      });
    } catch (error: any) {
      console.error("[Memory] Error fetching customer:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/memory/customers - List all customers
  app.get("/api/memory/customers", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string | undefined;

      const data = await listCustomers(profile.id, { limit, offset, search });

      res.json({
        customers: data.customers,
        total: data.total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("[Memory] Error listing customers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/memory/status - Check embeddings status
  app.get("/api/memory/status", async (_req, res) => {
    res.json({
      embeddingsEnabled: isEmbeddingsAvailable(),
      embeddingsProvider: isEmbeddingsAvailable() ? "openai" : "disabled",
    });
  });

  // ============================================
  // Dashboard API Endpoints
  // ============================================

  // GET /api/ops/inbox - Unified inbox merging waiting_ops runs, pending actions, and errors
  app.get("/api/ops/inbox", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      const businessId = profile?.id || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      
      // Filter params
      const typeFilter = req.query.type as string | undefined; // orchestration, approval, error
      const urgencyFilter = req.query.urgency as string | undefined; // urgent, warning, normal
      const statusFilter = req.query.status as string | undefined;
      const assignedToMe = req.query.assignedToMe === 'true';

      interface InboxItem {
        id: string;
        type: 'quote' | 'schedule' | 'crew_assign' | 'low_confidence' | 'integration' | 'approval';
        category: 'orchestration' | 'approval' | 'error';
        title: string;
        description: string;
        stage?: string;
        status: string;
        priority: 'urgent' | 'warning' | 'normal';
        createdAt: string;
        dueAt?: string;
        entityType?: string;
        entityId?: number;
        runId?: string;
        actionType?: string;
        ctaLabel: string;
        ctaAction: string;
        // Rich data
        customerName?: string;
        customerAddress?: string;
        customerPhone?: string;
        confidence?: string;
        services?: string[];
        lotSize?: number;
        quoteRange?: { min: number; max: number };
        scheduleWindows?: string[];
        crewRecommendations?: Array<{ id: number; name: string; score?: number }>;
        aiSummary?: string;
        contextJson?: any;
      }

      const items: InboxItem[] = [];
      const now = new Date();

      // Map stage to inbox type
      const stageToType = (stage: string): InboxItem['type'] => {
        if (stage.includes('QUOTE')) return 'quote';
        if (stage.includes('SCHEDULE')) return 'schedule';
        if (stage.includes('CREW') || stage.includes('ASSIGN')) return 'crew_assign';
        return 'low_confidence';
      };

      // 1. Get waiting_ops orchestration runs with job request data
      try {
        const waitingRuns = await db
          .select()
          .from(orchestrationRuns)
          .where(
            and(
              eq(orchestrationRuns.status, "waiting_ops"),
              or(eq(orchestrationRuns.businessId, businessId), isNull(orchestrationRuns.businessId))
            )
          )
          .orderBy(desc(orchestrationRuns.createdAt))
          .limit(limit);

        for (const run of waitingRuns) {
          const createdAt = new Date(run.createdAt);
          const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          const context = run.contextJson as any || {};
          
          // Get job request details if available
          let customerName = context.customerName;
          let customerAddress = context.address;
          let customerPhone = context.phone;
          let services = context.services;
          let lotSize = context.lotSizeSqFt;
          
          if (run.primaryEntityType === 'job_request' && run.primaryEntityId) {
            try {
              const jobRequest = await db.select().from(jobRequests).where(eq(jobRequests.id, run.primaryEntityId)).limit(1);
              if (jobRequest[0]) {
                customerName = customerName || jobRequest[0].customerName;
                customerAddress = customerAddress || jobRequest[0].propertyAddress;
                customerPhone = customerPhone || jobRequest[0].customerPhone;
                services = services || jobRequest[0].serviceTypes;
                lotSize = lotSize || jobRequest[0].lotSizeSqFt;
              }
            } catch {}
          }

          const stage = run.currentStage || 'UNKNOWN';
          const itemType = stageToType(stage);
          
          // Generate AI summary
          let aiSummary = `This ${stage.replace(/_/g, ' ').toLowerCase()} needs your review.`;
          if (run.confidence === 'low') {
            aiSummary = `Low confidence action requires human verification. ` + aiSummary;
          }
          if (context.notes) {
            aiSummary += ` Notes: ${context.notes}`;
          }
          
          items.push({
            id: `orch_${run.id}`,
            type: itemType,
            category: 'orchestration',
            title: `${stage.replace(/_/g, ' ')} needs review`,
            description: customerName ? `Customer: ${customerName}` : `Orchestration run waiting for approval`,
            stage: stage,
            status: run.status,
            priority: hoursSince > 4 ? 'urgent' : hoursSince > 2 ? 'warning' : 'normal',
            createdAt: run.createdAt.toISOString(),
            entityType: run.primaryEntityType,
            entityId: run.primaryEntityId,
            runId: run.runId,
            ctaLabel: itemType === 'quote' ? 'Review Quote' : itemType === 'schedule' ? 'Review Schedule' : 'Review',
            ctaAction: `/api/ops/inbox/resolve`,
            customerName,
            customerAddress,
            customerPhone,
            confidence: run.confidence,
            services,
            lotSize,
            quoteRange: context.quoteRange,
            scheduleWindows: context.scheduleWindows,
            crewRecommendations: context.crewRecommendations,
            aiSummary,
            contextJson: context,
          });
        }
      } catch (e) {
        console.warn("[Inbox] Could not fetch orchestration runs:", e);
      }

      // 2. Get pending actions
      try {
        const allPendingActions = await storage.getPendingActions();
        const pending = allPendingActions.filter(a => a.status === "pending").slice(0, limit);

        for (const action of pending) {
          const createdAt = new Date(action.createdAt);
          const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          const payload = action.payload as any || {};
          
          // Get conversation for customer info
          let customerName: string | undefined;
          let customerPhone: string | undefined;
          try {
            const conv = await storage.getConversation(action.conversationId);
            customerName = conv?.customerName || undefined;
            customerPhone = conv?.customerPhone || undefined;
          } catch {}
          
          items.push({
            id: `action_${action.id}`,
            type: action.actionType === 'send_quote' ? 'quote' : 'approval',
            category: 'approval',
            title: action.description || 'Pending approval',
            description: customerName ? `Customer: ${customerName}` : `${action.actionType?.replace(/_/g, ' ')} requires your review`,
            status: action.status,
            priority: hoursSince > 4 ? 'urgent' : hoursSince > 2 ? 'warning' : 'normal',
            createdAt: action.createdAt.toISOString(),
            entityId: action.id,
            actionType: action.actionType,
            ctaLabel: 'Approve',
            ctaAction: `/api/ops/inbox/resolve`,
            customerName,
            customerPhone,
            aiSummary: `Action "${action.actionType?.replace(/_/g, ' ')}" is ready to be approved.`,
            contextJson: payload,
          });
        }
      } catch (e) {
        console.warn("[Inbox] Could not fetch pending actions:", e);
      }

      // 3. Get recent integration errors (from dead letter queue and reconciliation alerts)
      try {
        const errors = await db
          .select()
          .from(deadLetterQueue)
          .where(eq(deadLetterQueue.status, "pending"))
          .orderBy(desc(deadLetterQueue.createdAt))
          .limit(5);

        for (const error of errors) {
          items.push({
            id: `dlq_${error.id}`,
            type: 'integration',
            category: 'error',
            title: `Integration error: ${error.errorType}`,
            description: error.errorMessage?.substring(0, 100) || 'Failed webhook or integration',
            status: error.status,
            priority: 'urgent',
            createdAt: error.createdAt.toISOString(),
            ctaLabel: 'Retry',
            ctaAction: `/api/dlq/${error.id}/retry`,
            aiSummary: `An integration error occurred: ${error.errorMessage}. Retry to attempt recovery.`,
          });
        }

        // Also get reconciliation alerts
        const alerts = await db
          .select()
          .from(reconciliationAlerts)
          .where(eq(reconciliationAlerts.status, "open"))
          .orderBy(desc(reconciliationAlerts.createdAt))
          .limit(3);

        for (const alert of alerts) {
          items.push({
            id: `recon_${alert.id}`,
            type: 'integration',
            category: 'error',
            title: `Reconciliation: ${alert.alertType}`,
            description: alert.details ? JSON.stringify(alert.details).substring(0, 100) : 'Needs review',
            status: alert.status,
            priority: 'warning',
            createdAt: alert.createdAt.toISOString(),
            entityId: alert.id,
            ctaLabel: 'Review',
            ctaAction: `/api/reconciliation/alerts/${alert.id}`,
            aiSummary: `A reconciliation issue was detected. Review and resolve the discrepancy.`,
          });
        }
      } catch (e) {
        console.warn("[Inbox] Could not fetch errors:", e);
      }

      // Apply filters
      let filteredItems = items;
      
      if (typeFilter) {
        filteredItems = filteredItems.filter(i => i.type === typeFilter);
      }
      if (urgencyFilter) {
        filteredItems = filteredItems.filter(i => i.priority === urgencyFilter);
      }
      if (statusFilter) {
        filteredItems = filteredItems.filter(i => i.status === statusFilter);
      }

      // Sort by priority and createdAt
      const priorityOrder = { urgent: 0, warning: 1, normal: 2 };
      filteredItems.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(filteredItems.slice(0, limit));
    } catch (error: any) {
      console.error("[Inbox] Error:", error);
      res.json([]);
    }
  });

  // POST /api/ops/inbox/resolve - Resolve an inbox item
  app.post("/api/ops/inbox/resolve", async (req, res) => {
    try {
      const { itemId, action, payload } = req.body;
      
      if (!itemId || !action) {
        return res.status(400).json({ error: "itemId and action are required" });
      }

      // Parse item type from ID
      const [itemType, idStr] = itemId.split('_');
      const id = parseInt(idStr);

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID format" });
      }

      let result: any = { success: true };

      if (itemType === 'orch') {
        // Resolve orchestration run
        const run = await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, id)).limit(1);
        if (!run[0]) {
          return res.status(404).json({ error: "Orchestration run not found" });
        }

        if (action === 'approve') {
          // Create an approval step and advance the run
          const stepData = {
            orchestrationRunId: id,
            stage: run[0].currentStage || 'UNKNOWN',
            startedAt: new Date(),
            completedAt: new Date(),
            inputJson: payload || {},
            decisionJson: {
              advance: true,
              approved: true,
              approvedBy: 'operator',
              approvedAt: new Date().toISOString(),
              ...payload,
            },
          };

          await db.insert(orchestrationSteps).values(stepData);

          // Update the run status to running (or next stage)
          await db.update(orchestrationRuns)
            .set({ 
              status: 'running', 
              updatedAt: new Date(),
            })
            .where(eq(orchestrationRuns.id, id));

          result.message = "Orchestration run approved and resumed";
          result.runId = run[0].runId;
        } else if (action === 'request_info') {
          // Set to waiting_customer and trigger SMS
          await db.update(orchestrationRuns)
            .set({ 
              status: 'waiting_customer',
              updatedAt: new Date(),
            })
            .where(eq(orchestrationRuns.id, id));

          // If there's a message to send, queue it
          if (payload?.message && run[0].primaryEntityId) {
            const jobRequest = await db.select().from(jobRequests).where(eq(jobRequests.id, run[0].primaryEntityId)).limit(1);
            if (jobRequest[0]?.customerPhone) {
              await storage.createPendingAction({
                conversationId: jobRequest[0].conversationId || 1,
                actionType: 'send_sms',
                description: 'Request more information from customer',
                payload: {
                  to: jobRequest[0].customerPhone,
                  message: payload.message,
                },
              });
            }
          }

          result.message = "Requested more information from customer";
        } else if (action === 'reject' || action === 'cancel') {
          await db.update(orchestrationRuns)
            .set({ 
              status: 'canceled',
              updatedAt: new Date(),
            })
            .where(eq(orchestrationRuns.id, id));

          result.message = "Orchestration run canceled";
        }
      } else if (itemType === 'action') {
        // Resolve pending action
        const actionRecord = await storage.getPendingAction(id);
        if (!actionRecord) {
          return res.status(404).json({ error: "Pending action not found" });
        }

        if (action === 'approve') {
          await storage.approvePendingAction(id);
          result.message = "Action approved";
        } else if (action === 'reject') {
          await db.update(pendingActions)
            .set({ 
              status: 'rejected',
              resolvedAt: new Date(),
              resolvedBy: 'operator',
            })
            .where(eq(pendingActions.id, id));
          result.message = "Action rejected";
        }
      } else if (itemType === 'dlq') {
        // Retry dead letter queue item
        if (action === 'retry') {
          await db.update(deadLetterQueue)
            .set({ 
              status: 'retrying',
              retryCount: sql`retry_count + 1`,
              nextRetryAt: new Date(),
            })
            .where(eq(deadLetterQueue.id, id));
          result.message = "Queued for retry";
        } else if (action === 'dismiss') {
          await db.update(deadLetterQueue)
            .set({ status: 'resolved' })
            .where(eq(deadLetterQueue.id, id));
          result.message = "Error dismissed";
        }
      } else if (itemType === 'recon') {
        // Resolve reconciliation alert
        if (action === 'resolve' || action === 'dismiss') {
          await db.update(reconciliationAlerts)
            .set({ 
              status: 'resolved',
              resolvedAt: new Date(),
            })
            .where(eq(reconciliationAlerts.id, id));
          result.message = "Alert resolved";
        }
      } else {
        return res.status(400).json({ error: `Unknown item type: ${itemType}` });
      }

      res.json(result);
    } catch (error: any) {
      console.error("[Inbox] Resolve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ops/inbox/:id - Get single inbox item details with audit trail
  app.get("/api/ops/inbox/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [itemType, idStr] = id.split('_');
      const numId = parseInt(idStr);

      if (isNaN(numId)) {
        return res.status(400).json({ error: "Invalid item ID format" });
      }

      let item: any = null;
      let auditTrail: any[] = [];

      if (itemType === 'orch') {
        const run = await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, numId)).limit(1);
        if (!run[0]) {
          return res.status(404).json({ error: "Not found" });
        }

        // Get job request details
        let jobRequest: any = null;
        if (run[0].primaryEntityType === 'job_request' && run[0].primaryEntityId) {
          const jr = await db.select().from(jobRequests).where(eq(jobRequests.id, run[0].primaryEntityId)).limit(1);
          jobRequest = jr[0] || null;
        }

        // Get orchestration steps as audit trail
        const steps = await db
          .select()
          .from(orchestrationSteps)
          .where(eq(orchestrationSteps.orchestrationRunId, numId))
          .orderBy(orchestrationSteps.startedAt);

        auditTrail = steps.map(s => ({
          id: s.id,
          stage: s.stage,
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt?.toISOString(),
          decision: s.decisionJson,
        }));

        const context = run[0].contextJson as any || {};
        item = {
          id: `orch_${numId}`,
          type: 'orchestration',
          run: run[0],
          jobRequest,
          customerName: jobRequest?.customerName || context.customerName,
          customerPhone: jobRequest?.customerPhone || context.phone,
          customerAddress: jobRequest?.propertyAddress || context.address,
          services: jobRequest?.serviceTypes || context.services,
          lotSize: jobRequest?.lotSizeSqFt || context.lotSizeSqFt,
          confidence: run[0].confidence,
          stage: run[0].currentStage,
          contextJson: context,
          auditTrail,
        };
      } else if (itemType === 'action') {
        const action = await storage.getPendingAction(numId);
        if (!action) {
          return res.status(404).json({ error: "Not found" });
        }

        const conv = await storage.getConversation(action.conversationId);
        item = {
          id: `action_${numId}`,
          type: 'approval',
          action,
          customerName: conv?.customerName,
          customerPhone: conv?.customerPhone,
          contextJson: action.payload,
          auditTrail: [],
        };
      }

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("[Inbox] Error fetching item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/dashboard/today - Today's stats
  app.get("/api/dashboard/today", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      const businessId = profile?.id || 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Scheduled jobs for today
      let scheduledJobsToday = 0;
      let crewUtilization = 0;
      try {
        // Get all schedule items for this business and filter in JS
        const allSchedule = await db
          .select()
          .from(scheduleItems)
          .where(eq(scheduleItems.businessId, businessId));
        
        // Filter for today and future
        const todaySchedule = allSchedule.filter(s => {
          if (!s.scheduledDate) return false;
          const schedDate = new Date(s.scheduledDate);
          schedDate.setHours(0, 0, 0, 0);
          return schedDate >= today;
        });
        scheduledJobsToday = todaySchedule.length;
        
        const crews = await storage.getCrews(businessId);
        if (crews.length > 0) {
          const totalCapacity = crews.reduce((sum, c) => sum + (c.dailyCapacityMinutes || 480), 0);
          const usedCapacity = todaySchedule.reduce((sum, s) => sum + (s.estimatedDurationMinutes || 60), 0);
          crewUtilization = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;
        }
      } catch (e) {
        console.warn("[Dashboard] Could not fetch schedule:", e);
      }

      // Pending quotes
      let pendingQuotes = 0;
      try {
        const quotes = await storage.getPendingQuoteProposals(businessId);
        pendingQuotes = quotes.length;
      } catch (e) {
        console.warn("[Dashboard] Could not fetch quotes:", e);
      }

      // Unread messages (approximation from conversations updated recently)
      let unreadMessages = 0;
      try {
        const conversations = await storage.getConversations();
        unreadMessages = conversations.filter(c => 
          c.status === "active" && 
          new Date(c.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length;
      } catch (e) {
        console.warn("[Dashboard] Could not fetch messages:", e);
      }

      res.json({
        scheduledJobsToday,
        crewUtilization,
        pendingQuotes,
        unreadMessages,
      });
    } catch (error: any) {
      console.error("[Dashboard] Error:", error);
      res.json({ scheduledJobsToday: 0, crewUtilization: 0, pendingQuotes: 0, unreadMessages: 0 });
    }
  });

  // GET /api/dashboard/agent-activity - Recent agent runs and orchestration steps
  app.get("/api/dashboard/agent-activity", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      const businessId = profile?.id || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      interface ActivityItem {
        id: number;
        type: 'step' | 'agent_run';
        agentName?: string;
        stage?: string;
        status: string;
        isError: boolean;
        isStuck: boolean;
        durationMs?: number;
        createdAt: string;
        message?: string;
      }

      const activities: ActivityItem[] = [];

      // Get recent orchestration steps
      try {
        const steps = await db
          .select({
            step: orchestrationSteps,
            run: orchestrationRuns,
          })
          .from(orchestrationSteps)
          .innerJoin(orchestrationRuns, eq(orchestrationSteps.orchestrationRunId, orchestrationRuns.id))
          .where(or(eq(orchestrationRuns.businessId, businessId), isNull(orchestrationRuns.businessId)))
          .orderBy(desc(orchestrationSteps.startedAt))
          .limit(limit);

        for (const { step, run } of steps) {
          const decision = step.decisionJson as any;
          const isError = decision?.advance === false && decision?.error;
          const isStuck = !step.completedAt && 
            new Date(step.startedAt).getTime() < Date.now() - 30 * 60 * 1000;

          activities.push({
            id: step.id,
            type: 'step',
            stage: step.stage,
            status: step.completedAt ? 'completed' : 'running',
            isError: !!isError,
            isStuck: !!isStuck,
            durationMs: step.completedAt 
              ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
              : undefined,
            createdAt: step.startedAt.toISOString(),
            message: decision?.notes || decision?.nextStage,
          });
        }
      } catch (e) {
        console.warn("[Dashboard] Could not fetch orchestration steps:", e);
      }

      // Get recent agent runs
      try {
        const runs = await db
          .select({
            run: agentRuns,
            agent: agentRegistry,
          })
          .from(agentRuns)
          .innerJoin(agentRegistry, eq(agentRuns.agentId, agentRegistry.id))
          .where(or(eq(agentRuns.businessId, businessId), isNull(agentRuns.businessId)))
          .orderBy(desc(agentRuns.createdAt))
          .limit(limit);

        for (const { run, agent } of runs) {
          activities.push({
            id: run.id,
            type: 'agent_run',
            agentName: agent.displayName,
            status: run.status,
            isError: run.status === 'failed',
            isStuck: run.status === 'running' && 
              new Date(run.createdAt).getTime() < Date.now() - 15 * 60 * 1000,
            durationMs: run.durationMs || undefined,
            createdAt: run.createdAt.toISOString(),
            message: run.errorMessage || undefined,
          });
        }
      } catch (e) {
        console.warn("[Dashboard] Could not fetch agent runs:", e);
      }

      // Sort by createdAt descending
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(activities.slice(0, limit));
    } catch (error: any) {
      console.error("[Dashboard] Error:", error);
      res.json([]);
    }
  });

  // GET /api/dashboard/customer-health - Customer health metrics
  app.get("/api/dashboard/customer-health", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      const businessId = profile?.id || 1;

      let npsAverage: number | null = null;
      let lowSentimentCount = 0;
      const lowSentimentCustomers: Array<{id: number; name?: string; sentiment?: string}> = [];

      // Check if customer profiles exist
      try {
        const customers = await db
          .select()
          .from(customerProfiles)
          .where(eq(customerProfiles.businessId, businessId))
          .limit(100);

        if (customers.length > 0) {
          const customerIds = new Set(customers.map(c => c.id));
          const customerMap = new Map(customers.map(c => [c.id, c]));
          
          // Get all outcome memories for these customers
          const allMemories = await db
            .select()
            .from(customerMemories)
            .where(eq(customerMemories.category, "outcome"))
            .orderBy(desc(customerMemories.createdAt))
            .limit(200);

          // Filter to only customers in our tenant and calculate NPS
          const tenantMemories = allMemories.filter(m => customerIds.has(m.customerId));
          
          const npsScores = tenantMemories
            .map(m => (m.metadata as any)?.nps)
            .filter((n): n is number => typeof n === 'number');
          
          if (npsScores.length > 0) {
            npsAverage = Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length);
          }

          // Find low sentiment customers
          const lowSentimentMemories = tenantMemories.filter(m => {
            const sentiment = (m.metadata as any)?.sentiment;
            return sentiment === 'negative' || sentiment === 'frustrated';
          }).slice(0, 5);

          lowSentimentCount = lowSentimentMemories.length;
          for (const memory of lowSentimentMemories) {
            const customer = customerMap.get(memory.customerId);
            if (customer) {
              lowSentimentCustomers.push({
                id: customer.id,
                name: customer.name || undefined,
                sentiment: (memory.metadata as any)?.sentiment,
              });
            }
          }
        }
      } catch (e) {
        console.warn("[Dashboard] Could not fetch customer health:", e);
      }

      res.json({
        npsAverage,
        lowSentimentCount,
        lowSentimentCustomers,
        hasData: npsAverage !== null || lowSentimentCount > 0,
      });
    } catch (error: any) {
      console.error("[Dashboard] Error:", error);
      res.json({ npsAverage: null, lowSentimentCount: 0, lowSentimentCustomers: [], hasData: false });
    }
  });

  // ============================================
  // Agent Directory API Routes
  // ============================================

  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error: any) {
      console.error("[Agents] Error fetching agents:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid agent ID" });
      }
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error: any) {
      console.error("[Agents] Error fetching agent:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/agents/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid agent ID" });
      }
      const { status } = req.body;
      if (!["active", "paused", "error", "needs_config"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const agent = await storage.updateAgent(id, { status });
      res.json(agent);
    } catch (error: any) {
      console.error("[Agents] Error updating agent status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents/:id/runs", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid agent ID" });
      }
      const limit = parseInt(req.query.limit as string) || 10;
      const runs = await storage.getAgentRuns(id, limit);
      res.json(runs);
    } catch (error: any) {
      console.error("[Agents] Error fetching agent runs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/:id/test", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid agent ID" });
      }
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { jobRequestId } = req.body;
      const runId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const run = await storage.createAgentRun({
        agentId: id,
        runId,
        triggeredBy: "manual",
        status: "running",
        isTestRun: true,
        jobRequestId: jobRequestId || null,
        eventPayload: req.body,
      });
      
      setTimeout(async () => {
        try {
          const success = Math.random() > 0.1;
          await storage.updateAgentRun(run.id, {
            status: success ? "success" : "failed",
            completedAt: new Date(),
            durationMs: Math.floor(Math.random() * 2000) + 500,
            result: success ? { message: "Test completed successfully", items: Math.floor(Math.random() * 5) + 1 } : null,
            error: success ? null : "Simulated test failure",
          });
          await storage.updateAgent(id, { lastRunAt: new Date() });
        } catch (e) {
          console.error("[Agents] Error completing test run:", e);
        }
      }, 1500);
      
      res.json({ run, message: "Test run started" });
    } catch (error: any) {
      console.error("[Agents] Error starting test run:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/seed", async (req, res) => {
    try {
      const { seedAgents } = await import("./seed-agents");
      await seedAgents();
      const agents = await storage.getAgents();
      res.json({ success: true, count: agents.length, agents });
    } catch (error: any) {
      console.error("[Agents] Error seeding agents:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== LEARNING SYSTEM ROUTES ====================
  
  // Seed learning system (reason codes + initial policy)
  app.post("/api/learning/seed", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { seedLearningSystem } = await import("./lib/learning/seed");
      const result = await seedLearningSystem(businessId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[Learning] Error seeding learning system:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/reason-codes - Get reason codes for a decision type
  app.get("/api/learning/reason-codes", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const decisionType = req.query.decisionType as string || "";
      const { getReasonCodesForDecision } = await import("./lib/learning/seed");
      const codes = await getReasonCodesForDecision(businessId, decisionType);
      res.json(codes);
    } catch (error: any) {
      console.error("[Learning] Error fetching reason codes:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/active-policy - Get current active policy
  app.get("/api/learning/active-policy", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { getActivePolicy } = await import("./lib/learning/seed");
      const policy = await getActivePolicy(businessId);
      if (!policy) {
        return res.status(404).json({ error: "No active policy found" });
      }
      res.json(policy);
    } catch (error: any) {
      console.error("[Learning] Error fetching active policy:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/learning/decision - Log an AI decision
  app.post("/api/learning/decision", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { logDecision } = await import("./lib/learning");
      const decisionId = await logDecision({ ...req.body, businessId });
      res.json({ success: true, decisionId });
    } catch (error: any) {
      console.error("[Learning] Error logging decision:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/learning/human-action - Log a human action on a decision
  app.post("/api/learning/human-action", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const userId = (req.user as any)?.id || 1;
      const role = (req.user as any)?.role || "OWNER";
      const { logHumanAction } = await import("./lib/learning");
      const humanActionId = await logHumanAction({ 
        ...req.body, 
        businessId, 
        userId,
        role 
      });
      res.json({ success: true, humanActionId });
    } catch (error: any) {
      console.error("[Learning] Error logging human action:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/learning/outcome - Log an outcome event
  app.post("/api/learning/outcome", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { logOutcome } = await import("./lib/learning");
      const outcomeId = await logOutcome({ ...req.body, businessId });
      res.json({ success: true, outcomeId });
    } catch (error: any) {
      console.error("[Learning] Error logging outcome:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/decisions - Query decision logs
  app.get("/api/learning/decisions", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const decisionType = req.query.decisionType as string;
      
      let query = db.select().from(decisionLogs).where(eq(decisionLogs.businessId, businessId));
      
      if (decisionType) {
        query = db.select().from(decisionLogs).where(
          and(eq(decisionLogs.businessId, businessId), eq(decisionLogs.decisionType, decisionType as any))
        );
      }
      
      const decisions = await query.orderBy(desc(decisionLogs.createdAt)).limit(limit);
      res.json(decisions);
    } catch (error: any) {
      console.error("[Learning] Error fetching decisions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/human-actions - Query human action logs
  app.get("/api/learning/human-actions", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const actions = await db.select()
        .from(humanActionLogs)
        .where(eq(humanActionLogs.businessId, businessId))
        .orderBy(desc(humanActionLogs.createdAt))
        .limit(limit);
      res.json(actions);
    } catch (error: any) {
      console.error("[Learning] Error fetching human actions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/outcomes - Query outcome logs
  app.get("/api/learning/outcomes", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const outcomes = await db.select()
        .from(outcomeLogs)
        .where(eq(outcomeLogs.businessId, businessId))
        .orderBy(desc(outcomeLogs.occurredAt))
        .limit(limit);
      res.json(outcomes);
    } catch (error: any) {
      console.error("[Learning] Error fetching outcomes:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/metrics - Aggregate metrics for learning dashboard
  app.get("/api/learning/metrics", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const daysBack = parseInt(req.query.days as string) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      
      // Get decision counts by type
      const decisions = await db.select()
        .from(decisionLogs)
        .where(and(
          eq(decisionLogs.businessId, businessId),
          gte(decisionLogs.createdAt, cutoff)
        ));
      
      const humanActions = await db.select()
        .from(humanActionLogs)
        .where(and(
          eq(humanActionLogs.businessId, businessId),
          gte(humanActionLogs.createdAt, cutoff)
        ));
      
      const outcomes = await db.select()
        .from(outcomeLogs)
        .where(and(
          eq(outcomeLogs.businessId, businessId),
          gte(outcomeLogs.occurredAt, cutoff)
        ));
      
      // Compute metrics
      const totalDecisions = decisions.length;
      const approvedCount = humanActions.filter(a => a.actionType === "approve").length;
      const editedCount = humanActions.filter(a => a.actionType === "edit").length;
      const rejectedCount = humanActions.filter(a => a.actionType === "reject").length;
      const overrideRate = totalDecisions > 0 ? ((editedCount + rejectedCount) / totalDecisions * 100) : 0;
      
      const avgTimeToAction = humanActions.length > 0
        ? Math.round(humanActions.reduce((sum, a) => sum + (a.timeToActionSeconds || 0), 0) / humanActions.length)
        : 0;
      
      // Confidence distribution
      const highConfidence = decisions.filter(d => d.confidence === "high").length;
      const mediumConfidence = decisions.filter(d => d.confidence === "medium").length;
      const lowConfidence = decisions.filter(d => d.confidence === "low").length;
      
      // Reason code frequency
      const reasonCodeCounts: Record<string, number> = {};
      for (const action of humanActions) {
        const codes = action.reasonCodesJson as string[] || [];
        for (const code of codes) {
          reasonCodeCounts[code] = (reasonCodeCounts[code] || 0) + 1;
        }
      }
      const topReasonCodes = Object.entries(reasonCodeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({ code, count }));
      
      // Outcome breakdown
      const outcomeCounts: Record<string, number> = {};
      for (const outcome of outcomes) {
        outcomeCounts[outcome.outcomeType] = (outcomeCounts[outcome.outcomeType] || 0) + 1;
      }
      
      res.json({
        period: { days: daysBack, cutoff: cutoff.toISOString() },
        decisions: {
          total: totalDecisions,
          byConfidence: { high: highConfidence, medium: mediumConfidence, low: lowConfidence },
        },
        humanActions: {
          total: humanActions.length,
          approved: approvedCount,
          edited: editedCount,
          rejected: rejectedCount,
          overrideRate: Math.round(overrideRate * 10) / 10,
          avgTimeToActionSeconds: avgTimeToAction,
        },
        outcomes: outcomeCounts,
        topReasonCodes,
      });
    } catch (error: any) {
      console.error("[Learning] Error fetching metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/policy-versions - List all policy versions
  app.get("/api/learning/policy-versions", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const versions = await db.select()
        .from(policyVersions)
        .where(eq(policyVersions.businessId, businessId))
        .orderBy(desc(policyVersions.createdAt));
      res.json(versions);
    } catch (error: any) {
      console.error("[Learning] Error fetching policy versions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/suggestions - List tuning suggestions
  app.get("/api/learning/suggestions", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const status = req.query.status as string;
      
      let query = db.select()
        .from(policyTuningSuggestions)
        .where(eq(policyTuningSuggestions.businessId, businessId));
      
      if (status) {
        query = db.select()
          .from(policyTuningSuggestions)
          .where(and(
            eq(policyTuningSuggestions.businessId, businessId),
            eq(policyTuningSuggestions.status, status as any)
          ));
      }
      
      const suggestions = await query.orderBy(desc(policyTuningSuggestions.createdAt));
      res.json(suggestions);
    } catch (error: any) {
      console.error("[Learning] Error fetching suggestions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PATCH /api/learning/suggestions/:id - Update suggestion status
  app.patch("/api/learning/suggestions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id || 1;
      const { status } = req.body;
      
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }
      
      const [updated] = await db.update(policyTuningSuggestions)
        .set({ 
          status, 
          reviewedByUserId: userId,
          reviewedAt: new Date()
        })
        .where(eq(policyTuningSuggestions.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("[Learning] Error updating suggestion:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/learning/suggestions/generate - Generate new suggestions from decision analysis
  app.post("/api/learning/suggestions/generate", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { generateSuggestions } = await import("./lib/learning/suggestions");
      
      const result = await generateSuggestions(businessId);
      res.json(result);
    } catch (error: any) {
      console.error("[Learning] Error generating suggestions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/learning/kill-switches - List kill switches
  app.get("/api/learning/kill-switches", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const switches = await db.select()
        .from(killSwitches)
        .where(eq(killSwitches.businessId, businessId))
        .orderBy(desc(killSwitches.createdAt));
      res.json(switches);
    } catch (error: any) {
      console.error("[Learning] Error fetching kill switches:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/learning/kill-switches - Create a kill switch
  app.post("/api/learning/kill-switches", async (req, res) => {
    try {
      const businessId = (req.user as any)?.businessId || 1;
      const { scope, scopeId, reason } = req.body;
      
      if (!scope || !["global", "agent", "stage", "decision_type"].includes(scope)) {
        return res.status(400).json({ error: "Invalid scope" });
      }
      
      const [created] = await db.insert(killSwitches).values({
        businessId,
        scope,
        scopeValue: scopeId || scope, // Use scopeId if provided, otherwise scope as value
        isEnabled: true,
        reason: reason || null,
      }).returning();
      
      res.json(created);
    } catch (error: any) {
      console.error("[Learning] Error creating kill switch:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PATCH /api/learning/kill-switches/:id - Toggle kill switch
  app.patch("/api/learning/kill-switches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      
      const [updated] = await db.update(killSwitches)
        .set({ isEnabled: Boolean(isActive) })
        .where(eq(killSwitches.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Kill switch not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("[Learning] Error updating kill switch:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Crew Comms API Routes
  // ============================================
  const { sendCrewNotification, broadcastToCrews, notifyJobChange } = await import("./workers/crewComms");

  // GET /api/crew-comms/notifications - Get notifications for current user
  app.get("/api/crew-comms/notifications", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const notificationsList = await storage.getNotifications(userId, limit);
      res.json(notificationsList);
    } catch (error: any) {
      console.error("[CrewComms] Error fetching notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/crew-comms/notifications/unread - Get unread count
  app.get("/api/crew-comms/notifications/unread", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const unread = await storage.getUnreadNotifications(userId);
      res.json({ count: unread.length, notifications: unread.slice(0, 5) });
    } catch (error: any) {
      console.error("[CrewComms] Error fetching unread:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/notifications/:id/ack - Acknowledge a notification
  app.post("/api/crew-comms/notifications/:id/ack", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      if (notification.recipientUserId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.ackNotification(notificationId);
      res.json(updated);
    } catch (error: any) {
      console.error("[CrewComms] Error acknowledging notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/notifications/mark-seen - Mark multiple as seen
  app.post("/api/crew-comms/notifications/mark-seen", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { notificationIds } = req.body;
      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({ error: "notificationIds array required" });
      }
      
      await storage.markNotificationsSeen(userId, notificationIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CrewComms] Error marking seen:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/send - Send a notification (admin only)
  app.post("/api/crew-comms/send", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can send notifications" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      
      const { type, recipientUserIds, crewId, context, channels, priority } = req.body;
      
      if (!type) {
        return res.status(400).json({ error: "type required" });
      }
      
      const results = await sendCrewNotification({
        businessId: profile.id,
        type,
        recipientUserIds,
        crewId,
        context: context || {},
        channels,
        priority,
      });
      
      res.json({ 
        success: true, 
        sent: results.length,
        results 
      });
    } catch (error: any) {
      console.error("[CrewComms] Error sending notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/broadcast - Broadcast to crews (admin only)
  app.post("/api/crew-comms/broadcast", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can broadcast" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      
      const { crewIds, message, senderName, channels } = req.body;
      
      if (!crewIds || !Array.isArray(crewIds) || crewIds.length === 0) {
        return res.status(400).json({ error: "crewIds array required" });
      }
      
      if (!message) {
        return res.status(400).json({ error: "message required" });
      }
      
      const results = await broadcastToCrews(
        profile.id,
        crewIds,
        message,
        senderName || "Admin",
        channels
      );
      
      res.json({ 
        success: true, 
        sent: results.length,
        results 
      });
    } catch (error: any) {
      console.error("[CrewComms] Error broadcasting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/crew-comms/preferences - Get current user's preferences
  app.get("/api/crew-comms/preferences", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const prefs = await storage.getCrewCommsPreference(userId);
      res.json(prefs || { userId, smsEnabled: true, pushEnabled: true, language: "EN" });
    } catch (error: any) {
      console.error("[CrewComms] Error fetching preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/crew-comms/preferences - Update preferences
  app.put("/api/crew-comms/preferences", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      
      const { smsEnabled, pushEnabled, quietHoursStart, quietHoursEnd, language, phoneE164 } = req.body;
      
      const existing = await storage.getCrewCommsPreference(userId);
      
      if (existing) {
        const updated = await storage.updateCrewCommsPreference(userId, {
          smsEnabled: smsEnabled ?? existing.smsEnabled,
          pushEnabled: pushEnabled ?? existing.pushEnabled,
          quietHoursStart: quietHoursStart ?? existing.quietHoursStart,
          quietHoursEnd: quietHoursEnd ?? existing.quietHoursEnd,
          language: language ?? existing.language,
          phoneE164: phoneE164 ?? existing.phoneE164,
        });
        res.json(updated);
      } else {
        const created = await storage.createCrewCommsPreference({
          businessId: profile.id,
          userId,
          smsEnabled: smsEnabled ?? true,
          pushEnabled: pushEnabled ?? true,
          quietHoursStart,
          quietHoursEnd,
          language: language ?? "EN",
          phoneE164,
        });
        res.json(created);
      }
    } catch (error: any) {
      console.error("[CrewComms] Error updating preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/push-subscribe - Register push subscription
  app.post("/api/crew-comms/push-subscribe", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { endpoint, keys, userAgent } = req.body;
      
      if (!endpoint || !keys) {
        return res.status(400).json({ error: "endpoint and keys required" });
      }
      
      const subscription = await storage.createPushSubscription({
        userId,
        endpoint,
        keysJson: keys,
        userAgent,
      });
      
      res.json({ success: true, id: subscription.id });
    } catch (error: any) {
      console.error("[CrewComms] Error registering push:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/crew-comms/push-subscribe - Unregister push subscription
  app.delete("/api/crew-comms/push-subscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ error: "endpoint required" });
      }
      
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CrewComms] Error unregistering push:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/crew-comms/threads - Get SMS threads (admin only)
  app.get("/api/crew-comms/threads", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can view threads" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const threads = await storage.getCommsThreads(profile.id, limit);
      res.json(threads);
    } catch (error: any) {
      console.error("[CrewComms] Error fetching threads:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/crew-comms/threads/:id/messages - Get messages in a thread
  app.get("/api/crew-comms/threads/:id/messages", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can view messages" });
      }
      
      const threadId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getCommsMessages(threadId, limit);
      res.json(messages);
    } catch (error: any) {
      console.error("[CrewComms] Error fetching messages:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crew-comms/test - Send a test notification to current user (admin only)
  app.post("/api/crew-comms/test", async (req, res) => {
    try {
      const role = (req.user as any)?.role || "OWNER";
      if (role !== "OWNER" && role !== "ADMIN") {
        return res.status(403).json({ error: "Only OWNER or ADMIN can send test notifications" });
      }
      
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      
      const { type = "DAILY_BRIEFING" } = req.body;
      
      const testContext: Record<string, any> = {
        DAILY_BRIEFING: {
          crewName: "Alpha Crew",
          jobCount: 5,
          routeSummary: "5 jobs starting at 123 Main St",
          briefingDate: new Date().toLocaleDateString(),
        },
        JOB_ADDED: {
          customerName: "John Smith",
          address: "456 Oak Avenue",
          scheduledTime: "10:00 AM",
          serviceType: "Lawn Mowing",
        },
        JOB_CANCELED: {
          customerName: "Jane Doe",
          address: "789 Pine Street",
          cancelReason: "Customer requested reschedule",
        },
        ACTION_REQUIRED: {
          actionType: "Approval needed",
          description: "Review and approve the new job assignment",
          deadline: "Today by 5 PM",
        },
        CREW_BROADCAST: {
          broadcastMessage: "Team meeting at 8 AM tomorrow - please confirm attendance",
          senderName: "Operations Manager",
        },
      };
      
      const context = testContext[type] || testContext.DAILY_BRIEFING;
      
      const results = await sendCrewNotification({
        businessId: profile.id,
        type,
        recipientUserIds: [userId],
        context,
        channels: ["IN_APP"],
        priority: "normal",
      });
      
      res.json({ 
        success: true, 
        message: `Test ${type} notification sent`,
        results 
      });
    } catch (error: any) {
      console.error("[CrewComms] Error sending test notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // UI Refactor V1 - New Command Center APIs
  // ============================================

  app.get("/api/ops/kpis", async (req, res) => {
    try {
      const profile = await storage.getBusinessProfile();
      if (!profile) {
        return res.json({
          leadsToday: { new: 0, pending: 0, escalated: 0 },
          quotesOut: { awaitingApproval: 0, sent: 0, accepted: 0 },
          jobsToday: { scheduled: 0, atRisk: 0, unassigned: 0 },
          crewStatus: { available: 0, onSite: 0, delayed: 0 },
        });
      }

      const pendingActions = await storage.getPendingActions();
      const jobs = await storage.getJobs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayJobs = jobs.filter(j => {
        const jobDate = new Date(j.scheduledDate || j.createdAt);
        jobDate.setHours(0, 0, 0, 0);
        return jobDate.getTime() === today.getTime();
      });
      
      const quoteApprovals = pendingActions.filter(a => 
        a.type?.toLowerCase().includes('quote') && a.status === 'pending'
      ).length;

      const unassignedJobs = todayJobs.filter(j => !j.assignedCrewId).length;
      const atRiskJobs = todayJobs.filter(j => j.status === 'at_risk').length;

      const crewsResult = await db.query.crews.findMany({
        where: eq(sql`${sql.identifier("businessId")}`, profile.id),
      }).catch(() => []);

      res.json({
        leadsToday: { 
          new: pendingActions.filter(a => a.type?.toLowerCase().includes('lead') && a.status === 'pending').length,
          pending: pendingActions.filter(a => a.status === 'pending').length,
          escalated: pendingActions.filter(a => a.priority === 'high' && a.status === 'pending').length
        },
        quotesOut: { 
          awaitingApproval: quoteApprovals, 
          sent: 0, 
          accepted: 0 
        },
        jobsToday: { 
          scheduled: todayJobs.length, 
          atRisk: atRiskJobs, 
          unassigned: unassignedJobs 
        },
        crewStatus: { 
          available: crewsResult.length, 
          onSite: 0, 
          delayed: 0 
        },
      });
    } catch (error: any) {
      console.error("[OpsKPIs] Error fetching KPIs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/work-queue", async (req, res) => {
    try {
      const { status = "all", priority = "all", type = "all", limit = 50 } = req.query;
      
      const pendingActions = await storage.getPendingActions();
      
      const mapType = (t?: string): "LEAD" | "QUOTE" | "SCHEDULE" | "CREW" | "COMMS" => {
        if (!t) return "LEAD";
        const lower = t.toLowerCase();
        if (lower.includes("quote")) return "QUOTE";
        if (lower.includes("schedule")) return "SCHEDULE";
        if (lower.includes("crew")) return "CREW";
        if (lower.includes("comms") || lower.includes("message")) return "COMMS";
        return "LEAD";
      };
      
      const mapPriority = (p?: string): "LOW" | "MED" | "HIGH" => {
        if (!p) return "MED";
        const lower = p.toLowerCase();
        if (lower === "high") return "HIGH";
        if (lower === "low") return "LOW";
        return "MED";
      };
      
      let items = pendingActions.map(action => ({
        id: `action-${action.id}`,
        type: mapType(action.type),
        title: action.title || `Action #${action.id}`,
        status: action.status || "pending",
        priority: mapPriority(action.priority),
        confidence: action.metadata?.confidence || 80,
        recommendedAction: action.metadata?.recommendedAction || "Review and approve",
        dueAt: action.slaDeadline || undefined,
        deepLink: `/approvals?id=${action.id}`,
        contextJson: action.metadata || {},
        createdAt: action.createdAt || new Date().toISOString(),
      }));

      if (status !== "all") {
        items = items.filter(i => i.status === status);
      }
      if (priority !== "all") {
        items = items.filter(i => i.priority === priority.toString().toUpperCase());
      }
      if (type !== "all") {
        items = items.filter(i => i.type === type.toString().toUpperCase());
      }

      items = items.slice(0, Number(limit));

      res.json({
        items,
        total: items.length,
        byPriority: {
          HIGH: items.filter(i => i.priority === "HIGH").length,
          MED: items.filter(i => i.priority === "MED").length,
          LOW: items.filter(i => i.priority === "LOW").length,
        },
      });
    } catch (error: any) {
      console.error("[WorkQueue] Error fetching queue:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/approvals", async (req, res) => {
    try {
      const { status = "pending" } = req.query;
      
      const pendingActions = await storage.getPendingActions();
      
      const mapApprovalType = (t?: string): "QUOTE" | "SCHEDULE" | "CREW" | "ESCALATION" => {
        if (!t) return "QUOTE";
        const lower = t.toLowerCase();
        if (lower.includes("quote")) return "QUOTE";
        if (lower.includes("schedule")) return "SCHEDULE";
        if (lower.includes("crew")) return "CREW";
        if (lower.includes("escalat")) return "ESCALATION";
        return "QUOTE";
      };
      
      let approvals = pendingActions;

      if (status !== "all") {
        approvals = approvals.filter(a => a.status === status);
      }

      const items = approvals.map(a => ({
        id: String(a.id),
        type: mapApprovalType(a.type),
        title: a.title || `Approval #${a.id}`,
        description: a.description || "",
        changes: a.metadata?.changes || [],
        reason: a.metadata?.reason || "Agent recommendation",
        requestedBy: a.metadata?.requestedBy || "AI Agent",
        requestedAt: a.createdAt || new Date().toISOString(),
        dueAt: a.slaDeadline || undefined,
        contextJson: a.metadata || {},
      }));

      res.json({
        items,
        total: items.length,
        pending: pendingActions.filter(a => a.status === "pending").length,
        approved: pendingActions.filter(a => a.status === "approved").length,
        rejected: pendingActions.filter(a => a.status === "rejected").length,
      });
    } catch (error: any) {
      console.error("[Approvals] Error fetching approvals:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Billing API Routes (Phase A2 - Real Data)
  // =====================================================

  // GET /api/billing/overview - Billing dashboard overview
  app.get("/api/billing/overview", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const overview = await storage.getBillingOverview(businessId);
      res.json(overview);
    } catch (error: any) {
      console.error("[Billing] Error fetching overview:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/invoices - List invoices (skip duplicates from old billing routes)
  app.get("/api/billing/invoices-list", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { status, limit = 50 } = req.query;
      const invoicesList = await storage.getInvoices(businessId, {
        status: status as string | undefined,
        limit: Number(limit),
      });
      res.json(invoicesList);
    } catch (error: any) {
      console.error("[Billing] Error fetching invoices:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/invoices/:id - Get single invoice
  app.get("/api/billing/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(Number(id));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      // Get line items for the invoice
      const lineItems = await storage.getInvoiceLineItems(Number(id));
      res.json({ ...invoice, lineItems });
    } catch (error: any) {
      console.error("[Billing] Error fetching invoice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/billing/invoices/:id/approve - Approve a draft invoice
  app.patch("/api/billing/invoices/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(Number(id));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (invoice.status !== "DRAFT" && invoice.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Invoice is not in draft or pending status" });
      }
      const updated = await storage.updateInvoice(Number(id), { status: "SENT" });
      res.json({ success: true, message: "Invoice approved", invoice: updated });
    } catch (error: any) {
      console.error("[Billing] Error approving invoice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/billing/invoices/:id/send - Send invoice to customer
  app.patch("/api/billing/invoices/:id/send", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(Number(id));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const updated = await storage.updateInvoice(Number(id), { 
        status: "SENT",
        sentAt: new Date(),
      });
      res.json({ success: true, message: "Invoice sent", invoice: updated });
    } catch (error: any) {
      console.error("[Billing] Error sending invoice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/payments - List payments
  app.get("/api/billing/payments", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { status, limit = 50 } = req.query;
      const paymentsList = await storage.getPayments(businessId, {
        status: status as string | undefined,
        limit: Number(limit),
      });
      res.json(paymentsList);
    } catch (error: any) {
      console.error("[Billing] Error fetching payments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/payments - Record a payment
  app.post("/api/billing/payments", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { invoiceId, amount, method, occurredAt } = req.body;
      if (!invoiceId || !amount) {
        return res.status(400).json({ error: "invoiceId and amount are required" });
      }
      const payment = await storage.createPayment({
        accountId: businessId,
        invoiceId: Number(invoiceId),
        amount: Number(amount),
        method: method || "UNKNOWN",
        status: "COMPLETED",
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });
      res.status(201).json(payment);
    } catch (error: any) {
      console.error("[Billing] Error recording payment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/issues - List billing issues
  app.get("/api/billing/issues", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { status = "OPEN", limit = 50 } = req.query;
      const issuesList = await storage.getBillingIssues(businessId, {
        status: status as string | undefined,
        limit: Number(limit),
      });
      res.json(issuesList);
    } catch (error: any) {
      console.error("[Billing] Error fetching issues:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/issues/:id - Get single billing issue
  app.get("/api/billing/issues/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const issue = await storage.getBillingIssue(Number(id));
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      res.json(issue);
    } catch (error: any) {
      console.error("[Billing] Error fetching issue:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/billing/issues/:id/resolve - Resolve a billing issue
  app.patch("/api/billing/issues/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      const issue = await storage.getBillingIssue(Number(id));
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      const updated = await storage.updateBillingIssue(Number(id), {
        status: "RESOLVED",
        resolvedAt: new Date(),
      });
      res.json({ success: true, message: "Issue resolved", issue: updated });
    } catch (error: any) {
      console.error("[Billing] Error resolving issue:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Billing Agent Routes (Phase B1)
  // =====================================================

  // POST /api/billing/invoices/generate - Generate invoice from job
  app.post("/api/billing/invoices/generate", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { jobId, pricing } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      // Get job data
      const job = await storage.getJob(Number(jobId));
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Default pricing rules if not provided
      const pricingRules = pricing || {
        baseRates: {
          mowing: 5000, // $50
          trimming: 3000, // $30
          cleanup: 4000, // $40
          general: 5000, // $50
        },
        minimumCharge: 3500, // $35
        taxRate: 0.08, // 8%
      };

      // Import and run the invoice build agent
      const { runInvoiceBuildAgent } = await import("./agents/billing");
      
      const jobData = {
        id: job.id,
        title: job.title,
        description: job.description,
        customerId: job.customerId || 0,
        serviceType: job.serviceType || "general",
        scheduledDate: job.scheduledDate,
        completedDate: job.completedAt,
        estimatedDuration: job.estimatedDuration,
        notes: job.notes,
        status: job.status,
      };

      const result = await runInvoiceBuildAgent(
        jobData,
        businessId,
        pricingRules,
        "LawnFlow"
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error, confidence: result.confidence });
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error("[Billing] Error generating invoice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/reconcile - Run reconciliation worker
  app.post("/api/billing/reconcile", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session

      // Import and run the reconciliation worker
      const { runReconciliationWorker } = await import("./agents/billing");
      
      const results = await runReconciliationWorker(businessId);

      const summary = {
        totalChecked: results.length,
        issuesFound: results.filter(r => !r.isValid).length,
        highSeverity: results.flatMap(r => r.issues).filter(i => i.severity === "HIGH").length,
        medSeverity: results.flatMap(r => r.issues).filter(i => i.severity === "MED").length,
        lowSeverity: results.flatMap(r => r.issues).filter(i => i.severity === "LOW").length,
      };

      res.json({ summary, results });
    } catch (error: any) {
      console.error("[Billing] Error running reconciliation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/actions/reminder - Send billing reminder (uses BillingAgent)
  app.post("/api/billing/actions/reminder", async (req, res) => {
    try {
      const { invoiceId, tone = "professional" } = req.body;
      
      if (!invoiceId) {
        return res.status(400).json({ error: "invoiceId is required" });
      }

      const invoice = await storage.getInvoice(Number(invoiceId));
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Import and run the billing agent
      const { runBillingAgent } = await import("./agents/billing");
      
      // Calculate days overdue
      const daysOverdue = invoice.dueDate 
        ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const invoiceData = {
        id: invoice.id,
        customer_name: "Customer", // TODO: Get from customer table
        customer_phone: "", // TODO: Get from customer table
        customer_email: undefined,
        amount: invoice.total / 100, // Convert cents to dollars for display
        due_date: invoice.dueDate?.toISOString().split('T')[0] || "",
        status: invoice.status === "OVERDUE" ? "overdue" : invoice.status === "PAID" ? "paid" : "pending",
        days_overdue: daysOverdue,
      } as const;

      const customerHistory = {
        previous_delinquencies: 0,
        total_lifetime_value: 0,
      };

      const config = {
        business_name: "LawnFlow",
        payment_link_base_url: undefined,
        include_late_fee_language: false,
        escalation_cadence_days: [3, 7, 14],
        tone: tone as "friendly" | "professional" | "firm",
      };

      const policy = {
        tier: "smb" as const,
        auto_send_reminders: true,
        max_auto_followups: 3,
      };

      const action = await runBillingAgent(invoiceData, customerHistory, config, policy);

      res.json(action);
    } catch (error: any) {
      console.error("[Billing] Error generating reminder:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // QuickBooks Sync Routes (Phase B2)
  // =====================================================

  // POST /api/billing/sync/invoice/:id - Sync single invoice to QuickBooks
  app.post("/api/billing/sync/invoice/:id", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const invoiceId = Number(req.params.id);

      const { runInvoiceSyncAgent } = await import("./agents/billing");
      const result = await runInvoiceSyncAgent(businessId, invoiceId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error("[QuickBooks] Error syncing invoice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/sync/invoices - Batch sync all pending invoices
  app.post("/api/billing/sync/invoices", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session

      const { runBatchInvoiceSync } = await import("./agents/billing");
      const result = await runBatchInvoiceSync(businessId);

      res.json(result);
    } catch (error: any) {
      console.error("[QuickBooks] Error batch syncing invoices:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/sync/payments - Sync payments from QuickBooks
  app.post("/api/billing/sync/payments", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { since } = req.body;

      const { runPaymentSyncAgent } = await import("./agents/billing");
      const sinceDate = since ? new Date(since) : undefined;
      const results = await runPaymentSyncAgent(businessId, sinceDate);

      const summary = {
        total: results.length,
        created: results.filter(r => r.action === "created").length,
        skipped: results.filter(r => r.action === "skipped").length,
        errors: results.filter(r => r.action === "error").length,
      };

      res.json({ summary, results });
    } catch (error: any) {
      console.error("[QuickBooks] Error syncing payments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/billing/integrations - Get integration status
  app.get("/api/billing/integrations", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session

      const integrations = await storage.getAccountIntegrations(businessId);
      
      // Don't expose tokens, just status
      const safeIntegrations = integrations.map(i => ({
        id: i.id,
        provider: i.provider,
        status: i.status,
        lastSyncAt: i.lastSyncAt,
        realmId: i.realmId,
      }));

      res.json(safeIntegrations);
    } catch (error: any) {
      console.error("[Billing] Error getting integrations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Remediation Agent Routes (Phase A6)
  // =====================================================

  // POST /api/billing/remediate - Analyze billing issue and recommend resolution
  app.post("/api/billing/remediate", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { billingIssueId, customerMessages, crewNotes } = req.body;

      if (!billingIssueId) {
        return res.status(400).json({ error: "billingIssueId is required" });
      }

      const { runRemediationAgent } = await import("./agents/billing");
      const result = await runRemediationAgent({
        accountId: businessId,
        billingIssueId,
        customerMessages,
        crewNotes,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Remediation] Error analyzing issue:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Accretive Agents Routes (Phase B)
  // =====================================================

  // POST /api/agents/pricing-optimization - Analyze pricing and get recommendations
  app.post("/api/agents/pricing-optimization", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { startDate, endDate, serviceTypes } = req.body;

      const { runPricingOptimizationAgent } = await import("./agents/billing");
      const result = await runPricingOptimizationAgent({
        accountId: businessId,
        period: startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined,
        serviceTypes,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[PricingOptimization] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/capacity-forecast - Get capacity forecast
  app.post("/api/agents/capacity-forecast", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { forecastDays, zones } = req.body;

      const { runCapacityForecastingAgent } = await import("./agents/billing");
      const result = await runCapacityForecastingAgent({
        accountId: businessId,
        forecastDays,
        zones,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[CapacityForecast] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/crew-performance - Analyze crew performance
  app.post("/api/agents/crew-performance", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { crewId, startDate, endDate } = req.body;

      const { runCrewPerformanceAgent } = await import("./agents/billing");
      const result = await runCrewPerformanceAgent({
        accountId: businessId,
        crewId,
        period: startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[CrewPerformance] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/retention - Analyze customer retention
  app.post("/api/agents/retention", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { customerId } = req.body;

      const { runRetentionAgent } = await import("./agents/billing");
      const result = await runRetentionAgent({
        accountId: businessId,
        customerId,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Retention] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/compliance-risk - Check compliance status
  app.post("/api/agents/compliance-risk", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session

      const { runComplianceRiskAgent } = await import("./agents/billing");
      const result = await runComplianceRiskAgent({
        accountId: businessId,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[ComplianceRisk] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // SERVICE CATALOG API ROUTES
  // =====================================================

  // GET /api/services - List all services for the business
  app.get("/api/services", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { category, isActive } = req.query;
      const serviceList = await storage.getServices(businessId, {
        category: category as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      res.json(serviceList);
    } catch (error: any) {
      console.error("[Services] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/services/:id - Get a single service with pricing and frequency options
  app.get("/api/services/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const service = await storage.getService(id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const [pricing, frequencyOptions, snowPolicy] = await Promise.all([
        storage.getServicePricing(id),
        storage.getServiceFrequencyOptions(id),
        service.category === 'SNOW' ? storage.getSnowServicePolicy(id) : Promise.resolve(null),
      ]);
      
      res.json({ ...service, pricing, frequencyOptions, snowPolicy });
    } catch (error: any) {
      console.error("[Services] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/services - Create a new service
  app.post("/api/services", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const service = await storage.createService({ ...req.body, accountId: businessId });
      res.status(201).json(service);
    } catch (error: any) {
      console.error("[Services] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/services/:id - Update a service
  app.patch("/api/services/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const service = await storage.updateService(id, req.body);
      res.json(service);
    } catch (error: any) {
      console.error("[Services] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/services/:id - Delete a service
  app.delete("/api/services/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteService(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[Services] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/services/:id/pricing - Add pricing to a service
  app.post("/api/services/:id/pricing", async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const pricing = await storage.createServicePricing({ ...req.body, serviceId });
      res.status(201).json(pricing);
    } catch (error: any) {
      console.error("[ServicePricing] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/service-pricing/:id - Update pricing
  app.patch("/api/service-pricing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pricing = await storage.updateServicePricing(id, req.body);
      res.json(pricing);
    } catch (error: any) {
      console.error("[ServicePricing] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/service-pricing/:id - Delete pricing
  app.delete("/api/service-pricing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteServicePricing(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[ServicePricing] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/services/:id/frequency-options - Add frequency option
  app.post("/api/services/:id/frequency-options", async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const option = await storage.createServiceFrequencyOption({ ...req.body, serviceId });
      res.status(201).json(option);
    } catch (error: any) {
      console.error("[FrequencyOption] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/frequency-options/:id - Update frequency option
  app.patch("/api/frequency-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const option = await storage.updateServiceFrequencyOption(id, req.body);
      res.json(option);
    } catch (error: any) {
      console.error("[FrequencyOption] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/frequency-options/:id - Delete frequency option
  app.delete("/api/frequency-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteServiceFrequencyOption(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[FrequencyOption] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/promotions - List all promotion rules
  app.get("/api/promotions", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const { isActive } = req.query;
      const promotions = await storage.getPromotionRules(businessId, {
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      res.json(promotions);
    } catch (error: any) {
      console.error("[Promotions] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/promotions/:id - Get a single promotion
  app.get("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const promotion = await storage.getPromotionRule(id);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error: any) {
      console.error("[Promotions] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/promotions - Create a promotion rule
  app.post("/api/promotions", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const promotion = await storage.createPromotionRule({ ...req.body, accountId: businessId });
      res.status(201).json(promotion);
    } catch (error: any) {
      console.error("[Promotions] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/promotions/:id - Update a promotion rule
  app.patch("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const promotion = await storage.updatePromotionRule(id, req.body);
      res.json(promotion);
    } catch (error: any) {
      console.error("[Promotions] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/promotions/:id - Delete a promotion rule
  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePromotionRule(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[Promotions] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/services/:id/snow-policy - Create or update snow policy
  app.post("/api/services/:id/snow-policy", async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const existing = await storage.getSnowServicePolicy(serviceId);
      if (existing) {
        const policy = await storage.updateSnowServicePolicy(existing.id, req.body);
        return res.json(policy);
      }
      const policy = await storage.createSnowServicePolicy({ ...req.body, serviceId });
      res.status(201).json(policy);
    } catch (error: any) {
      console.error("[SnowPolicy] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/snow-policies/:id - Delete snow policy
  app.delete("/api/snow-policies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSnowServicePolicy(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[SnowPolicy] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/mulch-profiles - List mulch profiles
  app.get("/api/mulch-profiles", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const profiles = await storage.getMulchProfiles(businessId, customerId);
      res.json(profiles);
    } catch (error: any) {
      console.error("[MulchProfiles] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/mulch-profiles - Create mulch profile
  app.post("/api/mulch-profiles", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const profile = await storage.createMulchProfile({ ...req.body, accountId: businessId });
      res.status(201).json(profile);
    } catch (error: any) {
      console.error("[MulchProfiles] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/mulch-profiles/:id - Update mulch profile
  app.patch("/api/mulch-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.updateMulchProfile(id, req.body);
      res.json(profile);
    } catch (error: any) {
      console.error("[MulchProfiles] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/firewood-profiles - List firewood profiles
  app.get("/api/firewood-profiles", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const profiles = await storage.getFirewoodProfiles(businessId, customerId);
      res.json(profiles);
    } catch (error: any) {
      console.error("[FirewoodProfiles] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/firewood-profiles - Create firewood profile
  app.post("/api/firewood-profiles", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from session
      const profile = await storage.createFirewoodProfile({ ...req.body, accountId: businessId });
      res.status(201).json(profile);
    } catch (error: any) {
      console.error("[FirewoodProfiles] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/firewood-profiles/:id - Update firewood profile
  app.patch("/api/firewood-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.updateFirewoodProfile(id, req.body);
      res.json(profile);
    } catch (error: any) {
      console.error("[FirewoodProfiles] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Service Catalog Agents
  // ============================================================

  // POST /api/agents/service-selection - Match customer intent to services
  app.post("/api/agents/service-selection", async (req, res) => {
    try {
      const { runServiceSelectionAgent } = await import("./agents/service-selection");
      const accountId = 1; // TODO: Get from session
      const result = await runServiceSelectionAgent({
        accountId,
        customerId: req.body.customerId,
        customerIntent: req.body.customerIntent,
        propertyContext: req.body.propertyContext,
        requestedDate: req.body.requestedDate,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[ServiceSelectionAgent] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/pricing - Calculate pricing for services
  app.post("/api/agents/pricing", async (req, res) => {
    try {
      const { runPricingAgent } = await import("./agents/pricing");
      const accountId = 1; // TODO: Get from session
      const result = await runPricingAgent({
        accountId,
        serviceRequests: req.body.serviceRequests,
        propertyContext: req.body.propertyContext,
        customerId: req.body.customerId,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[PricingAgent] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/promotion - Apply promotions and calculate discounts
  app.post("/api/agents/promotion", async (req, res) => {
    try {
      const { runPromotionAgent } = await import("./agents/promotion");
      const accountId = 1; // TODO: Get from session
      const result = await runPromotionAgent({
        accountId,
        customerId: req.body.customerId,
        isFirstTimeCustomer: req.body.isFirstTimeCustomer ?? true,
        serviceQuotes: req.body.serviceQuotes,
        totalBeforeDiscount: req.body.totalBeforeDiscount,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[PromotionAgent] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Customer Service Preferences
  // ============================================================

  const preferenceBodySchema = z.object({
    serviceId: z.number().nullable().optional(),
    preferredFrequency: z.string().nullable().optional(),
    preferredDayOfWeek: z.string().nullable().optional(),
    preferredTimeWindow: z.string().nullable().optional(),
    preferredCrewId: z.number().nullable().optional(),
    priceFlexibility: z.enum(["BUDGET", "STANDARD", "PREMIUM"]).optional(),
    communicationPreference: z.enum(["SMS", "EMAIL", "PHONE"]).optional(),
    seasonalPreference: z.string().nullable().optional(),
    specialInstructions: z.string().nullable().optional(),
    doNotContact: z.boolean().optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
  });

  // GET /api/customers/:customerId/preferences - Get all preferences for a customer
  app.get("/api/customers/:customerId/preferences", async (req, res) => {
    try {
      const accountId = 1; // TODO: Get from session
      const customerId = parseInt(req.params.customerId);
      const serviceId = req.query.serviceId ? parseInt(req.query.serviceId as string) : undefined;
      const preferences = await storage.getCustomerServicePreferences(accountId, customerId, serviceId);
      res.json(preferences);
    } catch (error: any) {
      console.error("[CustomerPreferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/customers/:customerId/preferences - Create or update preferences
  app.post("/api/customers/:customerId/preferences", async (req, res) => {
    try {
      const accountId = 1; // TODO: Get from session
      const customerId = parseInt(req.params.customerId);
      
      const validated = preferenceBodySchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid request body", details: validated.error.flatten() });
      }
      
      const preference = await storage.upsertCustomerServicePreference({
        ...validated.data,
        accountId,
        customerId,
      });
      res.status(201).json(preference);
    } catch (error: any) {
      console.error("[CustomerPreferences] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/customers/:customerId/preferences/:id - Update preference
  app.patch("/api/customers/:customerId/preferences/:id", async (req, res) => {
    try {
      const accountId = 1; // TODO: Get from session
      const customerId = parseInt(req.params.customerId);
      const id = parseInt(req.params.id);
      
      const validated = preferenceBodySchema.partial().safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid request body", details: validated.error.flatten() });
      }
      
      const existing = await storage.getCustomerServicePreference(id);
      if (!existing || existing.accountId !== accountId || existing.customerId !== customerId) {
        return res.status(404).json({ error: "Preference not found" });
      }
      
      const preference = await storage.updateCustomerServicePreference(id, validated.data);
      if (!preference) {
        return res.status(404).json({ error: "Preference not found" });
      }
      res.json(preference);
    } catch (error: any) {
      console.error("[CustomerPreferences] Error updating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/customers/:customerId/preferences/:id - Delete preference
  app.delete("/api/customers/:customerId/preferences/:id", async (req, res) => {
    try {
      const accountId = 1; // TODO: Get from session
      const customerId = parseInt(req.params.customerId);
      const id = parseInt(req.params.id);
      
      const existing = await storage.getCustomerServicePreference(id);
      if (!existing || existing.accountId !== accountId || existing.customerId !== customerId) {
        return res.status(404).json({ error: "Preference not found" });
      }
      
      await storage.deleteCustomerServicePreference(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[CustomerPreferences] Error deleting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Preference Agent
  // ============================================================

  const learnRequestSchema = z.object({
    customerId: z.number(),
    interactionHistory: z.array(z.object({
      type: z.string(),
      serviceId: z.number().optional(),
      details: z.record(z.any()),
      timestamp: z.string(),
    })),
  });

  const applyRequestSchema = z.object({
    customerId: z.number(),
    serviceIds: z.array(z.number()).min(1, "At least one serviceId is required"),
    context: z.string().optional(),
  });

  // POST /api/agents/preference/learn - Learn preferences from interaction history
  app.post("/api/agents/preference/learn", async (req, res) => {
    try {
      const validated = learnRequestSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid request body", details: validated.error.flatten() });
      }
      
      const { learnCustomerPreferences } = await import("./agents/preference");
      const accountId = 1; // TODO: Get from session
      const result = await learnCustomerPreferences({
        accountId,
        customerId: validated.data.customerId,
        interactionHistory: validated.data.interactionHistory,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[PreferenceAgent:Learn] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agents/preference/apply - Apply preferences to a request
  app.post("/api/agents/preference/apply", async (req, res) => {
    try {
      const validated = applyRequestSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid request body", details: validated.error.flatten() });
      }
      
      const { applyCustomerPreferences } = await import("./agents/preference");
      const accountId = 1; // TODO: Get from session
      const result = await applyCustomerPreferences({
        accountId,
        customerId: validated.data.customerId,
        serviceIds: validated.data.serviceIds,
        context: validated.data.context,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[PreferenceAgent:Apply] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/agents/preference/summary/:customerId - Get preference summary
  app.get("/api/agents/preference/summary/:customerId", async (req, res) => {
    try {
      const { getCustomerPreferenceSummary } = await import("./agents/preference");
      const accountId = 1; // TODO: Get from session
      const customerId = parseInt(req.params.customerId);
      const summary = await getCustomerPreferenceSummary(accountId, customerId);
      res.json(summary);
    } catch (error: any) {
      console.error("[PreferenceAgent:Summary] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Active Comms (Ops Triage View)
  // ============================================================

  // GET /api/ops/comms/threads - List threads with filtering
  app.get("/api/ops/comms/threads", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const accountId = 1; // TODO: Get from session when accountId is available
      
      const filters: {
        audienceType?: string;
        status?: string;
        excludeResolved?: boolean;
        limit?: number;
        sortBy?: 'urgency' | 'lastMessage' | 'slaDeadline';
      } = {};
      
      if (req.query.audienceType && typeof req.query.audienceType === "string") {
        filters.audienceType = req.query.audienceType;
      }
      if (req.query.status && typeof req.query.status === "string") {
        const statusValue = req.query.status;
        if (statusValue === "ACTIVE") {
          filters.excludeResolved = true;
        } else if (statusValue === "WAITING") {
          filters.status = "WAITING_ON_CUSTOMER";
        } else if (statusValue !== "all") {
          filters.status = statusValue;
        }
      }
      
      const sortByQuery = req.query.sortBy as string;
      if (sortByQuery === "urgency" || sortByQuery === "lastMessage" || sortByQuery === "slaDeadline") {
        filters.sortBy = sortByQuery;
      } else {
        filters.sortBy = "urgency";
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }
      
      const threads = await storage.getOpsCommsThreads(accountId, filters);
      res.json(threads);
    } catch (error: any) {
      console.error("[ActiveComms] Error fetching threads:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ops/comms/threads/:id - Get single thread with action items
  app.get("/api/ops/comms/threads/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const accountId = 1; // TODO: Get from session when accountId is available
      const threadId = parseInt(req.params.id);
      
      const thread = await storage.getOpsCommsThread(threadId);
      if (!thread || thread.accountId !== accountId) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const actionItems = await storage.getOpsCommsActionItems(accountId, { threadId, state: "OPEN" });
      
      res.json({ thread, actionItems });
    } catch (error: any) {
      console.error("[ActiveComms] Error fetching thread:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ops/comms/action-items - List action items with filtering
  app.get("/api/ops/comms/action-items", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const accountId = 1; // TODO: Get from session when accountId is available
      
      const filters: {
        threadId?: number;
        state?: string;
        type?: string;
        assignedToUserId?: number;
      } = {};
      
      if (req.query.threadId) {
        filters.threadId = parseInt(req.query.threadId as string);
      }
      if (req.query.state && typeof req.query.state === "string") {
        filters.state = req.query.state;
      }
      if (req.query.type && typeof req.query.type === "string") {
        filters.type = req.query.type;
      }
      if (req.query.assignedToUserId) {
        filters.assignedToUserId = parseInt(req.query.assignedToUserId as string);
      }
      
      const items = await storage.getOpsCommsActionItems(accountId, filters);
      res.json(items);
    } catch (error: any) {
      console.error("[ActiveComms] Error fetching action items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/ops/comms/action-items/:id - Update action item (complete, dismiss, assign)
  app.patch("/api/ops/comms/action-items/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const accountId = 1; // TODO: Get from session when accountId is available
      const itemId = parseInt(req.params.id);
      
      const item = await storage.getOpsCommsActionItem(itemId);
      if (!item || item.accountId !== accountId) {
        return res.status(404).json({ error: "Action item not found" });
      }
      
      const updateSchema = z.object({
        state: z.enum(["OPEN", "DONE", "DISMISSED"]).optional(),
        assignedToUserId: z.number().nullable().optional(),
      });
      
      const validated = updateSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid request body", details: validated.error.flatten() });
      }
      
      const updates: any = {};
      if (validated.data.state !== undefined) {
        updates.state = validated.data.state;
        if (validated.data.state === "DONE") {
          updates.completedAt = new Date();
          updates.completedByUserId = req.user.id;
        }
      }
      if (validated.data.assignedToUserId !== undefined) {
        updates.assignedToUserId = validated.data.assignedToUserId;
      }
      
      const updated = await storage.updateOpsCommsActionItem(itemId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("[ActiveComms] Error updating action item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/ops/comms/threads/:id/recompute-urgency - Recompute thread urgency
  app.post("/api/ops/comms/threads/:id/recompute-urgency", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const accountId = 1; // TODO: Get from session when accountId is available
      const threadId = parseInt(req.params.id);
      
      const thread = await storage.getOpsCommsThread(threadId);
      if (!thread || thread.accountId !== accountId) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const { recomputeThreadUrgency } = await import("./lib/comms/urgency-compute");
      const urgencyUpdate = recomputeThreadUrgency(thread);
      
      const updated = await storage.updateOpsCommsThreadUrgency(threadId, urgencyUpdate);
      res.json(updated);
    } catch (error: any) {
      console.error("[ActiveComms] Error recomputing urgency:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
