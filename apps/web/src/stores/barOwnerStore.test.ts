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
import { useBarOwnerStore } from './barOwnerStore';

const mockApi = api as any;

beforeEach(() => {
  useBarOwnerStore.setState({
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
  });
  vi.clearAllMocks();
});

describe('barOwnerStore', () => {
  describe('fetchVenue', () => {
    it('fetches venues and sets the first one', async () => {
      const venue = { id: 'v1', code: 'MYBAR', name: 'My Bar', city: 'SP', settings: null };
      mockApi.get.mockResolvedValueOnce({ data: { data: { venues: [venue] } } });

      await useBarOwnerStore.getState().fetchVenue();

      expect(mockApi.get).toHaveBeenCalledWith('/venues');
      expect(useBarOwnerStore.getState().venue).toEqual(venue);
      expect(useBarOwnerStore.getState().isLoading).toBe(false);
    });

    it('sets venue to null when no venues returned', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { venues: [] } } });

      await useBarOwnerStore.getState().fetchVenue();

      expect(useBarOwnerStore.getState().venue).toBeNull();
    });

    it('sets isLoading to false even on error', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useBarOwnerStore.getState().fetchVenue()).rejects.toThrow();
      expect(useBarOwnerStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchMachine', () => {
    it('fetches machines and selects the first one', async () => {
      const machines = [
        { id: 'm1', name: 'Machine 1', status: 'ONLINE', lastHeartbeat: null, config: {} },
        { id: 'm2', name: 'Machine 2', status: 'OFFLINE', lastHeartbeat: null, config: {} },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useBarOwnerStore.getState().fetchMachine();

      expect(useBarOwnerStore.getState().machines).toEqual(machines);
      expect(useBarOwnerStore.getState().machine).toEqual(machines[0]);
    });

    it('selects previously selected machine if still present', async () => {
      const machines = [
        { id: 'm1', name: 'Machine 1', status: 'ONLINE', lastHeartbeat: null, config: {} },
        { id: 'm2', name: 'Machine 2', status: 'ONLINE', lastHeartbeat: null, config: {} },
      ];
      useBarOwnerStore.setState({ selectedMachineId: 'm2' });
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useBarOwnerStore.getState().fetchMachine();

      expect(useBarOwnerStore.getState().machine).toEqual(machines[1]);
    });

    it('handles empty machines list', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines: [] } } });

      await useBarOwnerStore.getState().fetchMachine();

      expect(useBarOwnerStore.getState().machines).toEqual([]);
      expect(useBarOwnerStore.getState().machine).toBeNull();
    });
  });

  describe('selectMachine', () => {
    it('sets selectedMachineId, machine, and clears queue', async () => {
      const machines = [
        { id: 'm1', name: 'Machine 1', status: 'ONLINE', lastHeartbeat: null, config: {} },
        { id: 'm2', name: 'Machine 2', status: 'ONLINE', lastHeartbeat: null, config: {} },
      ];
      useBarOwnerStore.setState({ machines, machine: machines[0], queue: [{ id: 'q1' } as any] });
      // Mock the fetchQueue call that selectMachine triggers
      mockApi.get.mockResolvedValueOnce({ data: { data: { queue: [] } } });

      useBarOwnerStore.getState().selectMachine('m2');

      expect(useBarOwnerStore.getState().selectedMachineId).toBe('m2');
      expect(useBarOwnerStore.getState().machine).toEqual(machines[1]);
      expect(useBarOwnerStore.getState().queue).toEqual([]);
    });
  });

  describe('fetchQueue', () => {
    it('fetches queue for the current machine', async () => {
      const machine = { id: 'm1', name: 'Machine 1', status: 'ONLINE', lastHeartbeat: null, config: {} };
      const queueItems = [
        { id: 'q1', position: 1, status: 'PLAYING', isPriority: false, song: { id: 's1', title: 'Song 1' }, user: { name: 'User 1' } },
      ];
      useBarOwnerStore.setState({ machine });
      mockApi.get.mockResolvedValueOnce({ data: { data: { queue: queueItems } } });

      await useBarOwnerStore.getState().fetchQueue();

      expect(mockApi.get).toHaveBeenCalledWith('/machines/m1/queue');
      expect(useBarOwnerStore.getState().queue).toEqual(queueItems);
    });

    it('does nothing when no machine is selected', async () => {
      await useBarOwnerStore.getState().fetchQueue();

      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('sets empty queue on error', async () => {
      useBarOwnerStore.setState({ machine: { id: 'm1', name: 'M1', status: 'ONLINE', lastHeartbeat: null, config: {} } });
      mockApi.get.mockRejectedValueOnce(new Error('fail'));

      await useBarOwnerStore.getState().fetchQueue();

      expect(useBarOwnerStore.getState().queue).toEqual([]);
    });
  });

  describe('fetchTransactions', () => {
    it('fetches transactions and calculates revenue', async () => {
      const today = new Date().toISOString().split('T')[0];
      const transactions = [
        { id: 't1', type: 'CREDIT', amount: 100, status: 'COMPLETED', createdAt: `${today}T12:00:00Z`, description: null },
        { id: 't2', type: 'CREDIT', amount: 50, status: 'COMPLETED', createdAt: `${today}T13:00:00Z`, description: null },
        { id: 't3', type: 'DEBIT', amount: 30, status: 'COMPLETED', createdAt: `${today}T14:00:00Z`, description: null },
        { id: 't4', type: 'CREDIT', amount: 200, status: 'PENDING', createdAt: `${today}T15:00:00Z`, description: null },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { transactions } } });

      await useBarOwnerStore.getState().fetchTransactions();

      const state = useBarOwnerStore.getState();
      expect(state.transactions).toHaveLength(4);
      // Only CREDIT + COMPLETED count: 100 + 50 = 150
      expect(state.revenueToday).toBe(150);
      expect(state.revenueMonth).toBe(150);
      expect(state.revenueTotal).toBe(150);
    });
  });

  describe('fetchPlaylists', () => {
    it('fetches playlists', async () => {
      const playlists = [
        { id: 'p1', name: 'Playlist 1', songCount: 5 },
        { id: 'p2', name: 'Playlist 2', songCount: 10 },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { playlists } } });

      await useBarOwnerStore.getState().fetchPlaylists();

      expect(mockApi.get).toHaveBeenCalledWith('/playlists');
      expect(useBarOwnerStore.getState().playlists).toEqual(playlists);
    });

    it('sets empty on error', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('fail'));

      await useBarOwnerStore.getState().fetchPlaylists();

      expect(useBarOwnerStore.getState().playlists).toEqual([]);
    });
  });

  describe('updatePricing', () => {
    it('calls PUT and updates venue settings', async () => {
      const venue = { id: 'v1', code: 'BAR', name: 'My Bar', city: 'SP', settings: { songPrice: 200, priorityPrice: 500, autoPlayPlaylistId: null, displayOptions: {} } };
      useBarOwnerStore.setState({ venue });
      mockApi.put.mockResolvedValueOnce({});

      await useBarOwnerStore.getState().updatePricing(300, 700);

      expect(mockApi.put).toHaveBeenCalledWith('/venues/v1/pricing', { songPrice: 300, priorityPrice: 700 });
      expect(useBarOwnerStore.getState().venue?.settings?.songPrice).toBe(300);
      expect(useBarOwnerStore.getState().venue?.settings?.priorityPrice).toBe(700);
    });

    it('does nothing when no venue is set', async () => {
      await useBarOwnerStore.getState().updatePricing(300, 700);

      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('calls PUT and merges settings', async () => {
      const venue = { id: 'v1', code: 'BAR', name: 'My Bar', city: 'SP', settings: { songPrice: 200, priorityPrice: 500, autoPlayPlaylistId: null, displayOptions: {} } };
      useBarOwnerStore.setState({ venue });
      mockApi.put.mockResolvedValueOnce({});

      await useBarOwnerStore.getState().updateSettings({ autoPlayPlaylistId: 'p1' });

      expect(mockApi.put).toHaveBeenCalledWith('/venues/v1', { settings: { autoPlayPlaylistId: 'p1' } });
      expect(useBarOwnerStore.getState().venue?.settings?.autoPlayPlaylistId).toBe('p1');
      // Existing settings preserved
      expect(useBarOwnerStore.getState().venue?.settings?.songPrice).toBe(200);
    });
  });
});
