import { create } from 'zustand';
import { api } from '../lib/api';

interface Machine {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
  venue: { id: string; name: string; city: string; state: string };
}

interface VenueWithMachines {
  id: string;
  name: string;
  city: string;
  state: string;
  owner: { id: string; name: string; email: string | null };
  machines: Machine[];
}

interface RevenueData {
  total: number;
  today: number;
  thisMonth: number;
  byVenue: { venueName: string; amount: number }[];
  daily: { date: string; amount: number }[];
}

interface UserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
}

interface SongRecord {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  duration: number;
  isActive: boolean;
}

interface GlobalConfig {
  defaultSongPrice: number;
  defaultPriorityPrice: number;
  commissionRate: number;
  maxQueueSize: number;
  [key: string]: unknown;
}

interface AdminState {
  machines: Machine[];
  venues: VenueWithMachines[];
  revenue: RevenueData | null;
  users: UserRecord[];
  songs: SongRecord[];
  config: GlobalConfig | null;
  isLoading: boolean;
  fetchMachines: () => Promise<void>;
  fetchVenues: () => Promise<void>;
  fetchRevenue: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSongs: (params?: { search?: string; genre?: string }) => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (config: Partial<GlobalConfig>) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  machines: [],
  venues: [],
  revenue: null,
  users: [],
  songs: [],
  config: null,
  isLoading: false,

  fetchMachines: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/machines');
      set({ machines: data.data.machines });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchVenues: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/venues');
      set({ venues: data.data.venues });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRevenue: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/payments/history');
      // Process transactions into revenue data
      const transactions = data.data.transactions || [];
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = today.substring(0, 7);

      let total = 0;
      let todayTotal = 0;
      let monthTotal = 0;
      const byVenueMap = new Map<string, number>();
      const dailyMap = new Map<string, number>();

      for (const tx of transactions) {
        if (tx.type === 'DEBIT' || tx.status !== 'COMPLETED') continue;
        const amount = tx.amount;
        total += amount;

        const txDate = tx.createdAt.split('T')[0];
        if (txDate === today) todayTotal += amount;
        if (txDate.startsWith(thisMonth)) monthTotal += amount;

        dailyMap.set(txDate, (dailyMap.get(txDate) || 0) + amount);

        const venueName = tx.venue?.name || 'Unknown';
        byVenueMap.set(venueName, (byVenueMap.get(venueName) || 0) + amount);
      }

      set({
        revenue: {
          total,
          today: todayTotal,
          thisMonth: monthTotal,
          byVenue: Array.from(byVenueMap.entries()).map(([venueName, amount]) => ({
            venueName,
            amount,
          })),
          daily: Array.from(dailyMap.entries())
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUsers: async () => {
    set({ isLoading: true });
    try {
      // Admin endpoint to list users — falls back to empty
      const { data } = await api.get('/auth/users');
      set({ users: data.data.users || [] });
    } catch {
      set({ users: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSongs: async (params) => {
    set({ isLoading: true });
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.genre) query.set('genre', params.genre);
      query.set('limit', '100');
      const { data } = await api.get(`/songs?${query.toString()}`);
      set({ songs: data.data.songs });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchConfig: async () => {
    try {
      const { data } = await api.get('/config/global');
      set({ config: data.data.config });
    } catch {
      set({ config: null });
    }
  },

  updateConfig: async (configUpdate) => {
    const { data } = await api.put('/config/global', configUpdate);
    set({ config: data.data.config });
  },
}));
