import { apiClient } from './client';

export interface Service {
  id: number;
  name: string;
  description: string;
  category?: string;
  requiresApproval: boolean;
  isInstant: boolean;
}

export async function fetchProviderServices(providerId: number): Promise<Service[]> {
  const response = await apiClient.get<Service[]>(`/api/providers/${providerId}/services`);
  return response.data;
}
