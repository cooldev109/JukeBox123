import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@jukebox/ui';
import { useAffiliateStore } from '../../stores/affiliateStore';

const formatCurrency = (value: number) =>
  `R$ ${value.toFixed(2).replace('.', ',')}`;

export const AffiliateDashboardPage: React.FC = () => {
  const { summary, revenueData, isLoading, fetchSummary, fetchRevenue } =
    useAffiliateStore();

  useEffect(() => {
    fetchSummary();
    fetchRevenue();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        Affiliate Dashboard
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))}
        </div>
      ) : !summary ? (
        <Card className="p-8 text-center">
          <p className="text-jb-text-secondary">No data available yet.</p>
          <p className="text-jb-text-secondary/60 text-sm mt-1">
            Share your referral link with venue owners to start earning
            commissions.
          </p>
        </Card>
      ) : (
        <>
          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card glowColor="pink" className="p-5 text-center">
                <p className="text-jb-text-secondary text-xs mb-1">Today</p>
                <p className="text-2xl font-bold text-jb-highlight-pink">
                  {formatCurrency(summary.daily.amount)}
                </p>
                <p className="text-jb-text-secondary text-xs mt-1">
                  {summary.daily.count} commission
                  {summary.daily.count !== 1 ? 's' : ''}
                </p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card glowColor="purple" className="p-5 text-center">
                <p className="text-jb-text-secondary text-xs mb-1">
                  This Month
                </p>
                <p className="text-2xl font-bold text-jb-accent-purple">
                  {formatCurrency(summary.monthly.amount)}
                </p>
                <p className="text-jb-text-secondary text-xs mt-1">
                  {summary.monthly.count} commission
                  {summary.monthly.count !== 1 ? 's' : ''}
                </p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card glowColor="green" className="p-5 text-center">
                <p className="text-jb-text-secondary text-xs mb-1">
                  This Year
                </p>
                <p className="text-2xl font-bold text-jb-accent-green">
                  {formatCurrency(summary.yearly.amount)}
                </p>
                <p className="text-jb-text-secondary text-xs mt-1">
                  {summary.yearly.count} commission
                  {summary.yearly.count !== 1 ? 's' : ''}
                </p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-5 text-center">
                <p className="text-jb-text-secondary text-xs mb-1">All Time</p>
                <p className="text-2xl font-bold text-jb-text-primary">
                  {formatCurrency(summary.total.amount)}
                </p>
                <p className="text-jb-text-secondary text-xs mt-1">
                  {summary.total.count} commission
                  {summary.total.count !== 1 ? 's' : ''}
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Bottom row: Active Referrals + Revenue Splits */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card glowColor="pink" className="p-5">
                <p className="text-jb-text-secondary text-xs mb-1">
                  Active Referrals
                </p>
                <p className="text-3xl font-bold text-jb-highlight-pink">
                  {summary.activeReferrals}
                </p>
                <p className="text-jb-text-secondary text-xs mt-1">
                  venue{summary.activeReferrals !== 1 ? 's' : ''} generating
                  commissions
                </p>
              </Card>
            </motion.div>

            {revenueData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card glowColor="green" className="p-5">
                  <p className="text-jb-text-secondary text-xs mb-1">
                    Revenue Splits
                  </p>
                  <p className="text-3xl font-bold text-jb-accent-green">
                    {formatCurrency(revenueData.totalEarned)}
                  </p>
                  <p className="text-jb-text-secondary text-xs mt-1">
                    from {revenueData.splitCount} transaction
                    {revenueData.splitCount !== 1 ? 's' : ''}
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
