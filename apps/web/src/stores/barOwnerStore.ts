import { create } from 'zustand';
import { api } from '../lib/api';

interface Machine {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
  config: Record<string, unknown>;
}

interface VenueSettings {
  songPrice: number;
  priorityPrice: number;
  autoPlayPlaylistId: string | null;
  displayOptions: Record<string, unknown>;
}

interface QueueItem {
  id: string;
  position: number;
  status: string;
  isPriority: boolean;
  song: { id: string; title: string; artist: string; coverArtUrl: string | null; duration: number };
  user: { name: string };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  createdAt: string;
}

interface Playlist {
  id: string;
  name: string;
  songCount: number;
}

interface BarOwnerState {
  venue: { id: string; code: string; name: string; city: string; pixKey: string | null; pixKeyType: string | null; settings: VenueSettings | null } | null;
  machine: Machine | null;
  machines: Machine[];
  selectedMachineId: string | null;
  queue: QueueItem[];
  transactions: Transaction[];
  playlists: Playlist[];
  revenueToday: number;
  revenueMonth: number;
  revenueTotal: number;
  isLoading: boolean;
  fetchVenue: () => Promise<void>;
  fetchMachine: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  selectMachine: (machineId: string) => void;
  updatePricing: (songPrice: number, priorityPrice: number) => Promise<void>;
  updateSettings: (settings: Partial<VenueSettings>) => Promise<void>;
}

export const useBarOwnerStore = create<BarOwnerState>((set, get) => ({
  venue: null,
  machine: null,
  machines: [],
  selectedMachineId: null,
  queue: [],
  transactions: [],
  playlists: [],
  revenueToday: 0,
  revenueMonth: 0,
  revenueTotal: 0,
  isLoading: false,

  fetchVenue: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/venues');
      const venues = data.data?.venues || [];
      if (venues.length > 0) {
        set({ venue: venues[0] });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMachine: async () => {
    try {
      const { data } = await api.get('/machines');
      const machines: Machine[] = data.data?.machines || [];
      const selectedId = get().selectedMachineId;
      const selected = selectedId ? machines.find(m => m.id === selectedId) : machines[0];
      set({ machines, machine: selected || machines[0] || null });
    } catch {
      // No machines
    }
  },

  selectMachine: (machineId: string) => {
    const machines = get().machines;
    const machine = machines.find(m => m.id === machineId) || null;
    set({ selectedMachineId: machineId, machine, queue: [] });
    if (machine) get().fetchQueue();
  },

  fetchQueue: async () => {
    const machine = get().machine;
    if (!machine) return;
    try {
      const { data } = await api.get(`/machines/${machine.id}/queue`);
      set({ queue: data.data.queue || [] });
    } catch {
      set({ queue: [] });
    }
  },

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/payments/history');
      const transactions: Transaction[] = data.data.transactions || [];
      set({ transactions });

      // Calculate revenue
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = today.substring(0, 7);
      let todayTotal = 0;
      let monthTotal = 0;
      let total = 0;

      for (const tx of transactions) {
        if (tx.type === 'DEBIT' || tx.status !== 'COMPLETED') continue;
        total += tx.amount;
        const txDate = tx.createdAt.split('T')[0];
        if (txDate === today) todayTotal += tx.amount;
        if (txDate.startsWith(thisMonth)) monthTotal += tx.amount;
      }

      set({ revenueToday: todayTotal, revenueMonth: monthTotal, revenueTotal: total });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPlaylists: async () => {
    try {
      const { data } = await api.get('/playlists');
      set({ playlists: data.data.playlists || [] });
    } catch {
      set({ playlists: [] });
    }
  },

  updatePricing: async (songPrice, priorityPrice) => {
    const venue = get().venue;
    if (!venue) return;
    await api.put(`/venues/${venue.id}/pricing`, { songPrice, priorityPrice });
    set((state) => ({
      venue: state.venue ? { ...state.venue, settings: { ...(state.venue.settings || { songPrice: 200, priorityPrice: 500, autoPlayPlaylistId: null, displayOptions: {} }), songPrice, priorityPrice } } : null,
    }));
  },

  updateSettings: async (settings) => {
    const venue = get().venue;
    if (!venue) return;
    await api.put(`/venues/${venue.id}`, { settings });
    set((state) => ({
      venue: state.venue ? { ...state.venue, settings: { ...(state.venue.settings || { songPrice: 200, priorityPrice: 500, autoPlayPlaylistId: null, displayOptions: {} }), ...settings } } : null,
    }));
  },
}));
