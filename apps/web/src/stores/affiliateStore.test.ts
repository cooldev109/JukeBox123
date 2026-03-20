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
import { useAffiliateStore } from './affiliateStore';

const mockApi = api as any;

beforeEach(() => {
  useAffiliateStore.setState({
    summary: null,
    commissions: [],
    commissionSummary: null,
    referrals: [],
    qrData: null,
    isLoading: false,
  });
  vi.clearAllMocks();
});

describe('affiliateStore', () => {
  describe('fetchSummary', () => {
    it('calls api.get /affiliates/me/summary and sets summary', async () => {
      const summary = {
        daily: { amount: 100, count: 5 },
        monthly: { amount: 3000, count: 150 },
        yearly: { amount: 36000, count: 1800 },
        total: { amount: 50000, count: 2500 },
        activeReferrals: 12,
      };
      mockApi.get.mockResolvedValueOnce({ data: { data: summary } });

      await useAffiliateStore.getState().fetchSummary();

      expect(mockApi.get).toHaveBeenCalledWith('/affiliates/me/summary');
      expect(useAffiliateStore.getState().summary).toEqual(summary);
    });

    it('falls back to data directly when data.data is falsy', async () => {
      const summary = { daily: { amount: 0, count: 0 }, monthly: { amount: 0, count: 0 }, yearly: { amount: 0, count: 0 }, total: { amount: 0, count: 0 }, activeReferrals: 0 };
      mockApi.get.mockResolvedValueOnce({ data: summary });

      await useAffiliateStore.getState().fetchSummary();

      expect(useAffiliateStore.getState().summary).toEqual(summary);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useAffiliateStore.getState().fetchSummary();
      expect(useAffiliateStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: null } });
      await fetchPromise;
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useAffiliateStore.getState().fetchSummary()).rejects.toThrow('Network error');
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchCommissions', () => {
    it('calls api.get /affiliates/me/commissions and sets commissions and commissionSummary', async () => {
      const commissions = [
        { id: 'c1', amount: 50, type: 'SONG_PLAY', status: 'PENDING', venueName: 'Bar One', createdAt: '2025-01-01' },
      ];
      const summary = { totalEarnings: 500, pendingAmount: 50, paidAmount: 450, todayEarnings: 10 };
      mockApi.get.mockResolvedValueOnce({ data: { data: { commissions, summary } } });

      await useAffiliateStore.getState().fetchCommissions();

      expect(mockApi.get).toHaveBeenCalledWith('/affiliates/me/commissions');
      expect(useAffiliateStore.getState().commissions).toEqual(commissions);
      expect(useAffiliateStore.getState().commissionSummary).toEqual(summary);
    });

    it('sets empty commissions when API returns no commissions', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { commissions: null, summary: null } } });

      await useAffiliateStore.getState().fetchCommissions();

      expect(useAffiliateStore.getState().commissions).toEqual([]);
      expect(useAffiliateStore.getState().commissionSummary).toBeNull();
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useAffiliateStore.getState().fetchCommissions()).rejects.toThrow('Network error');
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchReferrals', () => {
    it('calls api.get /affiliates/me/referrals and sets referrals', async () => {
      const referrals = [
        { id: 'r1', venueName: 'Bar One', city: 'SP', state: 'SP', isActive: true, totalEarnings: 200 },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { referrals } } });

      await useAffiliateStore.getState().fetchReferrals();

      expect(mockApi.get).toHaveBeenCalledWith('/affiliates/me/referrals');
      expect(useAffiliateStore.getState().referrals).toEqual(referrals);
    });

    it('sets empty referrals when API returns no referrals', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { referrals: null } } });

      await useAffiliateStore.getState().fetchReferrals();

      expect(useAffiliateStore.getState().referrals).toEqual([]);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useAffiliateStore.getState().fetchReferrals();
      expect(useAffiliateStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { referrals: [] } } });
      await fetchPromise;
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useAffiliateStore.getState().fetchReferrals()).rejects.toThrow('Network error');
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchQRData', () => {
    it('calls api.get /affiliates/me/qr and sets qrData', async () => {
      const qrData = { referralCode: 'ABC123', qrData: 'data:image/png;base64,...', shareUrl: 'https://example.com/ref/ABC123' };
      mockApi.get.mockResolvedValueOnce({ data: { data: qrData } });

      await useAffiliateStore.getState().fetchQRData();

      expect(mockApi.get).toHaveBeenCalledWith('/affiliates/me/qr');
      expect(useAffiliateStore.getState().qrData).toEqual(qrData);
    });

    it('falls back to data directly when data.data is falsy', async () => {
      const qrData = { referralCode: 'XYZ', qrData: 'base64data', shareUrl: 'https://example.com/ref/XYZ' };
      mockApi.get.mockResolvedValueOnce({ data: qrData });

      await useAffiliateStore.getState().fetchQRData();

      expect(useAffiliateStore.getState().qrData).toEqual(qrData);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useAffiliateStore.getState().fetchQRData();
      expect(useAffiliateStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: null } });
      await fetchPromise;
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useAffiliateStore.getState().fetchQRData()).rejects.toThrow('Network error');
      expect(useAffiliateStore.getState().isLoading).toBe(false);
    });
  });
});
