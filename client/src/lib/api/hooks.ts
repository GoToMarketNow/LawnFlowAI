// ============================================
// API Client - Unified Data Fetching Layer
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { apiRequest } from './queryClient';

// ============================================
// Type Definitions
// ============================================

export interface Job {
  id: number;
  customerId: number;
  serviceType: string;
  status: string;
  scheduledDate?: string;
  scheduledTime?: string;
  amount?: number;
  propertySize?: string;
  notes?: string;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  crew?: {
    id: number;
    name: string;
  };
}

export interface Lead {
  id: number;
  customerName: string;
  phone: string;
  source: 'missed_call' | 'sms' | 'web' | 'referral';
  status: 'new' | 'contacted' | 'qualified' | 'quoted' | 'lost';
  createdAt: string;
  lastInteraction?: string;
}

export interface Crew {
  id: number;
  name: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  memberCount?: number;
  status: 'ACTIVE' | 'INACTIVE';
  specialties?: string[];
  equipment?: string[];
  homeBaseAddress?: string;
}

export interface DashboardMetrics {
  revenue: number;
  revenueChange: number;
  activeJobs: number;
  activeJobsChange: number;
  avgMargin: number;
  avgMarginChange: number;
  pendingQuotes: number;
  pendingQuotesChange: number;
}

// ============================================
// API Client Hooks
// ============================================

/**
 * Fetch dashboard metrics
 */
export function useDashboardMetrics(options?: UseQueryOptions<DashboardMetrics>) {
  return useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    ...options,
  });
}

/**
 * Fetch all jobs
 */
export function useJobs(filters?: { status?: string }, options?: UseQueryOptions<{ jobs: Job[] }>) {
  const queryKey = filters
    ? ['/api/jobs', new URLSearchParams(filters as any).toString()]
    : ['/api/jobs'];
    
  return useQuery<{ jobs: Job[] }>({
    queryKey,
    ...options,
  });
}

/**
 * Fetch single job by ID
 */
export function useJob(id: number | string, options?: UseQueryOptions<Job>) {
  return useQuery<Job>({
    queryKey: [`/api/jobs/${id}`],
    enabled: !!id,
    ...options,
  });
}

/**
 * Create new job
 */
export function useCreateJob(options?: UseMutationOptions<Job, Error, Partial<Job>>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const res = await apiRequest('POST', '/api/jobs', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    ...options,
  });
}

/**
 * Update job
 */
export function useUpdateJob(options?: UseMutationOptions<Job, Error, { id: number; data: Partial<Job> }>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest('PATCH', `/api/jobs/${id}`, data);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.id}`] });
    },
    ...options,
  });
}

/**
 * Fetch all leads
 */
export function useLeads(filters?: { status?: string }, options?: UseQueryOptions<{ leads: Lead[] }>) {
  const queryKey = filters
    ? ['/api/leads', new URLSearchParams(filters as any).toString()]
    : ['/api/leads'];
    
  return useQuery<{ leads: Lead[] }>({
    queryKey,
    ...options,
  });
}

/**
 * Convert lead to quote
 */
export function useConvertLeadToQuote(options?: UseMutationOptions<any, Error, number>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (leadId: number) => {
      const res = await apiRequest('POST', `/api/leads/${leadId}/convert-to-quote`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
    },
    ...options,
  });
}

/**
 * Mark lead as lost
 */
export function useMarkLeadLost(options?: UseMutationOptions<any, Error, { leadId: number; reason: string }>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ leadId, reason }) => {
      const res = await apiRequest('PATCH', `/api/leads/${leadId}`, { status: 'lost', lostReason: reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    },
    ...options,
  });
}

/**
 * Fetch all crews
 */
export function useCrews(options?: UseQueryOptions<{ crews: Crew[] }>) {
  return useQuery<{ crews: Crew[] }>({
    queryKey: ['/api/ops/crews'],
    ...options,
  });
}

/**
 * Create new crew
 */
export function useCreateCrew(options?: UseMutationOptions<Crew, Error, Partial<Crew>>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Crew>) => {
      const res = await apiRequest('POST', '/api/ops/crews', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/crews'] });
    },
    ...options,
  });
}

/**
 * Update crew
 */
export function useUpdateCrew(options?: UseMutationOptions<Crew, Error, { id: number; data: Partial<Crew> }>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest('PATCH', `/api/ops/crews/${id}`, data);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/crews'] });
      queryClient.invalidateQueries({ queryKey: [`/api/ops/crews/${variables.id}`] });
    },
    ...options,
  });
}

/**
 * Delete crew (soft delete)
 */
export function useDeleteCrew(options?: UseMutationOptions<void, Error, number>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/ops/crews/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/crews'] });
    },
    ...options,
  });
}

/**
 * Fetch customers
 */
export function useCustomers(options?: UseQueryOptions<{ customers: any[] }>) {
  return useQuery<{ customers: any[] }>({
    queryKey: ['/api/customers'],
    ...options,
  });
}
