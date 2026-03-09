import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  rounded = 'md',
  className,
}) => {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={clsx(
        'animate-shimmer bg-gradient-to-r from-[#1A1A2E] via-[#16213E] to-[#1A1A2E]',
        'bg-[length:400%_100%]',
        roundedClasses[rounded],
        className,
      )}
      style={{ width, height }}
    />
  );
};

export const SongCardSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A2E]/50 border border-white/5">
    <Skeleton width="56px" height="56px" rounded="lg" />
    <div className="flex-1 space-y-2">
      <Skeleton width="70%" height="14px" />
      <Skeleton width="50%" height="12px" />
      <Skeleton width="30%" height="10px" />
    </div>
    <Skeleton width="48px" height="24px" rounded="full" />
  </div>
);
