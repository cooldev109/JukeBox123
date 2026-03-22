import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@jukebox/ui';
import { useAffiliateStore } from '../../stores/affiliateStore';

const formatCurrency = (value: number) =>
  `R$ ${value.toFixed(2).replace('.', ',')}`;

export const AffiliateReferralsPage: React.FC = () => {
  const { referrals, isLoading, fetchReferrals } = useAffiliateStore();

  useEffect(() => {
    fetchReferrals();
  }, []);

  const activeCount = referrals.filter((r) => r.isActive).length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-2">
        Referrals
      </h2>
      {!isLoading && referrals.length > 0 && (
        <p className="text-jb-text-secondary text-sm mb-6">
          {activeCount} active venue{activeCount !== 1 ? 's' : ''} out of{' '}
          {referrals.length} total
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-3 w-28 mb-3" />
              <Skeleton className="h-4 w-24" />
            </Card>
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-jb-text-secondary">No referrals yet</p>
          <p className="text-jb-text-secondary/60 text-sm mt-1">
            Share your referral link with venue owners to get started
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          {referrals.map((referral, index) => (
            <motion.div
              key={referral.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-jb-text-primary">
                    {referral.venueName}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                      referral.isActive
                        ? 'bg-jb-accent-green/20 text-jb-accent-green'
                        : 'bg-white/10 text-jb-text-secondary'
                    }`}
                  >
                    {referral.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-jb-text-secondary text-sm mb-1">
                  {referral.city}
                  {referral.city && referral.state ? ', ' : ''}
                  {referral.state}
                </p>
                {referral.commissionPercent > 0 && (
                  <p className="text-jb-text-secondary/60 text-xs mb-3">
                    Commission rate: {referral.commissionPercent}%
                  </p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-jb-text-secondary text-xs">
                    Total Earnings
                  </span>
                  <span className="text-jb-highlight-pink font-bold">
                    {formatCurrency(referral.totalEarnings)}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
