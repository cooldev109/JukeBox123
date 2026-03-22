import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';
import { api } from '../../lib/api';

interface RevenueData {
  total: number;
  venueCut: number;
  byType: Record<string, number>;
  transactionCount: number;
}

const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

const typeLabel = (type: string): string => {
  switch (type) {
    case 'SONG_PAYMENT': return 'Song Payments';
    case 'PRIORITY_PAYMENT': return 'Priority / VIP';
    case 'TOPUP': return 'Top-ups';
    case 'TIP': return 'Tips';
    default: return type.replace(/_/g, ' ');
  }
};

const typeIcon = (type: string): string => {
  switch (type) {
    case 'SONG_PAYMENT': return '🎵';
    case 'PRIORITY_PAYMENT': return '⭐';
    case 'TOPUP': return '💳';
    case 'TIP': return '💰';
    default: return '📋';
  }
};

export const OwnerRevenuePage: React.FC = () => {
  const { venue, fetchVenue } = useBarOwnerStore();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) {
      fetchVenue();
    }
  }, []);

  useEffect(() => {
    if (!venue?.id) return;

    const loadRevenue = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/revenue/venue/${venue.id}`);
        setRevenue(data.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load revenue data';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadRevenue();
  }, [venue?.id]);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Revenue</h2>
        <p className="text-jb-text-secondary text-center py-12">Loading revenue data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Revenue</h2>
        <Card className="p-6 text-center">
          <p className="text-jb-highlight-pink mb-2">Error loading revenue</p>
          <p className="text-jb-text-secondary text-sm">{error}</p>
        </Card>
      </div>
    );
  }

  const byTypeEntries = revenue ? Object.entries(revenue.byType).filter(([, val]) => val > 0) : [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Revenue</h2>

      {/* Primary Revenue Cards */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 mb-6">
        <Card glowColor="green" className="p-6 text-center">
          <p className="text-jb-text-secondary text-xs mb-1 uppercase tracking-wide">Your Cut</p>
          <motion.p
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-3xl font-bold text-jb-accent-green"
          >
            {formatCurrency(revenue?.venueCut ?? 0)}
          </motion.p>
          <p className="text-jb-text-secondary text-xs mt-1">Revenue after platform split</p>
        </Card>
        <Card glowColor="purple" className="p-6 text-center">
          <p className="text-jb-text-secondary text-xs mb-1 uppercase tracking-wide">Total Revenue</p>
          <motion.p
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-3xl font-bold text-jb-accent-purple"
          >
            {formatCurrency(revenue?.total ?? 0)}
          </motion.p>
          <p className="text-jb-text-secondary text-xs mt-1">Gross revenue before split</p>
        </Card>
      </div>

      {/* Transaction Count */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between">
          <p className="text-jb-text-secondary text-sm">Total Transactions</p>
          <p className="text-xl font-bold text-jb-text-primary">{revenue?.transactionCount ?? 0}</p>
        </div>
      </Card>

      {/* Revenue by Type */}
      <h3 className="text-lg font-bold text-jb-text-primary mb-3">Revenue by Type</h3>
      {byTypeEntries.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-jb-text-secondary">No revenue data yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {byTypeEntries.map(([type, amount]) => (
            <Card key={type} className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{typeIcon(type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-jb-text-primary text-sm font-medium">{typeLabel(type)}</p>
                </div>
                <span className="font-bold text-sm text-jb-accent-green">
                  {formatCurrency(amount)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
