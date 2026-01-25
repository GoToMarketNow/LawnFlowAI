import { create } from 'zustand';
import { secureStorage } from '../services/storage/secureStorage';
import type { User } from '../services/api/types';

interface DeviceBinding {
  id: number;
  deviceType: string;
  deviceName: string;
  verified: boolean;
  verifiedAt?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  deviceBinding: DeviceBinding | null;
  setAuth: (token: string, user: User) => void;
  setDeviceBinding: (binding: DeviceBinding) => void;
  clearAuth: () => Promise<void>;
  restoreAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  deviceBinding: null,

  setAuth: (token, user) => {
    set({ token, user, isAuthenticated: true });
  },

  setDeviceBinding: (binding) => {
    set({ deviceBinding: binding });
  },

  clearAuth: async () => {
    await secureStorage.removeItem('auth_token');
    await secureStorage.removeItem('user_id');
    await secureStorage.removeItem('device_binding');
    set({ token: null, user: null, isAuthenticated: false, deviceBinding: null });
  },

  restoreAuth: async () => {
    const token = await secureStorage.getItem('auth_token');
    const deviceBindingStr = await secureStorage.getItem('device_binding');
    
    if (token) {
      set({ token, isAuthenticated: true });
    }
    
    if (deviceBindingStr) {
      try {
        const deviceBinding = JSON.parse(deviceBindingStr);
        set({ deviceBinding });
      } catch (e) {
        console.error('Failed to parse device binding', e);
      }
    }
  },
}));
