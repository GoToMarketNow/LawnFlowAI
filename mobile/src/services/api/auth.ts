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

// QR Code Binding Methods
export interface QRBindingResponse {
  binding: {
    id: number;
    userId: number;
    deviceType: string;
    deviceName: string;
    requires_2fa: boolean;
    created_at: string;
  };
}

export async function bindDeviceWithQR(data: {
  qrCodeToken: string;
  deviceId: string;
  deviceType: 'ios' | 'android';
  deviceName?: string;
}): Promise<QRBindingResponse> {
  try {
    analytics.track('qr_binding_attempt', { device_type: data.deviceType });

    const response = await apiClient.post<QRBindingResponse>(
      '/api/mobile-binding/bind',
      data
    );

    // Store binding info
    await secureStorage.setItem('device_binding', JSON.stringify(response.data.binding));

    analytics.track('qr_binding_success', { binding_id: response.data.binding.id });

    return response.data;
  } catch (error: any) {
    analytics.track('qr_binding_fail', { error: error.message });
    throw error;
  }
}

export async function verifyDeviceBinding(bindingId: number): Promise<void> {
  try {
    analytics.track('binding_verify_attempt', { binding_id: bindingId });

    await apiClient.post('/api/mobile-binding/verify', { bindingId });

    analytics.track('binding_verify_success', { binding_id: bindingId });
  } catch (error: any) {
    analytics.track('binding_verify_fail', { error: error.message });
    throw error;
  }
}

export async function getDeviceBindingStatus(userId: number): Promise<{
  has_mobile_binding: boolean;
  bindings: Array<{
    id: number;
    deviceType: string;
    deviceName: string;
    verified: boolean;
    verifiedAt?: string;
  }>;
}> {
  const response = await apiClient.get(`/api/mobile-binding/status/${userId}`);
  return response.data;
}

export async function sendOTP(userId: number, phoneNumber: string): Promise<void> {
  await apiClient.post('/api/auth/send-otp', { userId, phoneNumber });
}

export async function verifyOTP(userId: number, code: string): Promise<{
  token: string;
  user: User;
}> {
  const response = await apiClient.post('/api/auth/verify-otp', { userId, code });
  
  if (response.data.token) {
    await secureStorage.setItem('auth_token', response.data.token);
    await secureStorage.setItem('user_id', String(response.data.user.id));
  }
  
  return response.data;
}
