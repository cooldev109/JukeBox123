import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@jukebox/ui';
import { useAffiliateStore } from '../../stores/affiliateStore';

const formatCurrency = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AffiliateCommissionsPage: React.FC = () => {
  const { commissions, commissionSummary, isLoading, fetchCommissions } = useAffiliateStore();

  useEffect(() => {
    fetchCommissions();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        Commissions
      </h2>

      {/* Summary Bar */}
      {commissionSummary && (
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 mb-6">
          <Card glowColor="green" className="p-4 text-center">
            <p className="text-jb-text-secondary text-xs mb-1">Total Earnings</p>
            <p className="text-xl font-bold text-jb-accent-green">
              {formatCurrency(commissionSummary.totalEarnings)}
            </p>
          </Card>
          <Card glowColor="purple" className="p-4 text-center">
            <p className="text-jb-text-secondary text-xs mb-1">Pending</p>
            <p className="text-xl font-bold text-jb-accent-purple">
              {formatCurrency(commissionSummary.pendingAmount)}
            </p>
          </Card>
          <Card glowColor="pink" className="p-4 text-center">
            <p className="text-jb-text-secondary text-xs mb-1">Paid</p>
            <p className="text-xl font-bold text-jb-highlight-pink">
              {formatCurrency(commissionSummary.paidAmount)}
            </p>
          </Card>
        </div>
      )}

      {/* Commission List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : commissions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-jb-text-secondary">No commissions yet</p>
          <p className="text-jb-text-secondary/60 text-sm mt-1">
            Share your referral link to start earning
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {commissions.map((commission, index) => (
            <motion.div
              key={commission.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-jb-highlight-pink">
                        {formatCurrency(commission.amount)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                          commission.status === 'PAID'
                            ? 'bg-jb-accent-green/20 text-jb-accent-green'
                            : 'bg-jb-accent-purple/20 text-jb-accent-purple'
                        }`}
                      >
                        {commission.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-jb-text-secondary">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          commission.type === 'SALE'
                            ? 'bg-jb-accent-green/10 text-jb-accent-green'
                            : 'bg-jb-highlight-pink/10 text-jb-highlight-pink'
                        }`}
                      >
                        {commission.type === 'SALE' ? 'Sale' : 'Venue Referral'}
                      </span>
                      <span>{commission.venueName}</span>
                      <span className="text-jb-text-secondary/60">
                        {formatDate(commission.createdAt)}
                      </span>
                    </div>
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
