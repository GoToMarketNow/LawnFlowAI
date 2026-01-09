import { apiClient } from './client';
import { secureStorage } from '../storage/secureStorage';
import { analytics } from '../analytics';
import type { InviteTokenResponse, User } from './types';

export async function exchangeInviteToken(inviteToken: string): Promise<InviteTokenResponse> {
  try {
    analytics.track('invite_exchange_attempt', { token: inviteToken.slice(0, 8) });

    const response = await apiClient.post<InviteTokenResponse>(
      '/api/auth/invite/exchange',
      { token: inviteToken }
    );

    await secureStorage.setItem('auth_token', response.data.token);
    await secureStorage.setItem('user_id', String(response.data.user.id));

    analytics.track('invite_exchange_success', { userId: response.data.user.id });

    return response.data;
  } catch (error: any) {
    analytics.track('invite_exchange_fail', { error: error.message });
    throw error;
  }
}

export async function getMe(): Promise<User> {
  const response = await apiClient.get<User>('/api/auth/me');
  return response.data;
}

export async function clearAuth(): Promise<void> {
  await secureStorage.removeItem('auth_token');
  await secureStorage.removeItem('user_id');
}
