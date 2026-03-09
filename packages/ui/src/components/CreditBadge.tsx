import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export interface CreditBadgeProps {
  balance: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CreditBadge: React.FC<CreditBadgeProps> = ({
  balance,
  currency = 'R$',
  size = 'md',
  className,
}) => {
  const [displayBalance, setDisplayBalance] = useState(balance);

  useEffect(() => {
    // Animate counter
    const diff = balance - displayBalance;
    if (diff === 0) return;

    const steps = 20;
    const increment = diff / steps;
    let current = displayBalance;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        current = balance;
        clearInterval(interval);
      }
      setDisplayBalance(parseFloat(current.toFixed(2)));
    }, 30);

    return () => clearInterval(interval);
  }, [balance]);

  const sizeClasses = {
    sm: 'text-lg px-3 py-1',
    md: 'text-2xl px-4 py-2',
    lg: 'text-4xl px-6 py-3',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={balance}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        className={clsx(
          'inline-flex items-center gap-1 rounded-full font-bold',
          'bg-[#00FF00]/10 border border-[#00FF00]/30',
          'text-[#00FF00]',
          'shadow-[0_0_15px_rgba(0,255,0,0.2)]',
          sizeClasses[size],
          className,
        )}
      >
        <span className="text-[#00FF00]/70 text-[0.6em]">{currency}</span>
        <span>{displayBalance.toFixed(2)}</span>
      </motion.div>
    </AnimatePresence>
  );
};
