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
import { useWalletStore } from './walletStore';

const mockApi = api as any;

beforeEach(() => {
  useWalletStore.setState({
    balance: 0,
    transactions: [],
    isLoading: false,
    pixQrCode: null,
    pixPaymentId: null,
    cardClientSecret: null,
  });
  vi.clearAllMocks();
});

describe('walletStore', () => {
  describe('fetchWallet', () => {
    it('calls api.get /payments/wallet and sets balance', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: { balance: 150.50 } } });

      await useWalletStore.getState().fetchWallet();

      expect(mockApi.get).toHaveBeenCalledWith('/payments/wallet');
      expect(useWalletStore.getState().balance).toBe(150.50);
    });

    it('keeps balance unchanged on API error (wallet may not exist)', async () => {
      useWalletStore.setState({ balance: 100 });
      mockApi.get.mockRejectedValueOnce(new Error('Not found'));

      await useWalletStore.getState().fetchWallet();

      expect(useWalletStore.getState().balance).toBe(100);
    });
  });

  describe('fetchTransactions', () => {
    it('calls api.get /payments/history and sets transactions', async () => {
      const transactions = [
        { id: 't1', type: 'TOPUP', amount: 50, description: 'Pix top-up', status: 'COMPLETED', createdAt: '2025-01-01' },
        { id: 't2', type: 'SONG_PLAY', amount: -5, description: 'Song play', status: 'COMPLETED', createdAt: '2025-01-02' },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { data: { transactions } } });

      await useWalletStore.getState().fetchTransactions();

      expect(mockApi.get).toHaveBeenCalledWith('/payments/history');
      expect(useWalletStore.getState().transactions).toEqual(transactions);
    });

    it('sets isLoading true during fetch and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.get.mockReturnValueOnce(pending);

      const fetchPromise = useWalletStore.getState().fetchTransactions();
      expect(useWalletStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { transactions: [] } } });
      await fetchPromise;
      expect(useWalletStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(useWalletStore.getState().fetchTransactions()).rejects.toThrow('Network error');
      expect(useWalletStore.getState().isLoading).toBe(false);
    });
  });

  describe('generatePixQr', () => {
    it('calls api.post /payments/wallet/topup with amount and sets pixQrCode and pixPaymentId', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { data: { qrCode: 'pix-qr-data-here', transactionId: 'txn-123' } },
      });

      await useWalletStore.getState().generatePixQr(25);

      expect(mockApi.post).toHaveBeenCalledWith('/payments/wallet/topup', { amount: 25 });
      expect(useWalletStore.getState().pixQrCode).toBe('pix-qr-data-here');
      expect(useWalletStore.getState().pixPaymentId).toBe('txn-123');
    });

    it('sets isLoading true during request and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.post.mockReturnValueOnce(pending);

      const fetchPromise = useWalletStore.getState().generatePixQr(10);
      expect(useWalletStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { qrCode: 'qr', transactionId: 'id' } } });
      await fetchPromise;
      expect(useWalletStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Payment error'));

      await expect(useWalletStore.getState().generatePixQr(10)).rejects.toThrow('Payment error');
      expect(useWalletStore.getState().isLoading).toBe(false);
    });
  });

  describe('topUpWithCard', () => {
    it('calls api.post /payments/wallet/topup with amount and CREDIT_CARD method, sets cardClientSecret', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { data: { clientSecret: 'stripe-secret-123' } },
      });

      await useWalletStore.getState().topUpWithCard(50);

      expect(mockApi.post).toHaveBeenCalledWith('/payments/wallet/topup', {
        amount: 50,
        paymentMethod: 'CREDIT_CARD',
      });
      expect(useWalletStore.getState().cardClientSecret).toBe('stripe-secret-123');
    });

    it('sets cardClientSecret to null when clientSecret is missing from response', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

      await useWalletStore.getState().topUpWithCard(50);

      expect(useWalletStore.getState().cardClientSecret).toBeNull();
    });

    it('sets isLoading true during request and false after', async () => {
      let resolvePromise: (v: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockApi.post.mockReturnValueOnce(pending);

      const fetchPromise = useWalletStore.getState().topUpWithCard(30);
      expect(useWalletStore.getState().isLoading).toBe(true);

      resolvePromise!({ data: { data: { clientSecret: 'secret' } } });
      await fetchPromise;
      expect(useWalletStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading false even when API throws', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Stripe error'));

      await expect(useWalletStore.getState().topUpWithCard(10)).rejects.toThrow('Stripe error');
      expect(useWalletStore.getState().isLoading).toBe(false);
    });
  });

  describe('clearPix', () => {
    it('clears pixQrCode and pixPaymentId', () => {
      useWalletStore.setState({ pixQrCode: 'some-qr', pixPaymentId: 'some-id' });

      useWalletStore.getState().clearPix();

      expect(useWalletStore.getState().pixQrCode).toBeNull();
      expect(useWalletStore.getState().pixPaymentId).toBeNull();
    });
  });

  describe('clearCard', () => {
    it('clears cardClientSecret', () => {
      useWalletStore.setState({ cardClientSecret: 'secret-123' });

      useWalletStore.getState().clearCard();

      expect(useWalletStore.getState().cardClientSecret).toBeNull();
    });
  });
});
