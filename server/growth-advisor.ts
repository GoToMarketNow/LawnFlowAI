import { storage } from "./storage";
import type { AccountPackage, AiActionUsage, GrowthRecommendation } from "@shared/schema";

interface UsageStats {
  today: { actionsUsed: number };
  last7Days: { actionsUsed: number };
  last30Days: { actionsUsed: number };
  monthToDate: { 
    actionsUsed: number; 
    daysElapsed: number; 
    daysInMonth: number;
  };
  breakdown: {
    inboundQualification: number;
    supervisorOrchestration: number;
    quoteGeneration: number;
    schedulingProposal: number;
    billingFollowup: number;
    reviewRequest: number;
  };
}

interface Predictions {
  projectedMonthlyActions: number;
  projectedDateHitAllowance: Date | null;
  projectedDateHitHardCap: Date | null;
  modelConfidence: number;
}

interface SeasonalityInfo {
  currentMonth: number;
  isPeakWindow: boolean;
  peakMonths: number[];
  seasonalBoostEligible: boolean;
}

interface CostAnalysis {
  currentSituation: {
    projectedOverageActions: number;
    packsNeededToCover: number;
    packCostUsd: number;
  };
  upgradeValue?: {
    upgradePriceUsd: number;
    additionalActionsIncluded: number;
    costPer1000Actions: number;
  };
}

interface GrowthRecommendationResult {
  type: "upgrade" | "pack" | "monitor" | "seasonal_boost";
  packageRecommended?: string;
  urgency: "low" | "moderate" | "high";
  reasoning: string;
  costAnalysis: CostAnalysis;
  alternative?: {
    type: string;
    quantity: number;
    costUsd: number;
    note: string;
  };
  confidenceScore: number;
  cta: {
    primary: string;
    secondary?: string;
  };
  rationale: {
    ruleTrigger: string;
    overagePercentage: number;
    daysUntilHardCap: number | null;
    cooldownOverrideReason?: string;
    seasonalNote?: string;
  };
}

const PACKAGE_TIERS = {
  starter: {
    name: "Starter",
    monthlyActionsIncluded: 3000,
    hardCapActions: 3500,
    packSizeActions: 1000,
    packPriceUsd: 25,
  },
  growth: {
    name: "Growth",
    monthlyActionsIncluded: 12000,
    hardCapActions: 15000,
    packSizeActions: 2000,
    packPriceUsd: 40,
    upgradePriceUsd: 449,
  },
  pro: {
    name: "Pro",
    monthlyActionsIncluded: 50000,
    hardCapActions: 60000,
    packSizeActions: 5000,
    packPriceUsd: 75,
    upgradePriceUsd: 999,
  },
};

const COOLDOWN_DAYS = {
  upgrade: 14,
  pack: 7,
};

export class GrowthAdvisorService {
  async getUsageStats(businessId: number): Promise<UsageStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();

    const usage7d = await storage.getAiActionUsage(businessId, last7Days, today);
    const usage30d = await storage.getAiActionUsage(businessId, last30Days, today);
    const usageMtd = await storage.getAiActionUsage(businessId, monthStart, today);
    const todayUsage = await storage.getTodayUsage(businessId);

    const sum = (records: AiActionUsage[]) => 
      records.reduce((acc, r) => acc + (r.totalActions || 0), 0);

    const sumByType = (records: AiActionUsage[]) => ({
      inboundQualification: records.reduce((acc, r) => acc + (r.inboundQualification || 0), 0),
      supervisorOrchestration: records.reduce((acc, r) => acc + (r.supervisorOrchestration || 0), 0),
      quoteGeneration: records.reduce((acc, r) => acc + (r.quoteGeneration || 0), 0),
      schedulingProposal: records.reduce((acc, r) => acc + (r.schedulingProposal || 0), 0),
      billingFollowup: records.reduce((acc, r) => acc + (r.billingFollowup || 0), 0),
      reviewRequest: records.reduce((acc, r) => acc + (r.reviewRequest || 0), 0),
    });

    return {
      today: { actionsUsed: todayUsage?.totalActions || 0 },
      last7Days: { actionsUsed: sum(usage7d) },
      last30Days: { actionsUsed: sum(usage30d) },
      monthToDate: {
        actionsUsed: sum(usageMtd),
        daysElapsed,
        daysInMonth,
      },
      breakdown: sumByType(usageMtd),
    };
  }

  calculatePredictions(
    usageStats: UsageStats, 
    accountPackage: AccountPackage
  ): Predictions {
    const { monthToDate } = usageStats;
    const dailyRate = monthToDate.daysElapsed > 0 
      ? monthToDate.actionsUsed / monthToDate.daysElapsed 
      : 0;
    
    const projectedMonthlyActions = Math.round(dailyRate * monthToDate.daysInMonth);
    
    const remaining = monthToDate.daysInMonth - monthToDate.daysElapsed;
    const allowanceRemaining = accountPackage.monthlyActionsIncluded - monthToDate.actionsUsed;
    const hardCapRemaining = accountPackage.hardCapActions - monthToDate.actionsUsed;
    
    let projectedDateHitAllowance: Date | null = null;
    let projectedDateHitHardCap: Date | null = null;
    
    if (dailyRate > 0 && allowanceRemaining > 0) {
      const daysUntilAllowance = Math.ceil(allowanceRemaining / dailyRate);
      if (daysUntilAllowance <= remaining) {
        const hitDate = new Date();
        hitDate.setDate(hitDate.getDate() + daysUntilAllowance);
        projectedDateHitAllowance = hitDate;
      }
    }
    
    if (dailyRate > 0 && hardCapRemaining > 0) {
      const daysUntilHardCap = Math.ceil(hardCapRemaining / dailyRate);
      if (daysUntilHardCap <= remaining) {
        const hitDate = new Date();
        hitDate.setDate(hitDate.getDate() + daysUntilHardCap);
        projectedDateHitHardCap = hitDate;
      }
    }
    
    const modelConfidence = Math.min(0.95, 0.5 + (monthToDate.daysElapsed / monthToDate.daysInMonth) * 0.45);
    
    return {
      projectedMonthlyActions,
      projectedDateHitAllowance,
      projectedDateHitHardCap,
      modelConfidence,
    };
  }

  getSeasonalityInfo(accountPackage: AccountPackage): SeasonalityInfo {
    const currentMonth = new Date().getMonth() + 1;
    const peakMonths = accountPackage.peakMonths || [4, 5, 6, 9, 10];
    const isPeakWindow = peakMonths.includes(currentMonth);
    
    return {
      currentMonth,
      isPeakWindow,
      peakMonths,
      seasonalBoostEligible: isPeakWindow,
    };
  }

  checkCooldowns(accountPackage: AccountPackage): { canNudgeUpgrade: boolean; canNudgePack: boolean } {
    const now = new Date();
    
    const canNudgeUpgrade = !accountPackage.lastUpgradeNudge || 
      (now.getTime() - new Date(accountPackage.lastUpgradeNudge).getTime()) / (1000 * 60 * 60 * 24) >= COOLDOWN_DAYS.upgrade;
    
    const canNudgePack = !accountPackage.lastPackNudge || 
      (now.getTime() - new Date(accountPackage.lastPackNudge).getTime()) / (1000 * 60 * 60 * 24) >= COOLDOWN_DAYS.pack;
    
    return { canNudgeUpgrade, canNudgePack };
  }

  async generateRecommendation(businessId: number): Promise<GrowthRecommendationResult | null> {
    const accountPackage = await storage.getAccountPackage(businessId);
    if (!accountPackage) {
      return null;
    }
    
    const usageStats = await this.getUsageStats(businessId);
    const predictions = this.calculatePredictions(usageStats, accountPackage);
    const seasonality = this.getSeasonalityInfo(accountPackage);
    const cooldowns = this.checkCooldowns(accountPackage);
    
    const allowance = accountPackage.monthlyActionsIncluded;
    const hardCap = accountPackage.hardCapActions;
    const overageActions = Math.max(0, predictions.projectedMonthlyActions - allowance);
    const overagePercentage = allowance > 0 ? (overageActions / allowance) * 100 : 0;
    
    const daysUntilHardCap = predictions.projectedDateHitHardCap 
      ? Math.ceil((predictions.projectedDateHitHardCap.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    
    const packsNeeded = Math.ceil(overageActions / accountPackage.packSizeActions);
    const packCost = packsNeeded * accountPackage.packPriceUsd;
    
    const costAnalysis: CostAnalysis = {
      currentSituation: {
        projectedOverageActions: overageActions,
        packsNeededToCover: packsNeeded,
        packCostUsd: packCost,
      },
    };
    
    const currentTier = accountPackage.packageName as keyof typeof PACKAGE_TIERS;
    let nextTier: keyof typeof PACKAGE_TIERS | null = null;
    if (currentTier === "starter") nextTier = "growth";
    else if (currentTier === "growth") nextTier = "pro";
    
    if (nextTier && PACKAGE_TIERS[nextTier]) {
      const nextTierInfo = PACKAGE_TIERS[nextTier];
      costAnalysis.upgradeValue = {
        upgradePriceUsd: nextTierInfo.upgradePriceUsd || 0,
        additionalActionsIncluded: nextTierInfo.monthlyActionsIncluded - allowance,
        costPer1000Actions: (nextTierInfo.upgradePriceUsd || 0) / ((nextTierInfo.monthlyActionsIncluded - allowance) / 1000),
      };
    }
    
    let recommendation: GrowthRecommendationResult;
    
    const upgradeExceptionTriggered = overagePercentage > 25 || (daysUntilHardCap !== null && daysUntilHardCap <= 7);
    const packExceptionTriggered = daysUntilHardCap !== null && daysUntilHardCap <= 2;
    
    if (predictions.projectedMonthlyActions <= allowance) {
      recommendation = {
        type: "monitor",
        urgency: "low",
        reasoning: `Your usage is on track. You're projected to use ${predictions.projectedMonthlyActions.toLocaleString()} of ${allowance.toLocaleString()} included actions this month.`,
        costAnalysis,
        confidenceScore: predictions.modelConfidence,
        cta: {
          primary: "View Usage Details",
        },
        rationale: {
          ruleTrigger: "within_allowance",
          overagePercentage: 0,
          daysUntilHardCap,
        },
      };
    } else if ((cooldowns.canNudgeUpgrade || upgradeExceptionTriggered) && nextTier && overagePercentage > 25) {
      const tierInfo = PACKAGE_TIERS[nextTier];
      recommendation = {
        type: "upgrade",
        packageRecommended: nextTier,
        urgency: daysUntilHardCap !== null && daysUntilHardCap <= 7 ? "high" : "moderate",
        reasoning: `Your projected monthly usage of ${predictions.projectedMonthlyActions.toLocaleString()} actions exceeds your ${PACKAGE_TIERS[currentTier].name} allowance by ${Math.round(overagePercentage)}%. ${tierInfo.name} package gives you ${tierInfo.monthlyActionsIncluded.toLocaleString()} monthly actions—plenty of room to grow without interruption.`,
        costAnalysis,
        alternative: {
          type: "action_pack",
          quantity: packsNeeded,
          costUsd: packCost,
          note: "Covers this month only. If growth continues, upgrade is more cost-effective.",
        },
        confidenceScore: predictions.modelConfidence,
        cta: {
          primary: `Upgrade to ${tierInfo.name}`,
          secondary: `Add ${packsNeeded} Action Pack${packsNeeded > 1 ? "s" : ""} ($${packCost})`,
        },
        rationale: {
          ruleTrigger: "projected_monthly_exceeds_allowance_by_25_percent",
          overagePercentage: Math.round(overagePercentage * 10) / 10,
          daysUntilHardCap,
          cooldownOverrideReason: upgradeExceptionTriggered && !cooldowns.canNudgeUpgrade 
            ? "Overage exceeds 25% threshold" 
            : undefined,
        },
      };
    } else if (cooldowns.canNudgePack || packExceptionTriggered) {
      recommendation = {
        type: "pack",
        urgency: daysUntilHardCap !== null && daysUntilHardCap <= 2 ? "high" : "moderate",
        reasoning: `You're on track to exceed your monthly allowance. Adding ${packsNeeded} action pack${packsNeeded > 1 ? "s" : ""} will keep your service running smoothly.`,
        costAnalysis,
        confidenceScore: predictions.modelConfidence,
        cta: {
          primary: `Add ${packsNeeded} Action Pack${packsNeeded > 1 ? "s" : ""} ($${packCost})`,
          secondary: nextTier ? `Consider ${PACKAGE_TIERS[nextTier].name} Upgrade` : undefined,
        },
        rationale: {
          ruleTrigger: "projected_overage_within_pack_range",
          overagePercentage: Math.round(overagePercentage * 10) / 10,
          daysUntilHardCap,
        },
      };
    } else {
      recommendation = {
        type: "monitor",
        urgency: "low",
        reasoning: "We'll keep an eye on your usage and let you know if action is needed.",
        costAnalysis,
        confidenceScore: predictions.modelConfidence,
        cta: {
          primary: "View Usage Details",
        },
        rationale: {
          ruleTrigger: "cooldown_active",
          overagePercentage: Math.round(overagePercentage * 10) / 10,
          daysUntilHardCap,
        },
      };
    }
    
    if (seasonality.isPeakWindow && !recommendation.rationale.seasonalNote) {
      recommendation.rationale.seasonalNote = "Peak season active. Consider seasonal boost packs for extra capacity.";
    } else if (!seasonality.isPeakWindow) {
      recommendation.rationale.seasonalNote = `Not in peak window. Peak months: ${seasonality.peakMonths.join(", ")}.`;
    }
    
    return recommendation;
  }

  async saveRecommendation(
    businessId: number, 
    recommendation: GrowthRecommendationResult,
    predictions: Predictions
  ): Promise<GrowthRecommendation> {
    return storage.createGrowthRecommendation({
      businessId,
      recommendationType: recommendation.type,
      packageRecommended: recommendation.packageRecommended,
      urgency: recommendation.urgency,
      reasoning: recommendation.reasoning,
      costAnalysis: recommendation.costAnalysis,
      projectedMonthlyActions: predictions.projectedMonthlyActions,
      projectedDateHitAllowance: predictions.projectedDateHitAllowance,
      projectedDateHitHardCap: predictions.projectedDateHitHardCap,
      modelConfidence: predictions.modelConfidence,
    });
  }

  async updateNudgeCooldown(packageId: number, type: "upgrade" | "pack"): Promise<void> {
    const updates: Record<string, Date> = {};
    if (type === "upgrade") {
      updates.lastUpgradeNudge = new Date();
    } else {
      updates.lastPackNudge = new Date();
    }
    await storage.updateAccountPackage(packageId, updates);
  }
}

export const growthAdvisor = new GrowthAdvisorService();
