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
import { useEmployeeStore } from './employeeStore';

const mockApi = api as any;

beforeEach(() => {
  useEmployeeStore.setState({
    machines: [],
    venues: [],
    alerts: [],
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe('employeeStore', () => {
  describe('fetchMachines', () => {
    it('calls api.get /machines and sets machines from response', async () => {
      const machines = [
        { id: '1', name: 'Machine A', status: 'ONLINE', lastHeartbeat: null, venue: { id: 'v1', name: 'Bar', city: 'SP', state: 'SP' } },
        { id: '2', name: 'Machine B', status: 'OFFLINE', lastHeartbeat: null, venue: { id: 'v2', name: 'Club', city: 'RJ', state: 'RJ' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useEmployeeStore.getState().fetchMachines();

      expect(mockApi.get).toHaveBeenCalledWith('/machines');
      expect(useEmployeeStore.getState().machines).toEqual(machines);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useEmployeeStore.getState().fetchMachines();
      expect(useEmployeeStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { machines: [] } } });
      await fetchPromise;
      expect(useEmployeeStore.getState().isLoading).toBe(false);
    });

    it('sets empty array when API returns no machines', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines: null } } });

      await useEmployeeStore.getState().fetchMachines();

      expect(useEmployeeStore.getState().machines).toEqual([]);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useEmployeeStore.getState().fetchMachines()).rejects.toThrow('Network error');
      expect(useEmployeeStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchVenues', () => {
    it('calls api.get /venues and sets venues from response', async () => {
      const venues = [
        { id: 'v1', code: 'BAR01', name: 'Bar One', city: 'SP', state: 'SP', status: 'ACTIVE', owner: { id: 'o1', name: 'Owner', email: 'a@b.com' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { venues } } });

      await useEmployeeStore.getState().fetchVenues();

      expect(mockApi.get).toHaveBeenCalledWith('/venues');
      expect(useEmployeeStore.getState().venues).toEqual(venues);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useEmployeeStore.getState().fetchVenues();
      expect(useEmployeeStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { venues: [] } } });
      await fetchPromise;
      expect(useEmployeeStore.getState().isLoading).toBe(false);
    });

    it('sets empty array when API returns no venues', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { venues: null } } });

      await useEmployeeStore.getState().fetchVenues();

      expect(useEmployeeStore.getState().venues).toEqual([]);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useEmployeeStore.getState().fetchVenues()).rejects.toThrow('Network error');
      expect(useEmployeeStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchAlerts', () => {
    it('derives alerts from machines with ERROR status', async () => {
      const machines = [
        { id: 'm1', name: 'Machine A', status: 'ERROR', lastHeartbeat: '2025-01-01T00:00:00Z', venue: { id: 'v1', name: 'Bar', city: 'SP', state: 'SP' } },
        { id: 'm2', name: 'Machine B', status: 'ONLINE', lastHeartbeat: null, venue: { id: 'v2', name: 'Club', city: 'RJ', state: 'RJ' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useEmployeeStore.getState().fetchAlerts();

      const alerts = useEmployeeStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        id: 'm1',
        machineId: 'm1',
        type: 'AUDIO_FAIL',
        severity: 'HIGH',
        message: 'Machine reporting errors',
        isResolved: false,
      });
    });

    it('derives alerts from machines with ALERT status', async () => {
      const machines = [
        { id: 'm1', name: 'Inactive Machine', status: 'ALERT', lastHeartbeat: '2025-01-01T00:00:00Z', venue: { id: 'v1', name: 'Bar', city: 'SP', state: 'SP' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useEmployeeStore.getState().fetchAlerts();

      const alerts = useEmployeeStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: 'OWNER_INACTIVE',
        severity: 'MEDIUM',
        message: 'Machine inactive — owner alert',
      });
    });

    it('returns empty alerts when no machines have ERROR/ALERT status', async () => {
      const machines = [
        { id: 'm1', name: 'Machine A', status: 'ONLINE', lastHeartbeat: null, venue: { id: 'v1', name: 'Bar', city: 'SP', state: 'SP' } },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { machines } } });

      await useEmployeeStore.getState().fetchAlerts();

      expect(useEmployeeStore.getState().alerts).toEqual([]);
    });

    it('sets alerts to empty array on API error', async () => {
      useEmployeeStore.setState({ alerts: [{ id: 'old' } as any] });
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await useEmployeeStore.getState().fetchAlerts();

      expect(useEmployeeStore.getState().alerts).toEqual([]);
    });
  });
});
