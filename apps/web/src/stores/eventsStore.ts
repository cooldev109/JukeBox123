import { create } from 'zustand';
import { api } from '../lib/api';

interface EventConfig {
  skipQueue: { enabled: boolean; price: number };
  silence: {
    enabled: boolean;
    options: { duration: number; price: number }[];
  };
  textMessage: { enabled: boolean; price: number; maxLength: number };
  voiceMessage: {
    enabled: boolean;
    options: { duration: number; price: number }[];
    requiresApproval: boolean;
  };
  photo: { enabled: boolean; price: number; requiresApproval: boolean };
  reaction: {
    enabled: boolean;
    price: number;
    types: string[];
  };
  birthday: { enabled: boolean; price: number };
}

interface PendingEvent {
  id: string;
  type: string;
  status: string;
  content: string | null;
  duration: number | null;
  amount: number;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  machine: { id: string; name: string; venue: { id: string; name: string } };
}

interface EventsState {
  config: EventConfig | null;
  pendingEvents: PendingEvent[];
  isLoading: boolean;
  error: string | null;

  fetchConfig: (machineId: string) => Promise<void>;
  purchaseSkipQueue: (machineId: string, queueItemId: string) => Promise<{ eventId: string; transactionId: string }>;
  purchaseSilence: (machineId: string, duration: number, mode?: 'immediate' | 'between') => Promise<{ eventId: string; transactionId: string }>;
  purchaseTextMessage: (machineId: string, message: string) => Promise<{ eventId: string; transactionId: string }>;
  purchaseVoiceMessage: (machineId: string, audioUrl: string, duration: number) => Promise<{ eventId: string; transactionId: string }>;
  purchasePhoto: (machineId: string, photoUrl: string) => Promise<{ eventId: string; transactionId: string }>;
  purchaseReaction: (machineId: string, reactionType: string) => Promise<{ eventId: string; transactionId: string }>;
  purchaseBirthday: (machineId: string, birthdayName: string, message?: string, songId?: string) => Promise<{ eventId: string; transactionId: string }>;
  uploadMedia: (file: string, type: 'audio' | 'image') => Promise<string>;
  fetchPending: () => Promise<void>;
  approveEvent: (eventId: string) => Promise<void>;
  rejectEvent: (eventId: string) => Promise<void>;
}

export const useEventsStore = create<EventsState>((set) => ({
  config: null,
  pendingEvents: [],
  isLoading: false,
  error: null,

  fetchConfig: async (machineId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/events/config?machineId=${machineId}`);
      set({ config: data.data.events });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load events config' });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseSkipQueue: async (machineId, queueItemId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/skip-queue', { machineId, queueItemId });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to skip queue';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseSilence: async (machineId, duration, mode = 'between') => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/silence', { machineId, duration, mode });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to purchase silence';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseTextMessage: async (machineId, message) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/text-message', { machineId, message });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send text message';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseVoiceMessage: async (machineId, audioUrl, duration) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/voice-message', { machineId, audioUrl, duration });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send voice message';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchasePhoto: async (machineId, photoUrl) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/photo', { machineId, photoUrl });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send photo';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseReaction: async (machineId, reactionType) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/events/reaction', { machineId, reactionType });
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send reaction';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  purchaseBirthday: async (machineId, birthdayName, message, songId) => {
    set({ isLoading: true, error: null });
    try {
      const payload: any = { machineId, birthdayName };
      if (message) payload.message = message;
      if (songId) payload.songId = songId;
      const { data } = await api.post('/events/birthday', payload);
      return data.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to purchase birthday celebration';
      set({ error: msg });
      throw new Error(msg, { cause: err });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadMedia: async (file, type) => {
    const { data } = await api.post('/events/upload', { file, type });
    return data.data.url;
  },

  fetchPending: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/events/pending');
      set({ pendingEvents: data.data?.events || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  approveEvent: async (eventId) => {
    await api.post(`/events/${eventId}/approve`);
    // Remove from pending list
    set((state) => ({
      pendingEvents: state.pendingEvents.filter((e) => e.id !== eventId),
    }));
  },

  rejectEvent: async (eventId) => {
    await api.post(`/events/${eventId}/reject`);
    set((state) => ({
      pendingEvents: state.pendingEvents.filter((e) => e.id !== eventId),
    }));
  },
}));
