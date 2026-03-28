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
    pixPayment: null,
    pixStatus: 'idle',
    cardClientSecret: null,
    isSandbox: false,
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
        { id: 't1', type: 'CREDIT_PURCHASE', amount: 50, status: 'COMPLETED', createdAt: '2025-01-01' },
        { id: 't2', type: 'SONG_PAYMENT', amount: 5, status: 'COMPLETED', createdAt: '2025-01-02' },
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

  describe('generatePixTopUp', () => {
    it('calls api.post /payments/wallet/topup and sets pixPayment', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          data: {
            transactionId: 'txn-123',
            pixCopiaECola: 'pix-copy-paste-code',
            qrCodeBase64: 'data:image/png;base64,abc',
            amount: 25,
            expiresAt: '2025-01-01T00:05:00Z',
          },
        },
      });

      await useWalletStore.getState().generatePixTopUp(25);

      expect(mockApi.post).toHaveBeenCalledWith('/payments/wallet/topup', { amount: 25 });
      const state = useWalletStore.getState();
      expect(state.pixPayment?.transactionId).toBe('txn-123');
      expect(state.pixPayment?.pixCopiaECola).toBe('pix-copy-paste-code');
      expect(state.pixPayment?.qrCodeBase64).toBe('data:image/png;base64,abc');
      expect(state.pixStatus).toBe('pending');
    });

    it('sets pixStatus to failed on API error', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Payment error'));

      await expect(useWalletStore.getState().generatePixTopUp(10)).rejects.toThrow();
      expect(useWalletStore.getState().pixStatus).toBe('failed');
    });
  });

  describe('pollPixStatus', () => {
    it('returns COMPLETED and updates balance when payment succeeds', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { data: { status: 'COMPLETED', walletBalance: 75 } },
      });

      const result = await useWalletStore.getState().pollPixStatus('txn-123');

      expect(mockApi.get).toHaveBeenCalledWith('/payments/pix/txn-123/status');
      expect(result).toBe('COMPLETED');
      expect(useWalletStore.getState().pixStatus).toBe('completed');
      expect(useWalletStore.getState().balance).toBe(75);
    });

    it('returns PENDING when still waiting', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { data: { status: 'PENDING' } },
      });

      const result = await useWalletStore.getState().pollPixStatus('txn-123');
      expect(result).toBe('PENDING');
    });
  });

  describe('topUpWithCard', () => {
    it('calls api.post with CREDIT_CARD method and sets cardClientSecret', async () => {
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
  });

  describe('clearPix', () => {
    it('clears pixPayment and resets pixStatus', () => {
      useWalletStore.setState({
        pixPayment: { transactionId: 'x', pixCopiaECola: 'y', qrCodeBase64: 'z', amount: 10, expiresAt: '' },
        pixStatus: 'pending',
      });

      useWalletStore.getState().clearPix();

      expect(useWalletStore.getState().pixPayment).toBeNull();
      expect(useWalletStore.getState().pixStatus).toBe('idle');
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
