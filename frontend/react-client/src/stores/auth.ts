import { create } from 'zustand';
import type { Me } from '../api/types';

interface AuthState {
  token: string | null;
  user: Me | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  setSession: (token: string, user: Me) => void;
  setUser: (user: Me) => void;
  clear: () => void;
}

/** Access token lives only in memory; the refresh token is an HttpOnly cookie the JS never sees. */
export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  status: 'loading',
  setSession: (token, user) => set({ token, user, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  clear: () => set({ token: null, user: null, status: 'anonymous' }),
}));

export const can = (user: Me | null, permission: string) => !!user?.permissions.includes(permission);
