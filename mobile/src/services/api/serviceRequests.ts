import { apiClient } from './client';

export interface ServiceRequest {
  id: number;
  serviceId: number;
  serviceName: string;
  status: 'pending' | 'approved' | 'scheduled' | 'completed' | 'rejected';
  preferredDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceRequestData {
  serviceId: number;
  preferredDate?: string;
  notes?: string;
}

export async function createServiceRequest(data: CreateServiceRequestData): Promise<ServiceRequest> {
  const response = await apiClient.post<ServiceRequest>('/api/service-requests', data);
  return response.data;
}

export async function getServiceRequest(id: number): Promise<ServiceRequest> {
  const response = await apiClient.get<ServiceRequest>(`/api/service-requests/${id}`);
  return response.data;
}
