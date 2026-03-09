import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';

const formatCurrency = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

export const OwnerRevenuePage: React.FC = () => {
  const { transactions, revenueToday, revenueMonth, revenueTotal, isLoading, fetchTransactions } = useBarOwnerStore();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const transactionIcon = (type: string) => {
    switch (type) {
      case 'CREDIT': return '💰';
      case 'TOPUP': return '➕';
      case 'DEBIT': return '🎵';
      default: return '📋';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Revenue</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 mb-8">
        <Card glowColor="green" className="p-5 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Today</p>
          <motion.p
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-2xl font-bold text-jb-accent-green"
          >
            {formatCurrency(revenueToday)}
          </motion.p>
        </Card>
        <Card glowColor="purple" className="p-5 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">This Month</p>
          <p className="text-2xl font-bold text-jb-accent-purple">{formatCurrency(revenueMonth)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">All Time</p>
          <p className="text-2xl font-bold text-jb-text-primary">{formatCurrency(revenueTotal)}</p>
        </Card>
      </div>

      {/* Transaction List */}
      <h3 className="text-lg font-bold text-jb-text-primary mb-3">Recent Transactions</h3>
      {isLoading ? (
        <p className="text-jb-text-secondary">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.slice(0, 50).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-jb-bg-secondary/50 border border-white/5"
            >
              <span className="text-xl">{transactionIcon(tx.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-jb-text-primary text-sm font-medium truncate">
                  {tx.description || tx.type}
                </p>
                <p className="text-jb-text-secondary text-xs">
                  {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`font-bold text-sm ${tx.type === 'DEBIT' ? 'text-jb-highlight-pink' : 'text-jb-accent-green'}`}>
                {tx.type === 'DEBIT' ? '-' : '+'}R$ {(Math.abs(tx.amount) / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
