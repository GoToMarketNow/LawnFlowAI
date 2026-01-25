// ============================================
// Weather API Routes
// REST endpoints for weather forecasts, risk, and campaigns
// ============================================

import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from './db';
import {
  weatherForecasts,
  weatherRiskAssessments,
  weatherSchedulePlans,
  winterEvents,
  winterCampaigns,
  weatherApprovalPackets,
  weatherMonitoringRuns
} from '../shared/schema-weather';
import { jobs, serviceAreas } from '../shared/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { getWeatherProviderService } from './services/weather/providerService';
import { RiskScorer } from './services/weather/riskScorer';
import { encodeGeohash } from './services/weather/geohash';

// Temporal client for workflow signals
import { Connection, Client } from '@temporalio/client';

// Request validation schemas
const ForecastQuerySchema = z.object({
  serviceAreaId: z.string().transform(Number),
  horizonDays: z.string().optional().transform(v => v ? Number(v) : 7)
});

const RiskQuerySchema = z.object({
  operatorId: z.string().optional().transform(v => v ? Number(v) : undefined),
  serviceAreaId: z.string().optional().transform(v => v ? Number(v) : undefined),
  riskTier: z.enum(['LOW', 'MED', 'HIGH', 'STOP']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});

const PlanGenerateSchema = z.object({
  serviceAreaId: z.number(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  jobIds: z.array(z.number()).optional(),
  forceGenerate: z.boolean().optional()
});

const CampaignApprovalSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'PARTIAL']),
  selectedChanges: z.array(z.number()).optional(),
  rejectionReason: z.string().optional(),
  modifiedThrottle: z.object({
    maxAcceptsTotal: z.number().optional(),
    batchSize: z.number().optional()
  }).optional()
});

/**
 * Register weather routes on Express app
 */
export function registerWeatherRoutes(app: Express): void {
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    // In production, would validate JWT/session and extract operatorId
    const operatorId = req.headers['x-operator-id'] as string;
    if (!operatorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).operatorId = Number(operatorId);
    next();
  };

  // ============================================
  // Forecast Endpoints
  // ============================================

  /**
   * GET /api/weather/forecast/:serviceAreaId
   * Get forecast for a service area
   */
  app.get('/api/weather/forecast/:serviceAreaId', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const { serviceAreaId, horizonDays } = ForecastQuerySchema.parse({
        serviceAreaId: req.params.serviceAreaId,
        horizonDays: req.query.horizonDays
      });

      // Get service area center
      const [serviceArea] = await db
        .select()
        .from(serviceAreas)
        .where(
          and(
            eq(serviceAreas.id, serviceAreaId),
            eq(serviceAreas.operatorId, operatorId)
          )
        )
        .limit(1);

      if (!serviceArea) {
        return res.status(404).json({ error: 'Service area not found' });
      }

      if (!serviceArea.centerLat || !serviceArea.centerLon) {
        return res.status(400).json({ error: 'Service area has no center coordinates' });
      }

      // Fetch forecast
      const weatherService = getWeatherProviderService();
      const forecast = await weatherService.fetchForecast({
        lat: serviceArea.centerLat,
        lon: serviceArea.centerLon,
        operatorId,
        serviceAreaId
      });

      if (!forecast) {
        return res.status(503).json({ error: 'Unable to fetch weather data' });
      }

      // Get alerts
      const alerts = await weatherService.fetchAlerts(
        serviceArea.centerLat,
        serviceArea.centerLon
      );

      res.json({
        serviceAreaId,
        forecast: {
          ...forecast,
          alerts
        },
        budgetStatus: weatherService.getBudgetStatus(),
        cacheStats: weatherService.getCacheStats()
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Forecast error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Risk Endpoints
  // ============================================

  /**
   * GET /api/weather/risk/jobs
   * Get risk assessments for scheduled jobs
   */
  app.get('/api/weather/risk/jobs', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const query = RiskQuerySchema.parse(req.query);

      const conditions = [eq(weatherRiskAssessments.operatorId, operatorId)];

      if (query.serviceAreaId) {
        conditions.push(eq(weatherRiskAssessments.serviceAreaId, query.serviceAreaId));
      }
      if (query.riskTier) {
        conditions.push(eq(weatherRiskAssessments.riskTier, query.riskTier));
      }
      if (query.fromDate) {
        conditions.push(gte(weatherRiskAssessments.jobStart, new Date(query.fromDate)));
      }
      if (query.toDate) {
        conditions.push(lte(weatherRiskAssessments.jobStart, new Date(query.toDate)));
      }

      const assessments = await db
        .select()
        .from(weatherRiskAssessments)
        .where(and(...conditions))
        .orderBy(desc(weatherRiskAssessments.riskScore))
        .limit(100);

      // Get job details
      const jobIds = assessments.map(a => a.jobId).filter(Boolean) as number[];
      const jobsData = jobIds.length > 0
        ? await db.select().from(jobs).where(inArray(jobs.id, jobIds))
        : [];

      const jobMap = new Map(jobsData.map(j => [j.id, j]));

      res.json({
        assessments: assessments.map(a => ({
          ...a,
          job: a.jobId ? jobMap.get(a.jobId) : null
        })),
        summary: {
          total: assessments.length,
          byTier: {
            STOP: assessments.filter(a => a.riskTier === 'STOP').length,
            HIGH: assessments.filter(a => a.riskTier === 'HIGH').length,
            MED: assessments.filter(a => a.riskTier === 'MED').length,
            LOW: assessments.filter(a => a.riskTier === 'LOW').length
          }
        }
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Risk error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/weather/risk/score
   * Score risk for specific jobs on demand
   */
  app.post('/api/weather/risk/score', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const { jobIds } = z.object({ jobIds: z.array(z.number()) }).parse(req.body);

      // Get jobs
      const jobsData = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.operatorId, operatorId),
            inArray(jobs.id, jobIds)
          )
        );

      if (jobsData.length === 0) {
        return res.status(404).json({ error: 'No jobs found' });
      }

      // Fetch forecasts for job locations
      const weatherService = getWeatherProviderService();
      const locations = jobsData
        .filter(j => j.lat && j.lon)
        .map(j => ({
          lat: j.lat!,
          lon: j.lon!,
          jobId: j.id,
          operatorId
        }));

      const forecastMap = await weatherService.fetchBatch(locations);

      // Score jobs
      const scorer = new RiskScorer();
      const jobInfos = jobsData
        .filter(j => j.lat && j.lon && j.scheduledDate && j.scheduledEndTime)
        .map(j => ({
          id: j.id,
          scheduledStart: j.scheduledDate!,
          scheduledEnd: j.scheduledEndTime!,
          lat: j.lat!,
          lon: j.lon!,
          serviceType: j.serviceType || undefined,
          operatorId
        }));

      const assessments = scorer.scoreJobs(jobInfos, forecastMap);

      // Store assessments
      for (const assessment of assessments) {
        await db.insert(weatherRiskAssessments).values({
          jobId: assessment.jobId,
          operatorId,
          riskScore: assessment.riskScore,
          riskTier: assessment.riskTier,
          drivers: assessment.drivers,
          confidence: assessment.confidence,
          forecastVersion: assessment.forecastVersion,
          jobStart: new Date(assessment.start),
          jobEnd: new Date(assessment.end),
          assessedAt: new Date()
        });
      }

      res.json({ assessments });
    } catch (error: any) {
      console.error('[WeatherAPI] Score error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Alerts Endpoints
  // ============================================

  /**
   * GET /api/weather/alerts
   * Get active weather alerts
   */
  app.get('/api/weather/alerts', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const serviceAreaId = req.query.serviceAreaId 
        ? Number(req.query.serviceAreaId)
        : undefined;

      // Get service areas
      const areasQuery = serviceAreaId
        ? db.select().from(serviceAreas).where(
            and(
              eq(serviceAreas.id, serviceAreaId),
              eq(serviceAreas.operatorId, operatorId)
            )
          )
        : db.select().from(serviceAreas).where(eq(serviceAreas.operatorId, operatorId));

      const areas = await areasQuery;

      // Fetch alerts for each area
      const weatherService = getWeatherProviderService();
      const allAlerts: any[] = [];

      for (const area of areas) {
        if (area.centerLat && area.centerLon) {
          const alerts = await weatherService.fetchAlerts(area.centerLat, area.centerLon);
          allAlerts.push(...alerts.map(a => ({
            ...a,
            serviceAreaId: area.id,
            serviceAreaName: area.name
          })));
        }
      }

      // Deduplicate alerts
      const uniqueAlerts = allAlerts.filter((alert, index, self) =>
        index === self.findIndex(a => a.event === alert.event && a.start === alert.start)
      );

      res.json({
        alerts: uniqueAlerts,
        count: uniqueAlerts.length
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Alerts error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Schedule Plan Endpoints
  // ============================================

  /**
   * POST /api/weather/plan/generate
   * Trigger schedule impact planning
   */
  app.post('/api/weather/plan/generate', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const input = PlanGenerateSchema.parse(req.body);

      // Get high-risk jobs in time range
      const riskJobs = await db
        .select()
        .from(weatherRiskAssessments)
        .where(
          and(
            eq(weatherRiskAssessments.operatorId, operatorId),
            eq(weatherRiskAssessments.serviceAreaId, input.serviceAreaId),
            inArray(weatherRiskAssessments.riskTier, ['HIGH', 'STOP']),
            gte(weatherRiskAssessments.jobStart, new Date(input.timeRange.start)),
            lte(weatherRiskAssessments.jobStart, new Date(input.timeRange.end))
          )
        );

      const jobIds = input.jobIds || riskJobs.map(r => r.jobId).filter(Boolean) as number[];

      if (jobIds.length === 0) {
        return res.json({
          status: 'NO_ACTION_NEEDED',
          message: 'No high-risk jobs found in time range'
        });
      }

      // Start the planning workflow via Temporal
      const connection = await Connection.connect();
      const client = new Client({ connection });

      const workflowId = `ScheduleImpactPlanningWorkflow:${operatorId}:${input.serviceAreaId}:${Date.now()}`;

      const handle = await client.workflow.start('ScheduleImpactPlanningWorkflow', {
        taskQueue: 'lawnflow-weather',
        workflowId,
        args: [{
          operatorId,
          serviceAreaId: input.serviceAreaId,
          timeRange: input.timeRange,
          impactedJobIds: jobIds,
          riskSummary: {
            highRiskCount: riskJobs.length,
            weatherDescription: 'Adverse weather conditions detected',
            primaryDrivers: [...new Set(riskJobs.flatMap(r => (r.drivers as any[]).map(d => d.type)))]
          },
          forecastVersion: `api:${Date.now()}`
        }]
      });

      res.json({
        status: 'STARTED',
        workflowId: handle.workflowId,
        impactedJobCount: jobIds.length
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Plan generate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/weather/plans
   * List schedule change plans
   */
  app.get('/api/weather/plans', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const status = req.query.status as string | undefined;

      const conditions = [eq(weatherSchedulePlans.operatorId, operatorId)];
      if (status) {
        conditions.push(eq(weatherSchedulePlans.status, status));
      }

      const plans = await db
        .select()
        .from(weatherSchedulePlans)
        .where(and(...conditions))
        .orderBy(desc(weatherSchedulePlans.createdAt))
        .limit(50);

      res.json({ plans });
    } catch (error: any) {
      console.error('[WeatherAPI] Plans list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/weather/plans/:planId/approve
   * Approve a schedule change plan
   */
  app.post('/api/weather/plans/:planId/approve', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const { planId } = req.params;
      const approval = CampaignApprovalSchema.parse(req.body);

      // Get the plan
      const [plan] = await db
        .select()
        .from(weatherSchedulePlans)
        .where(
          and(
            eq(weatherSchedulePlans.planId, planId),
            eq(weatherSchedulePlans.operatorId, operatorId)
          )
        )
        .limit(1);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      if (plan.status !== 'PENDING') {
        return res.status(400).json({ error: `Plan is ${plan.status}, cannot approve` });
      }

      // Get the approval packet to find workflow ID
      const [packet] = await db
        .select()
        .from(weatherApprovalPackets)
        .where(eq(weatherApprovalPackets.operatorId, operatorId))
        .orderBy(desc(weatherApprovalPackets.createdAt))
        .limit(1);

      if (packet?.workflowId) {
        // Signal the workflow
        const connection = await Connection.connect();
        const client = new Client({ connection });
        const handle = client.workflow.getHandle(packet.workflowId);

        await handle.signal('approval', {
          decision: approval.decision,
          approvedBy: operatorId,
          selectedChanges: approval.selectedChanges,
          rejectionReason: approval.rejectionReason
        });

        res.json({
          status: 'SIGNAL_SENT',
          workflowId: packet.workflowId
        });
      } else {
        // Direct approval without workflow
        await db
          .update(weatherSchedulePlans)
          .set({
            status: approval.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            approvedBy: operatorId,
            approvedAt: new Date()
          })
          .where(eq(weatherSchedulePlans.planId, planId));

        res.json({ status: approval.decision });
      }
    } catch (error: any) {
      console.error('[WeatherAPI] Plan approve error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Campaign Endpoints
  // ============================================

  /**
   * GET /api/weather/campaigns
   * List winter campaigns
   */
  app.get('/api/weather/campaigns', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const status = req.query.status as string | undefined;

      const conditions = [eq(winterCampaigns.operatorId, operatorId)];
      if (status) {
        conditions.push(eq(winterCampaigns.status, status));
      }

      const campaigns = await db
        .select()
        .from(winterCampaigns)
        .where(and(...conditions))
        .orderBy(desc(winterCampaigns.createdAt))
        .limit(50);

      // Get related events
      const eventIds = campaigns.map(c => c.eventId);
      const events = eventIds.length > 0
        ? await db.select().from(winterEvents).where(inArray(winterEvents.eventId, eventIds))
        : [];

      const eventMap = new Map(events.map(e => [e.eventId, e]));

      res.json({
        campaigns: campaigns.map(c => ({
          ...c,
          event: eventMap.get(c.eventId)
        }))
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Campaigns list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/weather/campaigns/:id/approve
   * Approve a winter campaign
   */
  app.post('/api/weather/campaigns/:id/approve', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const campaignId = req.params.id;
      const approval = CampaignApprovalSchema.parse(req.body);

      // Get the campaign
      const [campaign] = await db
        .select()
        .from(winterCampaigns)
        .where(
          and(
            eq(winterCampaigns.campaignId, campaignId),
            eq(winterCampaigns.operatorId, operatorId)
          )
        )
        .limit(1);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (campaign.status !== 'PENDING') {
        return res.status(400).json({ error: `Campaign is ${campaign.status}, cannot approve` });
      }

      // Find associated approval packet
      const [packet] = await db
        .select()
        .from(weatherApprovalPackets)
        .where(
          and(
            eq(weatherApprovalPackets.operatorId, operatorId),
            eq(weatherApprovalPackets.type, 'WINTER_CAMPAIGN_APPROVAL')
          )
        )
        .orderBy(desc(weatherApprovalPackets.createdAt))
        .limit(1);

      if (packet?.workflowId) {
        // Signal the workflow
        const connection = await Connection.connect();
        const client = new Client({ connection });
        const handle = client.workflow.getHandle(packet.workflowId);

        await handle.signal('approval', {
          decision: approval.decision,
          approvedBy: operatorId,
          modifiedThrottle: approval.modifiedThrottle,
          rejectionReason: approval.rejectionReason
        });

        res.json({
          status: 'SIGNAL_SENT',
          workflowId: packet.workflowId
        });
      } else {
        // Direct update
        await db
          .update(winterCampaigns)
          .set({
            status: approval.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            approvedBy: operatorId,
            approvedAt: new Date()
          })
          .where(eq(winterCampaigns.campaignId, campaignId));

        res.json({ status: approval.decision });
      }
    } catch (error: any) {
      console.error('[WeatherAPI] Campaign approve error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Approval Packet Endpoints
  // ============================================

  /**
   * GET /api/weather/approvals
   * List pending approval packets
   */
  app.get('/api/weather/approvals', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;

      const packets = await db
        .select()
        .from(weatherApprovalPackets)
        .where(
          and(
            eq(weatherApprovalPackets.operatorId, operatorId),
            eq(weatherApprovalPackets.status, 'PENDING'),
            gte(weatherApprovalPackets.expiresAt, new Date())
          )
        )
        .orderBy(desc(weatherApprovalPackets.createdAt))
        .limit(20);

      res.json({ approvals: packets });
    } catch (error: any) {
      console.error('[WeatherAPI] Approvals list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Monitoring & Observability Endpoints
  // ============================================

  /**
   * GET /api/weather/monitoring/runs
   * Get recent monitoring runs
   */
  app.get('/api/weather/monitoring/runs', requireAuth, async (req, res) => {
    try {
      const operatorId = (req as any).operatorId;
      const serviceAreaId = req.query.serviceAreaId 
        ? Number(req.query.serviceAreaId)
        : undefined;

      const conditions = [eq(weatherMonitoringRuns.operatorId, operatorId)];
      if (serviceAreaId) {
        conditions.push(eq(weatherMonitoringRuns.serviceAreaId, serviceAreaId));
      }

      const runs = await db
        .select()
        .from(weatherMonitoringRuns)
        .where(and(...conditions))
        .orderBy(desc(weatherMonitoringRuns.startedAt))
        .limit(50);

      res.json({ runs });
    } catch (error: any) {
      console.error('[WeatherAPI] Monitoring runs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/weather/budget
   * Get weather API budget status
   */
  app.get('/api/weather/budget', requireAuth, async (req, res) => {
    try {
      const weatherService = getWeatherProviderService();
      
      res.json({
        budget: weatherService.getBudgetStatus(),
        cache: weatherService.getCacheStats()
      });
    } catch (error: any) {
      console.error('[WeatherAPI] Budget error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[WeatherAPI] Routes registered');
}
