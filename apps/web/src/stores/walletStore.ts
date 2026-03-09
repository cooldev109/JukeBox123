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
  fetchWallet: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  generatePixQr: (amount: number) => Promise<void>;
  clearPix: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  transactions: [],
  isLoading: false,
  pixQrCode: null,
  pixPaymentId: null,

  fetchWallet: async () => {
    try {
      const { data } = await api.get('/payments/wallet');
      set({ balance: data.data.balance });
    } catch {
      // Wallet may not exist yet
    }
  },

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/payments/history');
      set({ transactions: data.data.transactions });
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

  clearPix: () => set({ pixQrCode: null, pixPaymentId: null }),
}));
