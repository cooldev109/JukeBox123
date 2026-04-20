import { create } from 'zustand';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  duration: number;
  coverArtUrl: string | null;
  format: string;
}

interface QueueItem {
  id: string;
  position: number;
  status: string;
  isPriority: boolean;
  paidAmount: number;
  createdAt: string;
  song: Song;
  user: { id: string; name: string };
}

interface NowPlaying {
  queueItem: QueueItem | null;
  progress: { elapsed: number; duration: number; percentage: number } | null;
}

interface QueueState {
  queue: QueueItem[];
  nowPlaying: NowPlaying | null;
  machineId: string | null;
  venueName: string | null;
  venueCode: string | null;
  isLoading: boolean;
  setMachineId: (id: string) => void;
  setVenueInfo: (name: string | null, code: string | null) => void;
  fetchQueue: (machineId: string) => Promise<void>;
  fetchNowPlaying: (machineId: string) => Promise<void>;
  addToQueue: (machineId: string, songId: string, isPriority?: boolean) => Promise<void>;
  listenToUpdates: (machineId: string) => void;
  stopListening: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: [],
  nowPlaying: null,
  machineId: localStorage.getItem('jb_machine_id'),
  venueName: localStorage.getItem('jb_venue_name'),
  venueCode: localStorage.getItem('jb_venue_code'),
  isLoading: false,

  setMachineId: (id) => set({ machineId: id }),

  setVenueInfo: (name, code) => {
    if (name) localStorage.setItem('jb_venue_name', name);
    else localStorage.removeItem('jb_venue_name');
    if (code) localStorage.setItem('jb_venue_code', code);
    else localStorage.removeItem('jb_venue_code');
    set({ venueName: name, venueCode: code });
  },

  fetchQueue: async (machineId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/machines/${machineId}/queue`);
      set({ queue: data.data?.queue || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNowPlaying: async (machineId) => {
    try {
      const { data } = await api.get(`/machines/${machineId}/now-playing`);
      set({ nowPlaying: data.data });
    } catch {
      set({ nowPlaying: null });
    }
  },

  addToQueue: async (machineId, songId, isPriority = false) => {
    await api.post(`/machines/${machineId}/queue`, { songId, isPriority });
    // Queue will update via WebSocket
  },

  listenToUpdates: (machineId) => {
    const socket = getSocket();

    socket.on('queue:updated', (data: QueueItem[]) => {
      set({ queue: data });
    });

    socket.on('queue:now-playing', (data: QueueItem | null) => {
      if (data) {
        set({ nowPlaying: { queueItem: data, progress: null } });
      } else {
        set({ nowPlaying: null });
      }
    });

    socket.on('queue:song-added', () => {
      // Refresh queue to get accurate positions
      get().fetchQueue(machineId);
    });

    socket.on('queue:progress', (data: { elapsed: number; duration: number; percentage: number }) => {
      set((state) => ({
        nowPlaying: state.nowPlaying
          ? { ...state.nowPlaying, progress: data }
          : null,
      }));
    });
  },

  stopListening: () => {
    const socket = getSocket();
    socket.off('queue:updated');
    socket.off('queue:now-playing');
    socket.off('queue:song-added');
    socket.off('queue:progress');
  },
}));
