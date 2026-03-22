import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@jukebox/ui';
import { useEmployeeStore } from '../../stores/employeeStore';

export const EmployeeEarningsPage: React.FC = () => {
  const { earnings, isLoading, fetchEarnings } = useEmployeeStore();

  useEffect(() => {
    fetchEarnings();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const transactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      PIX: 'Pix',
      CREDIT_CARD: 'Credit Card',
      SONG_PLAY: 'Song Play',
      SPECIAL_EVENT: 'Special Event',
    };
    return labels[type] || type;
  };

  if (isLoading && !earnings) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Earnings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Earnings</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 bg-gradient-to-br from-jb-accent-green/20 to-transparent border border-jb-accent-green/30">
            <p className="text-jb-text-secondary text-sm mb-1">Total Earned</p>
            <p className="text-3xl font-bold text-jb-accent-green neon-text-green">
              {formatCurrency(earnings?.totalEarned || 0)}
            </p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 bg-gradient-to-br from-jb-accent-purple/20 to-transparent border border-jb-accent-purple/30">
            <p className="text-jb-text-secondary text-sm mb-1">Total Splits</p>
            <p className="text-3xl font-bold text-jb-accent-purple">
              {earnings?.splitCount || 0}
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Splits List */}
      <h3 className="text-lg font-semibold text-jb-text-primary mb-4">Split History</h3>

      {!earnings?.splits?.length ? (
        <Card className="p-8 text-center border border-white/10">
          <p className="text-jb-text-secondary">No earnings recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {earnings.splits.map((split, index) => (
            <motion.div
              key={split.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4 border border-white/10 hover:border-jb-accent-green/30 transition-all duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-jb-accent-green font-bold text-lg">
                        {formatCurrency(split.amount)}
                      </span>
                      <span className="text-jb-text-secondary text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {split.percent}%
                      </span>
                    </div>
                    <p className="text-jb-text-secondary text-sm">
                      {transactionLabel(split.transactionType)} &middot;{' '}
                      Transaction: {formatCurrency(split.transactionAmount)}
                    </p>
                    <p className="text-jb-text-secondary/60 text-xs mt-1">
                      {split.venueName} &middot; {formatDate(split.date)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
