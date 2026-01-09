import { apiClient } from './client';
import { Platform } from 'react-native';
import type { Notification } from './types';

export async function fetchNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<Notification[]>('/api/notifications');
  return response.data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.post(`/api/notifications/${id}/read`);
}

export async function registerDevice(fcmToken: string): Promise<void> {
  await apiClient.post('/api/notifications/device', {
    fcmToken,
    platform: Platform.OS,
  });
}
