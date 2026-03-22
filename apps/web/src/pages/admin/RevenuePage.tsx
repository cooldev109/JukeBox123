import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, Input } from '@jukebox/ui';
import { api } from '../../lib/api';

interface RevenueTotals {
  total: number;
  platform: number;
  venue: number;
  affiliate: number;
  operator: number;
}

interface VenueRevenue {
  name: string;
  total: number;
}

interface RevenueData {
  totals: RevenueTotals;
  byType: Record<string, number>;
  byVenue: VenueRevenue[];
  transactionCount: number;
}

interface Filters {
  startDate: string;
  endDate: string;
  type: string;
}

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'SONG_REQUEST', label: 'Song Request' },
  { value: 'PRIORITY', label: 'Priority' },
  { value: 'WALLET_TOPUP', label: 'Wallet Top-up' },
  { value: 'TIP', label: 'Tip' },
];

const formatCurrency = (amount: number) =>
  `R$ ${amount.toFixed(2)}`;

export const RevenuePage: React.FC = () => {
  // Auth state
  const [revenueToken, setRevenueToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Revenue data state
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filters, setFilters] = useState<Filters>({
    startDate: '',
    endDate: '',
    type: '',
  });

  const fetchRevenue = useCallback(async (token: string, params?: Filters) => {
    setIsLoading(true);
    setError('');
    try {
      const queryParams: Record<string, string> = {};
      const f = params || filters;
      if (f.startDate) queryParams.startDate = f.startDate;
      if (f.endDate) queryParams.endDate = f.endDate;
      if (f.type) queryParams.type = f.type;

      const { data } = await api.get('/revenue/admin', {
        headers: { 'x-revenue-token': token },
        params: queryParams,
      });
      setRevenue(data.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load revenue data';
      if (err.response?.status === 401) {
        setRevenueToken(null);
        setPasswordError('Session expired. Please re-enter password.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }
    setAuthLoading(true);
    setPasswordError('');
    try {
      const { data } = await api.post('/revenue/auth', { password });
      const token = data.data.revenueToken;
      setRevenueToken(token);
      setPassword('');
      await fetchRevenue(token);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Invalid password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleApplyFilters = () => {
    if (revenueToken) {
      fetchRevenue(revenueToken, filters);
    }
  };

  const handleExport = async () => {
    if (!revenueToken) return;
    try {
      const params: Record<string, string> = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/revenue/admin/export', {
        headers: { 'x-revenue-token': revenueToken },
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setRevenueToken(null);
        setPasswordError('Session expired. Please re-enter password.');
      }
    }
  };

  // ---- Password Screen ----
  if (!revenueToken) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-jb-text-primary mb-2">
            Revenue Access
          </h2>
          <p className="text-jb-text-secondary text-sm mb-6">
            Enter secondary password to view revenue data
          </p>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Secondary password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              error={passwordError}
              onKeyDown={(e: React.KeyboardEvent) =>
                e.key === 'Enter' && handleUnlock()
              }
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleUnlock}
              disabled={authLoading}
            >
              {authLoading ? 'Verifying...' : 'Unlock'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- Revenue Dashboard ----
  const maxVenueRevenue = Math.max(
    ...(revenue?.byVenue.map((v) => v.total) || [1]),
  );

  const typeEntries = revenue ? Object.entries(revenue.byType) : [];
  const maxTypeAmount = Math.max(...typeEntries.map(([, v]) => v), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-jb-text-primary">Revenue</h2>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-jb-text-secondary text-xs block mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFilters((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-jb-text-secondary text-xs block mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFilters((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-jb-text-secondary text-xs block mb-1">
              Type
            </label>
            <select
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-jb-text-primary text-sm focus:border-jb-accent-green focus:outline-none"
              value={filters.type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value }))
              }
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-jb-dark-bg">
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" size="sm" onClick={handleApplyFilters}>
            Apply
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-jb-text-secondary">Loading revenue data...</p>
      ) : error ? (
        <Card className="p-5 text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => fetchRevenue(revenueToken)}>
            Retry
          </Button>
        </Card>
      ) : !revenue ? (
        <p className="text-jb-text-secondary">No revenue data</p>
      ) : (
        <>
          {/* Transaction Count */}
          <p className="text-jb-text-secondary text-sm mb-4">
            {revenue.transactionCount} transaction{revenue.transactionCount !== 1 ? 's' : ''}
          </p>

          {/* Totals Cards */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-5 gap-4 mb-8">
            <Card glowColor="green" className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-jb-accent-green">
                {formatCurrency(revenue.totals.total)}
              </p>
            </Card>
            <Card glowColor="purple" className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Platform</p>
              <p className="text-xl font-bold text-jb-accent-purple">
                {formatCurrency(revenue.totals.platform)}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Venue</p>
              <p className="text-xl font-bold text-jb-text-primary">
                {formatCurrency(revenue.totals.venue)}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Affiliate</p>
              <p className="text-xl font-bold text-jb-text-primary">
                {formatCurrency(revenue.totals.affiliate)}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Operator</p>
              <p className="text-xl font-bold text-jb-text-primary">
                {formatCurrency(revenue.totals.operator)}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-6 mb-6">
            {/* Revenue by Venue */}
            <Card className="p-5">
              <h3 className="text-lg font-bold text-jb-text-primary mb-4">
                Revenue by Venue
              </h3>
              {revenue.byVenue.length === 0 ? (
                <p className="text-jb-text-secondary text-sm">No venue data</p>
              ) : (
                <div className="space-y-3">
                  {[...revenue.byVenue]
                    .sort((a, b) => b.total - a.total)
                    .map((v) => (
                      <div key={v.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-jb-text-primary truncate mr-2">
                            {v.name}
                          </span>
                          <span className="text-jb-accent-green whitespace-nowrap">
                            {formatCurrency(v.total)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(v.total / maxVenueRevenue) * 100}%`,
                            }}
                            transition={{ duration: 0.8 }}
                            className="h-full bg-gradient-to-r from-jb-accent-green to-jb-accent-purple rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>

            {/* Revenue by Type */}
            <Card className="p-5">
              <h3 className="text-lg font-bold text-jb-text-primary mb-4">
                Revenue by Type
              </h3>
              {typeEntries.length === 0 ? (
                <p className="text-jb-text-secondary text-sm">No type data</p>
              ) : (
                <div className="space-y-3">
                  {typeEntries
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-jb-text-primary">
                            {type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-jb-accent-purple whitespace-nowrap">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(amount / maxTypeAmount) * 100}%`,
                            }}
                            transition={{ duration: 0.8 }}
                            className="h-full bg-gradient-to-r from-jb-accent-purple to-jb-accent-pink rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
