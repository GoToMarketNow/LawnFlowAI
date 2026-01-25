/**
 * Marketing API Hooks for Mobile App
 * 
 * React Query hooks for fetching marketing data in React Native
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';

// =====================================
// Types
// =====================================

export interface MarketingProspect {
  id: number;
  name?: string;
  phone?: string;
  source: string;
  stage: string;
  status: string;
  serviceabilityStatus?: string;
  confidence: number;
  requestedServices?: string[];
  city?: string;
  state?: string;
  createdAt: string;
  lastOutreachAt?: string;
}

export interface MarketingMetrics {
  totalProspects: number;
  preQualified: number;
  engaged: number;
  converted: number;
  conversionRate: number;
  serviceabilityBreakdown: {
    serviceable: number;
    maybeServiceable: number;
    notServiceable: number;
  };
  bySource: {
    social: number;
    referral: number;
  };
}

// =====================================
// Hooks
// =====================================

/**
 * Fetch marketing metrics
 */
export function useMarketingMetrics(dateRange: number = 30) {
  return useQuery({
    queryKey: ['marketing-metrics-mobile', dateRange],
    queryFn: async () => {
      const dateFrom = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);
      const dateTo = new Date();

      const params = new URLSearchParams({
        businessId: '1', // TODO: Get from auth context
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });

      const response = await apiRequest(`/api/marketing/metrics?${params}`);
      const data = response.data;

      // Transform to mobile-friendly format
      const serviceabilityBreakdown = data.serviceabilityBreakdown || [];
      const serviceable = serviceabilityBreakdown.find((s: any) => s.status === 'serviceable')?.count || 0;
      const maybeServiceable = serviceabilityBreakdown.find((s: any) => s.status === 'maybe_serviceable')?.count || 0;
      const notServiceable = serviceabilityBreakdown.find((s: any) => s.status === 'not_serviceable')?.count || 0;

      const bySource = data.bySource || [];
      const social = bySource.find((s: any) => s.source === 'social')?.count || 0;
      const referral = bySource.find((s: any) => s.source === 'referral')?.count || 0;

      const totals = data.totals || {};

      return {
        totalProspects: totals.identified || 0,
        preQualified: serviceable,
        engaged: totals.engaged || 0,
        converted: totals.converted || 0,
        conversionRate: totals.identified > 0 
          ? ((totals.converted / totals.identified) * 100)
          : 0,
        serviceabilityBreakdown: {
          serviceable,
          maybeServiceable,
          notServiceable,
        },
        bySource: {
          social,
          referral,
        },
      } as MarketingMetrics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch recent prospects
 */
export function useRecentProspects(limit: number = 10) {
  return useQuery({
    queryKey: ['marketing-prospects-recent', limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: '1',
        limit: limit.toString(),
        offset: '0',
      });

      const response = await apiRequest(`/api/marketing/prospects?${params}`);
      return response.data.prospects as MarketingProspect[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch prospects by stage
 */
export function useProspectsByStage(stage: 'identified' | 'engaged' | 'converted') {
  return useQuery({
    queryKey: ['marketing-prospects-by-stage', stage],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: '1',
        stage,
        limit: '50',
      });

      const response = await apiRequest(`/api/marketing/prospects?${params}`);
      return response.data.prospects as MarketingProspect[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch prospect detail
 */
export function useProspectDetail(prospectId: number) {
  return useQuery({
    queryKey: ['marketing-prospect', prospectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/marketing/prospects/${prospectId}`);
      return response.data;
    },
    enabled: !!prospectId,
  });
}

/**
 * Fetch pending approvals count
 */
export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['marketing-approvals-count'],
    queryFn: async () => {
      const response = await apiRequest('/api/marketing/approvals?businessId=1&status=pending');
      return response.data.approvals?.length || 0;
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 30000,
  });
}

/**
 * Fetch marketing funnel data
 */
export function useMarketingFunnel(dateRange: number = 30) {
  return useQuery({
    queryKey: ['marketing-funnel-mobile', dateRange],
    queryFn: async () => {
      const dateFrom = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);
      
      const params = new URLSearchParams({
        businessId: '1',
        dateFrom: dateFrom.toISOString(),
      });

      const response = await apiRequest(`/api/marketing/metrics/funnel?${params}`);
      return response.data.funnel;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Update prospect (optimistic update)
 */
export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, updates }: { prospectId: number; updates: Partial<MarketingProspect> }) => {
      const response = await apiRequest(`/api/marketing/prospects/${prospectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['marketing-prospect', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-prospects-recent'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-metrics-mobile'] });
    },
  });
}

/**
 * Trigger pre-qual re-run
 */
export function useRerunPreQual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospectId: number) => {
      const response = await apiRequest(`/api/marketing/prospects/${prospectId}/rerun-prequal`, {
        method: 'POST',
      });
      return response.data;
    },
    onSuccess: (data, prospectId) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-prospect', prospectId] });
    },
  });
}

/**
 * Get service areas (for owner configuration)
 */
export function useServiceAreas() {
  return useQuery({
    queryKey: ['marketing-service-areas'],
    queryFn: async () => {
      const response = await apiRequest('/api/marketing/config/service-areas?businessId=1');
      return response.data.areas;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });
}

/**
 * Get provider capabilities (for owner configuration)
 */
export function useProviderCapabilities() {
  return useQuery({
    queryKey: ['marketing-capabilities'],
    queryFn: async () => {
      const response = await apiRequest('/api/marketing/config/capabilities?businessId=1');
      return response.data.capabilities;
    },
    staleTime: 10 * 60 * 1000,
  });
}
