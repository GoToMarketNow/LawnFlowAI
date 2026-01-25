/**
 * Marketing Agent Registration
 * 
 * Registers the Marketing Agent in the agentRegistry table and tracks metrics
 * This allows the agent to appear in the Agents UI and collect performance data
 */

import { db } from '../db';
import { agentRegistry, agentRuns } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function registerMarketingAgent() {
  try {
    // Check if agent already registered
    const existing = await db.select().from(agentRegistry)
      .where(eq(agentRegistry.agentId, 'marketing_agent'))
      .limit(1);

    if (existing.length > 0) {
      console.log('[Marketing Agent] Already registered in agent registry');
      return existing[0];
    }

    // Register new agent
    const [agent] = await db.insert(agentRegistry).values({
      agentId: 'marketing_agent',
      agentName: 'Marketing Agent',
      agentType: 'orchestrator',
      description: 'AI agent for identifying, qualifying, and nurturing prospects from social media and referrals with intelligent pre-qualification',
      capabilities: JSON.stringify({
        socialListening: {
          platforms: ['nextdoor', 'facebook_groups'],
          keywordDetection: true,
          intentAnalysis: true,
          confidenceScoring: true,
        },
        referralCapture: {
          postJobTriggers: true,
          consentValidation: true,
          warmLeadOutreach: true,
        },
        preQualification: {
          locationValidation: true,
          serviceabilityCheck: true,
          propertyTypeInference: true,
          serviceMatching: true,
          threeAxisValidation: ['location', 'property_type', 'services'],
        },
        engagement: {
          tieredApproval: {
            auto: '>0.8',
            approval: '0.5-0.8',
            ignore: '<0.5',
          },
          humanInTheLoop: true,
          messageCustomization: true,
          politeDecline: true,
        },
        leadHandoff: {
          targetPipeline: 'Lead-to-Cash',
          onlyPreQualified: true,
          fullAttribution: true,
        },
      }),
      enabled: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('[Marketing Agent] Successfully registered in agent registry:', agent.id);
    return agent;
  } catch (error) {
    console.error('[Marketing Agent] Failed to register:', error);
    throw error;
  }
}

/**
 * Track agent execution metrics
 */
export async function trackMarketingAgentRun(data: {
  businessId: number;
  prospectId: number;
  workflowType: 'social' | 'referral' | 'response';
  status: 'success' | 'failed' | 'pending';
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  durationMs?: number;
  costCents?: number;
}) {
  try {
    const [run] = await db.insert(agentRuns).values({
      agentId: 'marketing_agent',
      businessId: data.businessId,
      status: data.status,
      inputData: data.inputData,
      outputData: data.outputData || null,
      errorMessage: data.errorMessage,
      durationMs: data.durationMs,
      costCents: data.costCents,
      metadata: JSON.stringify({
        prospectId: data.prospectId,
        workflowType: data.workflowType,
      }),
      startedAt: new Date(),
      completedAt: data.status !== 'pending' ? new Date() : null,
    }).returning();

    return run;
  } catch (error) {
    console.error('[Marketing Agent] Failed to track run:', error);
    // Don't throw - metrics tracking shouldn't break workflows
    return null;
  }
}

/**
 * Get Marketing Agent metrics for display
 */
export async function getMarketingAgentMetrics(businessId: number, daysBack: number = 30) {
  try {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const runs = await db.select().from(agentRuns)
      .where(
        eq(agentRuns.agentId, 'marketing_agent')
      );

    // Calculate aggregate metrics
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(r => r.status === 'success').length;
    const failedRuns = runs.filter(r => r.status === 'failed').length;
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

    const avgDuration = runs.length > 0 
      ? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.length
      : 0;

    const totalCost = runs.reduce((sum, r) => sum + (r.costCents || 0), 0);

    // Breakdown by workflow type
    const social = runs.filter(r => (r.metadata as any)?.workflowType === 'social').length;
    const referral = runs.filter(r => (r.metadata as any)?.workflowType === 'referral').length;
    const response = runs.filter(r => (r.metadata as any)?.workflowType === 'response').length;

    return {
      agent: {
        id: 'marketing_agent',
        name: 'Marketing Agent',
        enabled: true,
      },
      metrics: {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: successRate.toFixed(1),
        avgDurationMs: Math.round(avgDuration),
        totalCostCents: totalCost,
        breakdown: {
          social,
          referral,
          response,
        },
      },
    };
  } catch (error) {
    console.error('[Marketing Agent] Failed to get metrics:', error);
    return null;
  }
}

/**
 * Update agent configuration
 */
export async function updateMarketingAgentConfig(config: {
  enabled?: boolean;
  autoApprovalThreshold?: number;
  socialPlatforms?: string[];
}) {
  try {
    const [updated] = await db.update(agentRegistry)
      .set({
        enabled: config.enabled,
        updatedAt: new Date(),
      })
      .where(eq(agentRegistry.agentId, 'marketing_agent'))
      .returning();

    console.log('[Marketing Agent] Configuration updated');
    return updated;
  } catch (error) {
    console.error('[Marketing Agent] Failed to update config:', error);
    throw error;
  }
}
