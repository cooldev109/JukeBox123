import { create } from 'zustand';
import { api } from '../lib/api';
import { useQueueStore } from './queueStore';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: string;
  avatar: string | null;
  regionAccess: string | null;
  referralCode: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, venueCode?: string) => Promise<User>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<string | null>;
  register: (data: { name: string; email?: string; phone?: string; password?: string; role?: string; barName?: string; barCity?: string; barState?: string; barAddress?: string }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<User>;
  qrRegister: (venueCode: string, name?: string, phone?: string) => Promise<{ venueName: string }>;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('jb_access_token'),
  isLoading: false,

  login: async (email, password, venueCode?) => {
    set({ isLoading: true });
    try {
      const payload: any = { email, password };
      if (venueCode) payload.venueCode = venueCode;
      const { data } = await api.post('/auth/login', payload);
      const { user, tokens, machine } = data.data;
      localStorage.setItem('jb_access_token', tokens.accessToken);
      localStorage.setItem('jb_refresh_token', tokens.refreshToken);
      set({ user, isAuthenticated: true });
      // Store machineId for customer venue context
      if (machine?.id) {
        useQueueStore.getState().setMachineId(machine.id);
        localStorage.setItem('jb_machine_id', machine.id);
      }
      return user;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithOtp: async (phone, otp) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { phone, otp });
      const { user, tokens } = data.data;
      localStorage.setItem('jb_access_token', tokens.accessToken);
      localStorage.setItem('jb_refresh_token', tokens.refreshToken);
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  requestOtp: async (phone) => {
    const { data } = await api.post('/auth/request-otp', { phone });
    return data.data?.otp || null; // Only returned in dev mode
  },

  register: async (input) => {
    set({ isLoading: true });
    try {
      // New account = fresh session, drop any cached venue/machine from a
      // previous tester so the new user doesn't inherit someone else's queue.
      localStorage.removeItem('jb_machine_id');
      localStorage.removeItem('jb_venue_name');
      localStorage.removeItem('jb_venue_code');
      const { data } = await api.post('/auth/register', input);
      const { user, tokens } = data.data;
      localStorage.setItem('jb_access_token', tokens.accessToken);
      localStorage.setItem('jb_refresh_token', tokens.refreshToken);
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async (credential) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/google', { credential });
      const { user, tokens } = data.data;
      localStorage.setItem('jb_access_token', tokens.accessToken);
      localStorage.setItem('jb_refresh_token', tokens.refreshToken);
      set({ user, isAuthenticated: true });
      return user;
    } finally {
      set({ isLoading: false });
    }
  },

  qrRegister: async (venueCode, name, phone) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/qr-register', { venueCode, name, phone });
      const { user, tokens, venue, machine } = data.data;
      localStorage.setItem('jb_access_token', tokens.accessToken);
      localStorage.setItem('jb_refresh_token', tokens.refreshToken);
      set({ user, isAuthenticated: true });
      // Store machineId so the customer can add songs to queue
      if (machine?.id) {
        useQueueStore.getState().setMachineId(machine.id);
        localStorage.setItem('jb_machine_id', machine.id);
      }
      return { venueName: venue.name };
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('jb_access_token');
      localStorage.removeItem('jb_refresh_token');
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('jb_access_token');
    localStorage.removeItem('jb_refresh_token');
    // Clear cached venue/machine context so the next user doesn't inherit it
    localStorage.removeItem('jb_machine_id');
    localStorage.removeItem('jb_venue_name');
    localStorage.removeItem('jb_venue_code');
    set({ user: null, isAuthenticated: false });
  },
}));
