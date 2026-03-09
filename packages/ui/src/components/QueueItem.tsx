import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface QueueItemProps {
  position: number;
  title: string;
  artist: string;
  coverArtUrl?: string | null;
  isPriority?: boolean;
  isPlaying?: boolean;
  progress?: number; // 0-100
  estimatedWait?: string;
  className?: string;
}

export const QueueItemComponent: React.FC<QueueItemProps> = ({
  position,
  title,
  artist,
  coverArtUrl,
  isPriority = false,
  isPlaying = false,
  progress = 0,
  estimatedWait,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={clsx(
        'relative flex items-center gap-3 p-3 rounded-lg',
        'bg-[#1A1A2E]/50 border border-white/5',
        isPlaying && 'border-[#00FF00]/30 bg-[#00FF00]/5',
        isPriority && !isPlaying && 'border-[#FF0080]/30 bg-[#FF0080]/5',
        className,
      )}
    >
      {/* Position */}
      <div className={clsx(
        'w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm',
        isPlaying ? 'bg-[#00FF00] text-[#0F0F0F]' : 'bg-[#1A1A2E] text-[#00FF00]',
      )}>
        {isPlaying ? '▶' : position}
      </div>

      {/* Album Art */}
      <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[#16213E]">
        {coverArtUrl ? (
          <img src={coverArtUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-[#9B00FF]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[#F5F5F5] font-medium text-sm truncate">{title}</h4>
        <p className="text-[#B0B0B0] text-xs truncate">{artist}</p>
      </div>

      {/* Priority Badge */}
      {isPriority && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF0080]/20 text-[#FF0080] border border-[#FF0080]/30">
          VIP
        </span>
      )}

      {/* Wait Time */}
      {estimatedWait && !isPlaying && (
        <span className="text-xs text-[#B0B0B0]">{estimatedWait}</span>
      )}

      {/* Progress Bar (playing) */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A1A2E]">
          <motion.div
            className="h-full bg-[#00FF00]"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </motion.div>
  );
};
