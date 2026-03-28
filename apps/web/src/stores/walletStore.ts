import { create } from 'zustand';
import { api } from '../lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  machine?: { id: string; name: string } | null;
}

interface PixPaymentData {
  transactionId: string;
  pixCopiaECola: string;
  qrCodeBase64: string;
  amount: number;
  expiresAt: string;
}

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  // Pix payment state
  pixPayment: PixPaymentData | null;
  pixStatus: 'idle' | 'pending' | 'completed' | 'failed' | 'expired';
  // Card state
  cardClientSecret: string | null;
  // Sandbox mode
  isSandbox: boolean;

  fetchWallet: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  generatePixTopUp: (amount: number) => Promise<void>;
  generatePixForSong: (amount: number, machineId: string, songId: string, type: 'SONG_PAYMENT' | 'SKIP_QUEUE') => Promise<PixPaymentData>;
  pollPixStatus: (transactionId: string) => Promise<'PENDING' | 'COMPLETED' | 'FAILED'>;
  simulatePixPayment: (transactionId: string) => Promise<void>;
  spendFromWallet: (amount: number, type: string, machineId: string, songId: string, isPriority: boolean) => Promise<{ queueItemId?: string }>;
  topUpWithCard: (amount: number) => Promise<void>;
  checkProvider: () => Promise<void>;
  clearPix: () => void;
  clearCard: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  transactions: [],
  isLoading: false,
  pixPayment: null,
  pixStatus: 'idle',
  cardClientSecret: null,
  isSandbox: false,

  fetchWallet: async () => {
    try {
      const { data } = await api.get('/payments/wallet');
      set({ balance: data.data?.balance ?? 0 });
    } catch {
      // Wallet may not exist yet
    }
  },

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/payments/history');
      set({ transactions: data.data?.transactions || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  generatePixTopUp: async (amount) => {
    set({ isLoading: true, pixStatus: 'pending' });
    try {
      const { data } = await api.post('/payments/wallet/topup', { amount });
      const pixData: PixPaymentData = {
        transactionId: data.data.transactionId,
        pixCopiaECola: data.data.pixCopiaECola,
        qrCodeBase64: data.data.qrCodeBase64,
        amount: data.data.amount,
        expiresAt: data.data.expiresAt,
      };
      set({ pixPayment: pixData, pixStatus: 'pending' });
    } catch {
      set({ pixStatus: 'failed' });
      throw new Error('Failed to generate Pix payment');
    } finally {
      set({ isLoading: false });
    }
  },

  generatePixForSong: async (amount, machineId, songId, type) => {
    const { data } = await api.post('/payments/pix', {
      amount,
      type,
      machineId,
      songId,
    });
    const pixData: PixPaymentData = {
      transactionId: data.data.transactionId,
      pixCopiaECola: data.data.pixCopiaECola,
      qrCodeBase64: data.data.qrCodeBase64,
      amount: data.data.amount,
      expiresAt: data.data.expiresAt,
    };
    set({ pixPayment: pixData, pixStatus: 'pending' });
    return pixData;
  },

  pollPixStatus: async (transactionId) => {
    const { data } = await api.get(`/payments/pix/${transactionId}/status`);
    const status = data.data?.status;

    if (status === 'COMPLETED') {
      set({
        pixStatus: 'completed',
        balance: data.data.walletBalance ?? get().balance,
      });
      return 'COMPLETED';
    } else if (status === 'FAILED') {
      set({ pixStatus: 'failed' });
      return 'FAILED';
    }
    return 'PENDING';
  },

  simulatePixPayment: async (transactionId) => {
    const { data } = await api.post('/payments/pix/simulate', { transactionId });
    set({
      pixStatus: 'completed',
      balance: data.data.walletBalance ?? get().balance,
    });
  },

  spendFromWallet: async (amount, type, machineId, songId, isPriority) => {
    const { data } = await api.post('/payments/wallet/spend', {
      amount,
      type,
      machineId,
      songId,
      isPriority,
    });
    set({ balance: data.data.walletBalance ?? get().balance });
    return { queueItemId: data.data.queueItemId };
  },

  topUpWithCard: async (amount) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/payments/wallet/topup', {
        amount,
        paymentMethod: 'CREDIT_CARD',
      });
      set({ cardClientSecret: data.data.clientSecret || null });
    } finally {
      set({ isLoading: false });
    }
  },

  checkProvider: async () => {
    try {
      const { data } = await api.get('/payments/pix/provider');
      set({ isSandbox: data.data?.isSandbox ?? false });
    } catch {
      // ignore
    }
  },

  clearPix: () => set({ pixPayment: null, pixStatus: 'idle' }),
  clearCard: () => set({ cardClientSecret: null }),
}));
