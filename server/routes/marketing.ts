/**
 * Marketing Agent API Routes
 * 
 * REST endpoints for prospect management, approvals, and performance metrics
 * 
 * @module server/routes/marketing
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  marketingProspects,
  outreachAttempts,
  marketingApprovals,
  socialSignals,
  marketingConsent,
  providerServiceAreas,
  providerCapabilities,
  type InsertMarketingProspect,
  type MarketingProspect,
} from '../../shared/schema-marketing';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { Client as TemporalClient } from '@temporalio/client';

const router = Router();

// =====================================
// Prospects API
// =====================================

/**
 * GET /api/marketing/prospects
 * List prospects with filtering and pagination
 */
router.get('/prospects', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const stage = req.query.stage as string;
    const status = req.query.status as string;
    const serviceabilityStatus = req.query.serviceabilityStatus as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let query = db.select().from(marketingProspects)
      .where(eq(marketingProspects.businessId, businessId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(marketingProspects.updatedAt));

    // Apply filters
    const conditions = [eq(marketingProspects.businessId, businessId)];
    
    if (stage) {
      conditions.push(eq(marketingProspects.stage, stage));
    }
    if (status) {
      conditions.push(eq(marketingProspects.status, status));
    }
    if (serviceabilityStatus) {
      conditions.push(eq(marketingProspects.serviceabilityStatus, serviceabilityStatus));
    }

    const prospects = await db.select().from(marketingProspects)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(marketingProspects.updatedAt));

    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(marketingProspects)
      .where(and(...conditions));

    res.json({
      prospects,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + prospects.length < count,
      },
    });
  } catch (error) {
    console.error('Error fetching prospects:', error);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
});

/**
 * GET /api/marketing/prospects/:id
 * Get prospect detail with outreach history
 */
router.get('/prospects/:id', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);

    const [prospect] = await db.select().from(marketingProspects)
      .where(eq(marketingProspects.id, prospectId))
      .limit(1);

    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    // Get outreach history
    const outreach = await db.select().from(outreachAttempts)
      .where(eq(outreachAttempts.prospectId, prospectId))
      .orderBy(desc(outreachAttempts.createdAt));

    res.json({
      prospect,
      outreach,
    });
  } catch (error) {
    console.error('Error fetching prospect:', error);
    res.status(500).json({ error: 'Failed to fetch prospect' });
  }
});

/**
 * PATCH /api/marketing/prospects/:id
 * Update prospect details
 */
router.patch('/prospects/:id', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const updates = req.body;

    const [updated] = await db.update(marketingProspects)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(marketingProspects.id, prospectId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    res.json({ prospect: updated });
  } catch (error) {
    console.error('Error updating prospect:', error);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
});

/**
 * POST /api/marketing/prospects/:id/rerun-prequal
 * Trigger pre-qualification re-evaluation
 */
router.post('/prospects/:id/rerun-prequal', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);

    const [prospect] = await db.select().from(marketingProspects)
      .where(eq(marketingProspects.id, prospectId))
      .limit(1);

    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    // Signal workflow to re-run pre-qual
    // TODO: Connect to Temporal client and send signal
    const client = await TemporalClient.connect();
    const workflowId = `${prospect.source}-${prospect.id}`;
    
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal('rerunPreQual');

    res.json({ message: 'Pre-qualification re-evaluation triggered' });
  } catch (error) {
    console.error('Error triggering pre-qual:', error);
    res.status(500).json({ error: 'Failed to trigger pre-qualification' });
  }
});

// =====================================
// Approvals API
// =====================================

/**
 * GET /api/marketing/approvals
 * List pending approvals
 */
router.get('/approvals', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const status = (req.query.status as string) || 'pending';

    const approvals = await db.select({
      approval: marketingApprovals,
      prospect: marketingProspects,
    })
      .from(marketingApprovals)
      .leftJoin(marketingProspects, eq(marketingApprovals.prospectId, marketingProspects.id))
      .where(and(
        eq(marketingApprovals.businessId, businessId),
        eq(marketingApprovals.status, status)
      ))
      .orderBy(desc(marketingApprovals.createdAt));

    res.json({ approvals });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * GET /api/marketing/approvals/:id
 * Get approval detail
 */
router.get('/approvals/:id', async (req, res) => {
  try {
    const approvalId = parseInt(req.params.id);

    const [result] = await db.select({
      approval: marketingApprovals,
      prospect: marketingProspects,
    })
      .from(marketingApprovals)
      .leftJoin(marketingProspects, eq(marketingApprovals.prospectId, marketingProspects.id))
      .where(eq(marketingApprovals.id, approvalId))
      .limit(1);

    if (!result) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching approval:', error);
    res.status(500).json({ error: 'Failed to fetch approval' });
  }
});

/**
 * POST /api/marketing/approvals/:id/approve
 * Approve outreach
 */
router.post('/approvals/:id/approve', async (req, res) => {
  try {
    const approvalId = parseInt(req.params.id);
    const { message, reviewedBy } = req.body;

    // Get approval
    const [approval] = await db.select().from(marketingApprovals)
      .where(eq(marketingApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Update approval
    await db.update(marketingApprovals)
      .set({
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date(),
        finalMessage: message || approval.proposedMessage,
      })
      .where(eq(marketingApprovals.id, approvalId));

    // Signal workflow
    const client = await TemporalClient.connect();
    const [prospect] = await db.select().from(marketingProspects)
      .where(eq(marketingProspects.id, approval.prospectId))
      .limit(1);

    if (prospect) {
      const workflowId = `${prospect.source}-${prospect.id}`;
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal('approval', 'approved', message || approval.proposedMessage);
    }

    res.json({ message: 'Approval processed' });
  } catch (error) {
    console.error('Error approving:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

/**
 * POST /api/marketing/approvals/:id/reject
 * Reject outreach
 */
router.post('/approvals/:id/reject', async (req, res) => {
  try {
    const approvalId = parseInt(req.params.id);
    const { reason, reviewedBy } = req.body;

    const [approval] = await db.select().from(marketingApprovals)
      .where(eq(marketingApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    await db.update(marketingApprovals)
      .set({
        status: 'rejected',
        reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(marketingApprovals.id, approvalId));

    // Signal workflow
    const client = await TemporalClient.connect();
    const [prospect] = await db.select().from(marketingProspects)
      .where(eq(marketingProspects.id, approval.prospectId))
      .limit(1);

    if (prospect) {
      const workflowId = `${prospect.source}-${prospect.id}`;
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal('approval', 'rejected');
    }

    res.json({ message: 'Approval rejected' });
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// =====================================
// Metrics API
// =====================================

/**
 * GET /api/marketing/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : new Date();

    // Prospects by stage
    const byStage = await db.select({
      stage: marketingProspects.stage,
      count: sql<number>`count(*)`,
    })
      .from(marketingProspects)
      .where(and(
        eq(marketingProspects.businessId, businessId),
        gte(marketingProspects.createdAt, dateFrom),
        lte(marketingProspects.createdAt, dateTo)
      ))
      .groupBy(marketingProspects.stage);

    // Prospects by source
    const bySource = await db.select({
      source: marketingProspects.source,
      count: sql<number>`count(*)`,
    })
      .from(marketingProspects)
      .where(and(
        eq(marketingProspects.businessId, businessId),
        gte(marketingProspects.createdAt, dateFrom),
        lte(marketingProspects.createdAt, dateTo)
      ))
      .groupBy(marketingProspects.source);

    // Serviceability breakdown
    const serviceabilityBreakdown = await db.select({
      status: marketingProspects.serviceabilityStatus,
      count: sql<number>`count(*)`,
    })
      .from(marketingProspects)
      .where(and(
        eq(marketingProspects.businessId, businessId),
        gte(marketingProspects.createdAt, dateFrom),
        lte(marketingProspects.createdAt, dateTo)
      ))
      .groupBy(marketingProspects.serviceabilityStatus);

    // Conversion metrics
    const [totals] = await db.select({
      identified: sql<number>`count(*) filter (where stage = 'identified')`,
      engaged: sql<number>`count(*) filter (where stage = 'engaged')`,
      converted: sql<number>`count(*) filter (where stage = 'converted')`,
      avgConfidence: sql<number>`avg(confidence)`,
    })
      .from(marketingProspects)
      .where(and(
        eq(marketingProspects.businessId, businessId),
        gte(marketingProspects.createdAt, dateFrom),
        lte(marketingProspects.createdAt, dateTo)
      ));

    // Outreach metrics
    const [outreachMetrics] = await db.select({
      totalSent: sql<number>`count(*)`,
      avgCostCents: sql<number>`avg(cost_cents)`,
    })
      .from(outreachAttempts)
      .where(and(
        eq(outreachAttempts.businessId, businessId),
        gte(outreachAttempts.createdAt, dateFrom),
        lte(outreachAttempts.createdAt, dateTo)
      ));

    res.json({
      byStage,
      bySource,
      serviceabilityBreakdown,
      totals,
      outreachMetrics,
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/marketing/metrics/funnel
 * Get funnel conversion data
 */
router.get('/metrics/funnel', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [funnel] = await db.select({
      totalIdentified: sql<number>`count(*)`,
      prequalified: sql<number>`count(*) filter (where serviceability_status = 'serviceable')`,
      contacted: sql<number>`count(*) filter (where status = 'contacted')`,
      responded: sql<number>`count(*) filter (where status = 'responded')`,
      handedOff: sql<number>`count(*) filter (where status = 'handed_off')`,
    })
      .from(marketingProspects)
      .where(and(
        eq(marketingProspects.businessId, businessId),
        gte(marketingProspects.createdAt, dateFrom)
      ));

    res.json({ funnel });
  } catch (error) {
    console.error('Error fetching funnel:', error);
    res.status(500).json({ error: 'Failed to fetch funnel' });
  }
});

// =====================================
// Configuration API
// =====================================

/**
 * GET /api/marketing/config/service-areas
 * Get service areas for business
 */
router.get('/config/service-areas', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);

    const areas = await db.select().from(providerServiceAreas)
      .where(eq(providerServiceAreas.businessId, businessId))
      .orderBy(desc(providerServiceAreas.createdAt));

    res.json({ areas });
  } catch (error) {
    console.error('Error fetching service areas:', error);
    res.status(500).json({ error: 'Failed to fetch service areas' });
  }
});

/**
 * POST /api/marketing/config/service-areas
 * Create service area
 */
router.post('/config/service-areas', async (req, res) => {
  try {
    const { businessId, name, areaType, polygonCoords, zipCodes, radiusCenter, radiusMiles } = req.body;

    const [area] = await db.insert(providerServiceAreas).values({
      businessId,
      name,
      areaType,
      polygonCoords,
      zipCodes,
      radiusCenter,
      radiusMiles,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.json({ area });
  } catch (error) {
    console.error('Error creating service area:', error);
    res.status(500).json({ error: 'Failed to create service area' });
  }
});

/**
 * GET /api/marketing/config/capabilities
 * Get provider capabilities
 */
router.get('/config/capabilities', async (req, res) => {
  try {
    const businessId = parseInt(req.query.businessId as string);

    const [capabilities] = await db.select().from(providerCapabilities)
      .where(eq(providerCapabilities.businessId, businessId))
      .limit(1);

    res.json({ capabilities });
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

/**
 * PUT /api/marketing/config/capabilities
 * Update provider capabilities
 */
router.put('/config/capabilities', async (req, res) => {
  try {
    const { businessId, ...capabilities } = req.body;

    // Upsert capabilities
    const existing = await db.select().from(providerCapabilities)
      .where(eq(providerCapabilities.businessId, businessId))
      .limit(1);

    if (existing[0]) {
      const [updated] = await db.update(providerCapabilities)
        .set({
          ...capabilities,
          updatedAt: new Date(),
        })
        .where(eq(providerCapabilities.businessId, businessId))
        .returning();

      res.json({ capabilities: updated });
    } else {
      const [created] = await db.insert(providerCapabilities)
        .values({
          businessId,
          ...capabilities,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json({ capabilities: created });
    }
  } catch (error) {
    console.error('Error updating capabilities:', error);
    res.status(500).json({ error: 'Failed to update capabilities' });
  }
});

// =====================================
// Webhooks API (for social platforms)
// =====================================

/**
 * POST /api/marketing/webhooks/social
 * Receive social platform signals
 */
router.post('/webhooks/social', async (req, res) => {
  try {
    const { platform, postId, text, authorHandle, url, businessId, geoHint } = req.body;

    // Create social signal
    const [signal] = await db.insert(socialSignals).values({
      businessId,
      platform,
      postId,
      authorHandle,
      postText: text,
      postUrl: url,
      geoHint,
      processed: false,
      createdAt: new Date(),
    }).returning();

    // Start SocialOpportunityWorkflow
    const client = await TemporalClient.connect();
    await client.workflow.start('SocialOpportunityWorkflow', {
      taskQueue: 'marketing',
      workflowId: `social-${signal.id}`,
      args: [{
        signalId: signal.id,
        businessId,
        signal: {
          platform,
          postId,
          text,
          authorHandle,
          url,
          geoHint,
        },
      }],
    });

    res.json({ message: 'Signal received', signalId: signal.id });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/marketing/webhooks/inbound-message
 * Receive inbound messages (SMS, email)
 */
router.post('/webhooks/inbound-message', async (req, res) => {
  try {
    const { businessId, message, channel, from } = req.body;

    // Start ResponseRouterWorkflow
    const client = await TemporalClient.connect();
    const workflowId = `response-${Date.now()}-${from.phone || from.email}`;
    
    await client.workflow.start('ResponseRouterWorkflow', {
      taskQueue: 'marketing',
      workflowId,
      args: [{
        businessId,
        inboundMessage: message,
        channel,
        from,
      }],
    });

    res.json({ message: 'Message received' });
  } catch (error) {
    console.error('Error processing inbound message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
