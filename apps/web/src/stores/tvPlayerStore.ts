import { create } from 'zustand';
import { api } from '../lib/api';
import { getSocket, connectSocket, joinMachine } from '../lib/socket';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  duration: number;
  coverArtUrl: string | null;
  fileUrl: string | null;
  videoUrl: string | null;
}

interface QueueItem {
  id: string;
  position: number;
  status: string;
  isPriority: boolean;
  song: Song;
  user: { id: string; name: string };
}

interface TvPlayerState {
  machineId: string | null;
  machineName: string | null;
  venueName: string | null;
  queue: QueueItem[];
  currentItem: QueueItem | null;
  isPlaying: boolean;
  progress: number; // 0-100
  elapsed: number;
  duration: number;
  volume: number;
  showQueue: boolean;
  overlayText: string;
  isConnected: boolean;
  isIdle: boolean;

  setMachineId: (id: string) => void;
  fetchMachineInfo: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  playNext: () => void;
  setProgress: (elapsed: number, duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (v: number) => void;
  toggleQueue: () => void;
  setOverlayText: (text: string) => void;
  sendHeartbeat: () => void;
  saveState: () => void;
  restoreState: () => void;
}

export const useTvPlayerStore = create<TvPlayerState>((set, get) => ({
  machineId: null,
  machineName: null,
  venueName: null,
  queue: [],
  currentItem: null,
  isPlaying: false,
  progress: 0,
  elapsed: 0,
  duration: 0,
  volume: 80,
  showQueue: true,
  overlayText: '',
  isConnected: false,
  isIdle: false,

  setMachineId: (id) => set({ machineId: id }),

  fetchMachineInfo: async () => {
    const { machineId } = get();
    if (!machineId) return;
    try {
      const { data } = await api.get(`/machines/${machineId}`);
      const machine = data.data.machine;
      set({
        machineName: machine.name,
        venueName: machine.venue?.name || null,
      });
    } catch {
      // Machine not found
    }
  },

  fetchQueue: async () => {
    const { machineId } = get();
    if (!machineId) return;
    try {
      const { data } = await api.get(`/machines/${machineId}/queue`);
      const queue = data.data.queue || [];
      set({ queue });

      // If nothing is playing, start the first item
      const { currentItem } = get();
      if (!currentItem && queue.length > 0) {
        set({ currentItem: queue[0], isIdle: false });
      }
      if (queue.length === 0 && !currentItem) {
        set({ isIdle: true });
      }
    } catch {
      // Offline or error
    }
  },

  startListening: () => {
    const { machineId } = get();
    if (!machineId) return;

    const socket = connectSocket();
    joinMachine(machineId);
    set({ isConnected: true });

    socket.on('connect', () => set({ isConnected: true }));
    socket.on('disconnect', () => set({ isConnected: false }));

    socket.on('queue:updated', (data: QueueItem[]) => {
      set({ queue: data });
      const { currentItem } = get();
      if (!currentItem && data.length > 0) {
        set({ currentItem: data[0], isIdle: false });
      }
    });

    socket.on('queue:now-playing', (data: QueueItem | null) => {
      if (data) {
        set({ currentItem: data, isIdle: false });
      }
    });

    socket.on('queue:song-added', () => {
      get().fetchQueue();
    });
  },

  stopListening: () => {
    const socket = getSocket();
    socket.off('queue:updated');
    socket.off('queue:now-playing');
    socket.off('queue:song-added');
    socket.off('connect');
    socket.off('disconnect');
  },

  playNext: () => {
    const { queue, currentItem } = get();
    // Find next item after current
    const currentIndex = currentItem
      ? queue.findIndex((q) => q.id === currentItem.id)
      : -1;
    const nextItem = queue[currentIndex + 1] || null;

    if (nextItem) {
      set({
        currentItem: nextItem,
        progress: 0,
        elapsed: 0,
        isPlaying: true,
        isIdle: false,
      });
    } else {
      set({
        currentItem: null,
        progress: 0,
        elapsed: 0,
        isPlaying: false,
        isIdle: true,
      });
    }

    // Notify backend that song finished
    const { machineId } = get();
    if (machineId && currentItem) {
      api.post(`/machines/${machineId}/queue/skip`).catch(() => {});
    }

    get().saveState();
  },

  setProgress: (elapsed, duration) => {
    const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
    set({ elapsed, duration, progress });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(100, v)) }),
  toggleQueue: () => set((s) => ({ showQueue: !s.showQueue })),
  setOverlayText: (text) => set({ overlayText: text }),

  sendHeartbeat: () => {
    const { machineId, currentItem, queue, isConnected } = get();
    if (!machineId) return;
    const socket = getSocket();
    socket.emit('machine:heartbeat', {
      machineId,
      currentSong: currentItem?.song?.title || null,
      queueLength: queue.length,
      isOnline: isConnected,
    });
  },

  saveState: () => {
    const { machineId, currentItem, queue, volume, showQueue } = get();
    try {
      localStorage.setItem(
        'jb_tv_state',
        JSON.stringify({
          machineId,
          currentItemId: currentItem?.id || null,
          queueIds: queue.map((q) => q.id),
          volume,
          showQueue,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // Storage full
    }
  },

  restoreState: () => {
    try {
      const saved = localStorage.getItem('jb_tv_state');
      if (!saved) return;
      const state = JSON.parse(saved);
      // Only restore if saved within last 30 minutes
      if (Date.now() - state.savedAt > 30 * 60 * 1000) return;
      if (state.machineId) set({ machineId: state.machineId });
      if (state.volume) set({ volume: state.volume });
      if (state.showQueue !== undefined) set({ showQueue: state.showQueue });
    } catch {
      // Invalid saved state
    }
  },
}));
