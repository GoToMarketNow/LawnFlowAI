import { create } from 'zustand';
import { secureStorage } from '../services/storage/secureStorage';
import type { User } from '../services/api/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => Promise<void>;
  restoreAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: async () => {
    await secureStorage.removeItem('auth_token');
    await secureStorage.removeItem('user_id');
    set({ token: null, user: null, isAuthenticated: false });
  },

  restoreAuth: async () => {
    const token = await secureStorage.getItem('auth_token');
    if (token) {
      set({ token, isAuthenticated: true });
    }
  },
}));
