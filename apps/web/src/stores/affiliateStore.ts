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
  percentage: number;
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
  commissionPercent: number;
  startDate: string;
  endDate: string;
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

interface RevenueSplit {
  id: string;
  amount: number;
  percent: number;
  transactionType: string;
  transactionAmount: number;
  venueName: string;
  date: string;
}

interface RevenueData {
  totalEarned: number;
  splitCount: number;
  splits: RevenueSplit[];
}

interface AffiliateState {
  summary: AffiliateSummary | null;
  commissions: Commission[];
  commissionSummary: CommissionSummary | null;
  referrals: Referral[];
  qrData: QRData | null;
  revenueData: RevenueData | null;
  isLoading: boolean;
  fetchSummary: () => Promise<void>;
  fetchCommissions: () => Promise<void>;
  fetchReferrals: () => Promise<void>;
  fetchQRData: () => Promise<void>;
  fetchRevenue: () => Promise<void>;
}

export const useAffiliateStore = create<AffiliateState>((set) => ({
  summary: null,
  commissions: [],
  commissionSummary: null,
  referrals: [],
  qrData: null,
  revenueData: null,
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
      // Map nested venue object to flat venueName for UI consumption
      const commissions = (result.commissions || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        amount: c.amount,
        percentage: c.percentage,
        type: c.type,
        status: c.status,
        venueName: (c.venue as Record<string, string>)?.name || 'Unknown',
        createdAt: c.createdAt,
      }));
      set({
        commissions,
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
      // Map nested venue object to flat fields for UI consumption
      const referrals = (result.referrals || []).map((r: Record<string, unknown>) => {
        const venue = (r.venue as Record<string, string>) || {};
        return {
          id: r.id,
          venueName: venue.name || 'Unknown',
          city: venue.city || '',
          state: venue.state || '',
          isActive: r.isActive,
          totalEarnings: r.totalEarnings ?? 0,
          commissionPercent: r.commissionPercent ?? 0,
          startDate: r.startDate,
          endDate: r.endDate,
        };
      });
      set({ referrals });
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

  fetchRevenue: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/revenue/affiliate');
      set({ revenueData: data.data || data });
    } finally {
      set({ isLoading: false });
    }
  },
}));
