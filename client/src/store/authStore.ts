import { create } from 'zustand';
import { IUser } from '@shared/types';
import * as authApi from '../api/auth';

interface AuthState {
  user: IUser | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: IUser) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ user, token, loading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        set({ loading: false });
        return;
      }
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    }
  },
}));
