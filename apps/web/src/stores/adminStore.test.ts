import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../lib/api';
import { useAdminStore } from './adminStore';

const mockApi = api as any;

beforeEach(() => {
  useAdminStore.setState({
    machines: [],
    venues: [],
    revenue: null,
    users: [],
    songs: [],
    config: null,
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe('adminStore', () => {
  describe('fetchMachines', () => {
    it('fetches machines and sets state', async () => {
      const machines = [
        { id: 'm1', name: 'Machine 1', status: 'ONLINE', lastHeartbeat: null, venue: { id: 'v1', name: 'Bar', city: 'SP', state: 'SP' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useAdminStore.getState().fetchMachines();

      expect(mockApi.get).toHaveBeenCalledWith('/machines');
      expect(useAdminStore.getState().machines).toEqual(machines);
      expect(useAdminStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to false even on error', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('fail'));

      await expect(useAdminStore.getState().fetchMachines()).rejects.toThrow();
      expect(useAdminStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchVenues', () => {
    it('fetches venues and sets state', async () => {
      const venues = [
        { id: 'v1', name: 'Bar One', city: 'SP', state: 'SP', owner: { id: 'o1', name: 'Owner', email: 'o@test.com' }, machines: [] },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { venues } } });

      await useAdminStore.getState().fetchVenues();

      expect(mockApi.get).toHaveBeenCalledWith('/venues?limit=100');
      expect(useAdminStore.getState().venues).toEqual(venues);
    });
  });

  describe('fetchRevenue', () => {
    it('processes transactions into revenue data', async () => {
      const today = new Date().toISOString().split('T')[0];
      const transactions = [
        { id: 't1', type: 'CREDIT', amount: 100, status: 'COMPLETED', createdAt: `${today}T10:00:00Z`, venue: { name: 'Bar A' } },
        { id: 't2', type: 'CREDIT', amount: 200, status: 'COMPLETED', createdAt: `${today}T11:00:00Z`, venue: { name: 'Bar B' } },
        { id: 't3', type: 'DEBIT', amount: 50, status: 'COMPLETED', createdAt: `${today}T12:00:00Z`, venue: { name: 'Bar A' } },
        { id: 't4', type: 'CREDIT', amount: 75, status: 'PENDING', createdAt: `${today}T13:00:00Z`, venue: { name: 'Bar A' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { transactions } } });

      await useAdminStore.getState().fetchRevenue();

      const revenue = useAdminStore.getState().revenue;
      expect(revenue).toBeDefined();
      // Only CREDIT + COMPLETED: 100 + 200 = 300
      expect(revenue!.total).toBe(300);
      expect(revenue!.today).toBe(300);
      expect(revenue!.thisMonth).toBe(300);
      expect(revenue!.byVenue).toHaveLength(2);
      expect(revenue!.daily).toHaveLength(1);
    });

    it('handles empty transactions', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { transactions: [] } } });

      await useAdminStore.getState().fetchRevenue();

      const revenue = useAdminStore.getState().revenue;
      expect(revenue!.total).toBe(0);
      expect(revenue!.byVenue).toHaveLength(0);
    });
  });

  describe('fetchUsers', () => {
    it('fetches users', async () => {
      const users = [
        { id: 'u1', name: 'Admin', email: 'admin@test.com', phone: null, role: 'ADMIN', createdAt: '2025-01-01' },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { users } } });

      await useAdminStore.getState().fetchUsers();

      expect(mockApi.get).toHaveBeenCalledWith('/auth/users?');
      expect(useAdminStore.getState().users).toEqual(users);
    });

    it('sets empty array on error', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('forbidden'));

      await useAdminStore.getState().fetchUsers();

      expect(useAdminStore.getState().users).toEqual([]);
    });
  });

  describe('fetchSongs', () => {
    it('fetches songs with search params', async () => {
      const songs = [
        { id: 's1', title: 'Song 1', artist: 'Artist', album: null, genre: 'Pop', duration: 200, isActive: true },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { songs } } });

      await useAdminStore.getState().fetchSongs({ search: 'Song', genre: 'Pop' });

      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=Song'));
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('genre=Pop'));
      expect(useAdminStore.getState().songs).toEqual(songs);
    });

    it('fetches all songs without params', async () => {
      const songs = [{ id: 's1', title: 'Song 1', artist: 'A', album: null, genre: 'Rock', duration: 180, isActive: true }];
      mockApi.get.mockResolvedValueOnce({ data: { data: { songs } } });

      await useAdminStore.getState().fetchSongs();

      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('limit=100'));
      expect(useAdminStore.getState().songs).toEqual(songs);
    });
  });

  describe('fetchConfig', () => {
    it('fetches and sets config', async () => {
      const config = { defaultSongPrice: 200, defaultPriorityPrice: 500, commissionRate: 30, maxQueueSize: 50 };
      mockApi.get.mockResolvedValueOnce({ data: { data: { config } } });

      await useAdminStore.getState().fetchConfig();

      expect(mockApi.get).toHaveBeenCalledWith('/config/global');
      expect(useAdminStore.getState().config).toEqual(config);
    });

    it('sets null on error', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('fail'));

      await useAdminStore.getState().fetchConfig();

      expect(useAdminStore.getState().config).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('sends PUT and updates config state', async () => {
      const updatedConfig = { defaultSongPrice: 300, defaultPriorityPrice: 500, commissionRate: 30, maxQueueSize: 50 };
      mockApi.put.mockResolvedValueOnce({ data: { data: { config: updatedConfig } } });

      await useAdminStore.getState().updateConfig({ defaultSongPrice: 300 });

      expect(mockApi.put).toHaveBeenCalledWith('/config/global', { defaultSongPrice: 300 });
      expect(useAdminStore.getState().config).toEqual(updatedConfig);
    });

    it('throws on error (no silent catch)', async () => {
      mockApi.put.mockRejectedValueOnce(new Error('unauthorized'));

      await expect(useAdminStore.getState().updateConfig({ defaultSongPrice: 999 })).rejects.toThrow();
    });
  });
});
