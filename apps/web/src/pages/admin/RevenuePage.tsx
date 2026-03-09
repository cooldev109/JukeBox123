import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, Input } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

export const RevenuePage: React.FC = () => {
  const { revenue, isLoading, fetchRevenue } = useAdminStore();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleUnlock = () => {
    // Simple secondary password check — in production, validate server-side
    if (password === 'admin-revenue' || password === 'jukebox') {
      setUnlocked(true);
      setPasswordError('');
      fetchRevenue();
    } else {
      setPasswordError('Invalid password');
    }
  };

  if (!unlocked) {
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
            <Button variant="primary" fullWidth onClick={handleUnlock}>
              Unlock
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const formatCurrency = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2)}`;

  // Simple bar chart for revenue by venue
  const maxVenueRevenue = Math.max(
    ...(revenue?.byVenue.map((v) => v.amount) || [1]),
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Revenue</h2>

      {isLoading ? (
        <p className="text-jb-text-secondary">Loading...</p>
      ) : !revenue ? (
        <p className="text-jb-text-secondary">No revenue data</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 mb-8">
            <Card glowColor="green" className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Today</p>
              <p className="text-2xl font-bold text-jb-accent-green">
                {formatCurrency(revenue.today)}
              </p>
            </Card>
            <Card glowColor="purple" className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">This Month</p>
              <p className="text-2xl font-bold text-jb-accent-purple">
                {formatCurrency(revenue.thisMonth)}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">All Time</p>
              <p className="text-2xl font-bold text-jb-text-primary">
                {formatCurrency(revenue.total)}
              </p>
            </Card>
          </div>

          {/* Revenue by Venue */}
          <Card className="p-5 mb-6">
            <h3 className="text-lg font-bold text-jb-text-primary mb-4">
              Revenue by Venue
            </h3>
            {revenue.byVenue.length === 0 ? (
              <p className="text-jb-text-secondary text-sm">No data</p>
            ) : (
              <div className="space-y-3">
                {revenue.byVenue
                  .sort((a, b) => b.amount - a.amount)
                  .map((v) => (
                    <div key={v.venueName}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-jb-text-primary">
                          {v.venueName}
                        </span>
                        <span className="text-jb-accent-green">
                          {formatCurrency(v.amount)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(v.amount / maxVenueRevenue) * 100}%`,
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

          {/* Daily Chart */}
          {revenue.daily.length > 0 && (
            <Card className="p-5 mb-6">
              <h3 className="text-lg font-bold text-jb-text-primary mb-4">
                Daily Revenue
              </h3>
              <div className="flex items-end gap-1 h-40">
                {revenue.daily.slice(-30).map((day) => {
                  const maxDay = Math.max(
                    ...revenue.daily.map((d) => d.amount),
                  );
                  const height =
                    maxDay > 0 ? (day.amount / maxDay) * 100 : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center"
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5 }}
                        className="w-full bg-gradient-to-t from-jb-accent-purple to-jb-accent-green rounded-t-sm min-h-[2px]"
                        title={`${day.date}: ${formatCurrency(day.amount)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-jb-text-secondary text-[10px]">
                  {
                    revenue.daily[
                      Math.max(0, revenue.daily.length - 30)
                    ]?.date
                  }
                </span>
                <span className="text-jb-text-secondary text-[10px]">
                  {revenue.daily[revenue.daily.length - 1]?.date}
                </span>
              </div>
            </Card>
          )}

          {/* Export */}
          <Button
            variant="ghost"
            onClick={() => {
              const csv = ['Date,Amount']
                .concat(
                  revenue.daily.map(
                    (d) => `${d.date},${(d.amount / 100).toFixed(2)}`,
                  ),
                )
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'revenue.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
        </>
      )}
    </div>
  );
};
