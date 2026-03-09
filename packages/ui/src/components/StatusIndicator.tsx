import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export type StatusType = 'online' | 'error' | 'offline';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<StatusType, { color: string; glow: string; label: string }> = {
  online: { color: 'bg-[#00FF00]', glow: 'rgba(0,255,0,0.5)', label: 'Online' },
  error: { color: 'bg-red-500', glow: 'rgba(239,68,68,0.5)', label: 'Error' },
  offline: { color: 'bg-blue-500', glow: 'rgba(59,130,246,0.5)', label: 'Offline' },
};

const sizeMap = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  className,
}) => {
  const config = statusConfig[status];

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <motion.div
        animate={{
          boxShadow: [
            `0 0 0px ${config.glow}`,
            `0 0 12px ${config.glow}`,
            `0 0 0px ${config.glow}`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={clsx('rounded-full', config.color, sizeMap[size])}
      />
      {(label || label === undefined) && (
        <span className="text-sm text-[#B0B0B0]">{label ?? config.label}</span>
      )}
    </div>
  );
};
