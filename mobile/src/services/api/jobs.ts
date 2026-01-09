import { apiClient } from './client';
import type { Job, QAPhoto } from './types';

export async function fetchJobs(status?: 'upcoming' | 'completed'): Promise<Job[]> {
  const params = status ? { status } : {};
  const response = await apiClient.get<Job[]>('/api/jobs', { params });
  return response.data;
}

export async function getJobById(id: number): Promise<Job> {
  const response = await apiClient.get<Job>(`/api/jobs/${id}`);
  return response.data;
}

export async function getJobQAPhoto(id: number): Promise<QAPhoto> {
  const response = await apiClient.get<QAPhoto>(`/api/jobs/${id}/qa-photo`);
  return response.data;
}
