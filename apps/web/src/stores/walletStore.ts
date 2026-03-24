import { create } from 'zustand';
import { api } from '../lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  createdAt: string;
}

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  pixQrCode: string | null;
  pixPaymentId: string | null;
  cardClientSecret: string | null;
  fetchWallet: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  generatePixQr: (amount: number) => Promise<void>;
  topUpWithCard: (amount: number) => Promise<void>;
  clearPix: () => void;
  clearCard: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  transactions: [],
  isLoading: false,
  pixQrCode: null,
  pixPaymentId: null,
  cardClientSecret: null,

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

  generatePixQr: async (amount) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/payments/wallet/topup', { amount });
      set({ pixQrCode: data.data.qrCode, pixPaymentId: data.data.transactionId });
    } finally {
      set({ isLoading: false });
    }
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

  clearPix: () => set({ pixQrCode: null, pixPaymentId: null }),
  clearCard: () => set({ cardClientSecret: null }),
}));
