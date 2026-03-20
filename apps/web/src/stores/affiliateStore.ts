import { create } from 'zustand';
import { api } from '../lib/api';

interface CommissionSummary {
  totalEarnings: number;
  pendingAmount: number;
  paidAmount: number;
  todayEarnings: number;
}

interface Commission {
  id: string;
  amount: number;
  type: string;
  status: string;
  venueName: string;
  createdAt: string;
}

interface Referral {
  id: string;
  venueName: string;
  city: string;
  state: string;
  isActive: boolean;
  totalEarnings: number;
}

interface EarningsPeriod {
  amount: number;
  count: number;
}

interface AffiliateSummary {
  daily: EarningsPeriod;
  monthly: EarningsPeriod;
  yearly: EarningsPeriod;
  total: EarningsPeriod;
  activeReferrals: number;
}

interface QRData {
  referralCode: string;
  qrData: string;
  shareUrl: string;
}

interface AffiliateState {
  summary: AffiliateSummary | null;
  commissions: Commission[];
  commissionSummary: CommissionSummary | null;
  referrals: Referral[];
  qrData: QRData | null;
  isLoading: boolean;
  fetchSummary: () => Promise<void>;
  fetchCommissions: () => Promise<void>;
  fetchReferrals: () => Promise<void>;
  fetchQRData: () => Promise<void>;
}

export const useAffiliateStore = create<AffiliateState>((set) => ({
  summary: null,
  commissions: [],
  commissionSummary: null,
  referrals: [],
  qrData: null,
  isLoading: false,

  fetchSummary: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/affiliates/me/summary');
      set({ summary: data.data || data });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCommissions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/affiliates/me/commissions');
      const result = data.data || data;
      set({
        commissions: result.commissions || [],
        commissionSummary: result.summary || null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchReferrals: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/affiliates/me/referrals');
      const result = data.data || data;
      set({ referrals: result.referrals || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchQRData: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/affiliates/me/qr');
      set({ qrData: data.data || data });
    } finally {
      set({ isLoading: false });
    }
  },
}));
