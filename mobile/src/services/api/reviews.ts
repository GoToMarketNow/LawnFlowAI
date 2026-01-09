import { apiClient } from './client';
import type { GoogleReviewLink } from './types';

export interface SubmitReviewRequest {
  rating: number; // 1-5
  comment?: string;
}

export async function submitReview(jobId: number, data: SubmitReviewRequest): Promise<void> {
  await apiClient.post(`/api/jobs/${jobId}/review`, data);
}

export async function getGoogleReviewLink(providerId: number): Promise<GoogleReviewLink> {
  const response = await apiClient.get<GoogleReviewLink>(`/api/providers/${providerId}/google-review-link`);
  return response.data;
}
