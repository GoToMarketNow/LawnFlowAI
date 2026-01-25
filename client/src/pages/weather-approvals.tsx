// ============================================
// Weather Approvals Page
// Ops console for approving schedule changes and campaigns
// ============================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  CloudSnow,
  RefreshCw,
  XCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { ImpactPreview, ImpactSummaryBadge } from '@/components/weather/ImpactPreview';
import { CampaignProposal } from '@/components/weather/CampaignProposal';
import { WeatherRiskBadge } from '@/components/weather/WeatherRiskBadge';

// Types
interface SchedulePlan {
  id: number;
  planId: string;
  status: string;
  changeSetData: any;
  weatherSummary: string;
  impactedJobCount: number;
  createdAt: string;
  expiresAt: string;
}

interface WinterCampaign {
  id: number;
  campaignId: string;
  eventId: string;
  status: string;
  proposalData: any;
  segmentSize: number;
  createdAt: string;
  event?: any;
}

interface ApprovalPacket {
  id: number;
  packetId: string;
  type: string;
  summary: string;
  proposalsData: any;
  status: string;
  createdAt: string;
  expiresAt: string;
}

// API functions
async function fetchPendingApprovals(): Promise<ApprovalPacket[]> {
  const response = await fetch('/api/weather/approvals', {
    headers: { 'x-operator-id': '1' } // In production, from auth context
  });
  if (!response.ok) throw new Error('Failed to fetch approvals');
  const data = await response.json();
  return data.approvals;
}

async function fetchSchedulePlans(): Promise<SchedulePlan[]> {
  const response = await fetch('/api/weather/plans?status=PENDING', {
    headers: { 'x-operator-id': '1' }
  });
  if (!response.ok) throw new Error('Failed to fetch plans');
  const data = await response.json();
  return data.plans;
}

async function fetchCampaigns(): Promise<WinterCampaign[]> {
  const response = await fetch('/api/weather/campaigns?status=PENDING', {
    headers: { 'x-operator-id': '1' }
  });
  if (!response.ok) throw new Error('Failed to fetch campaigns');
  const data = await response.json();
  return data.campaigns;
}

async function approvePlan(planId: string, decision: string, selectedChanges?: number[]): Promise<void> {
  const response = await fetch(`/api/weather/plans/${planId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-operator-id': '1'
    },
    body: JSON.stringify({ decision, selectedChanges })
  });
  if (!response.ok) throw new Error('Failed to approve plan');
}

async function approveCampaign(
  campaignId: string, 
  decision: string, 
  modifiedThrottle?: any,
  rejectionReason?: string
): Promise<void> {
  const response = await fetch(`/api/weather/campaigns/${campaignId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-operator-id': '1'
    },
    body: JSON.stringify({ decision, modifiedThrottle, rejectionReason })
  });
  if (!response.ok) throw new Error('Failed to approve campaign');
}

export default function WeatherApprovalsPage() {
  const [selectedPlan, setSelectedPlan] = useState<SchedulePlan | null>(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: approvals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: ['weather-approvals'],
    queryFn: fetchPendingApprovals,
    refetchInterval: 30000 // Refresh every 30s
  });

  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['weather-plans'],
    queryFn: fetchSchedulePlans,
    refetchInterval: 30000
  });

  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ['weather-campaigns'],
    queryFn: fetchCampaigns,
    refetchInterval: 30000
  });

  // Mutations
  const planMutation = useMutation({
    mutationFn: ({ planId, decision, selectedChanges }: { planId: string; decision: string; selectedChanges?: number[] }) =>
      approvePlan(planId, decision, selectedChanges),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weather-plans'] });
      queryClient.invalidateQueries({ queryKey: ['weather-approvals'] });
      setSelectedPlan(null);
      toast({
        title: 'Plan Updated',
        description: 'Schedule changes have been processed.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const campaignMutation = useMutation({
    mutationFn: ({ campaignId, decision, modifiedThrottle, rejectionReason }: any) =>
      approveCampaign(campaignId, decision, modifiedThrottle, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weather-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['weather-approvals'] });
      toast({
        title: 'Campaign Updated',
        description: 'Winter campaign has been processed.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const pendingCount = plans.length + campaigns.length;
  const isLoading = approvalsLoading || plansLoading || campaignsLoading;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            Weather Approvals
          </h1>
          <p className="text-muted-foreground">
            Review and approve weather-related schedule changes and campaigns
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {pendingCount} pending
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPlans();
              refetchCampaigns();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Changes
            {plans.length > 0 && (
              <Badge variant="secondary" className="ml-1">{plans.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <CloudSnow className="h-4 w-4" />
            Winter Campaigns
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1">{campaigns.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Schedule Changes Tab */}
        <TabsContent value="schedule" className="mt-4">
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All Clear</h3>
                <p className="text-muted-foreground">No pending schedule changes to review</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Plans list */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pending Plans</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                      {plans.map((plan) => (
                        <div
                          key={plan.planId}
                          className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedPlan?.planId === plan.planId ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedPlan(plan)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">
                                {plan.impactedJobCount} jobs affected
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(plan.createdAt).toLocaleString()}
                              </p>
                              {plan.changeSetData?.metrics && (
                                <ImpactSummaryBadge metrics={plan.changeSetData.metrics} />
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {plan.weatherSummary && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {plan.weatherSummary}
                            </p>
                          )}
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Plan details */}
              <div className="lg:col-span-2">
                {selectedPlan ? (
                  <div className="space-y-4">
                    <ImpactPreview
                      changes={selectedPlan.changeSetData?.impactedJobs || []}
                      metrics={selectedPlan.changeSetData?.metrics || {
                        disruptionMinutes: 0,
                        addedDriveMinutes: 0,
                        overtimeRisk: 0,
                        slaImpactScore: 0,
                        marginImpactEstimate: 0,
                        affectedCustomers: 0,
                        affectedCrews: 0
                      }}
                      weatherSummary={selectedPlan.weatherSummary}
                    />

                    {/* Action buttons */}
                    <Card>
                      <CardContent className="flex justify-end gap-2 py-4">
                        <Button
                          variant="outline"
                          onClick={() => planMutation.mutate({
                            planId: selectedPlan.planId,
                            decision: 'REJECT'
                          })}
                          disabled={planMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            // For partial approval, would show selection UI
                            planMutation.mutate({
                              planId: selectedPlan.planId,
                              decision: 'PARTIAL',
                              selectedChanges: selectedPlan.changeSetData?.impactedJobs
                                ?.slice(0, Math.ceil(selectedPlan.changeSetData.impactedJobs.length / 2))
                                ?.map((j: any) => j.jobId)
                            });
                          }}
                          disabled={planMutation.isPending}
                        >
                          Partial Approve
                        </Button>
                        <Button
                          onClick={() => planMutation.mutate({
                            planId: selectedPlan.planId,
                            decision: 'APPROVE'
                          })}
                          disabled={planMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {planMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve All
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Select a plan to review details</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Winter Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-4">
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No Pending Campaigns</h3>
                <p className="text-muted-foreground">Winter campaigns will appear here when detected</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {campaigns.map((campaign) => (
                <CampaignProposal
                  key={campaign.campaignId}
                  event={campaign.event || {
                    eventId: campaign.eventId,
                    eventType: 'SNOW',
                    windowStart: new Date().toISOString(),
                    windowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    confidence: 0.8
                  }}
                  proposal={campaign.proposalData || {
                    campaignId: campaign.campaignId,
                    eventId: campaign.eventId,
                    segment: {
                      estimatedCustomers: campaign.segmentSize,
                      filtersApplied: []
                    },
                    offer: {
                      serviceType: 'SNOW_REMOVAL',
                      pricingModel: 'FIXED',
                      basePrice: 75
                    },
                    capacity: {
                      maxAcceptsTotal: 50,
                      maxAcceptsPerHour: 10
                    },
                    throttle: {
                      batchSize: 20,
                      delayBetweenBatchesSec: 30
                    },
                    metricsEstimate: {
                      expectedConversionRate: 0.15,
                      expectedRevenue: campaign.segmentSize * 0.15 * 75,
                      expectedMargin: campaign.segmentSize * 0.15 * 30
                    }
                  }}
                  onApprove={(modifiedThrottle) => {
                    campaignMutation.mutate({
                      campaignId: campaign.campaignId,
                      decision: 'APPROVE',
                      modifiedThrottle
                    });
                  }}
                  onReject={(reason) => {
                    campaignMutation.mutate({
                      campaignId: campaign.campaignId,
                      decision: 'REJECT',
                      rejectionReason: reason
                    });
                  }}
                  isLoading={campaignMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
