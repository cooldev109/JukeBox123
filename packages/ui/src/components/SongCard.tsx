import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface SongCardProps {
  title: string;
  artist: string;
  coverArtUrl?: string | null;
  duration: string; // formatted MM:SS
  price?: string;
  isPlaying?: boolean;
  onClick?: () => void;
  className?: string;
}

export const SongCard: React.FC<SongCardProps> = ({
  title,
  artist,
  coverArtUrl,
  duration,
  price,
  isPlaying = false,
  onClick,
  className,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-xl cursor-pointer group',
        'bg-gradient-to-br from-[rgba(26,26,46,0.8)] to-[rgba(15,15,15,0.9)]',
        'backdrop-blur-xl border border-white/10',
        'hover:border-[#9B00FF]/50 hover:shadow-[0_0_20px_rgba(155,0,255,0.3)]',
        'transition-all duration-200',
        isPlaying && 'border-[#00FF00]/50 shadow-[0_0_20px_rgba(0,255,0,0.3)]',
        className,
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Album Art */}
        <div className="relative w-14 h-14 tv:w-20 tv:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#1A1A2E]">
          {coverArtUrl ? (
            <img src={coverArtUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#9B00FF]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex items-end gap-0.5 h-4">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-[#00FF00] rounded-full"
                    animate={{ height: ['40%', '100%', '40%'] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[#F5F5F5] font-semibold truncate text-sm tv:text-base">{title}</h3>
          <p className="text-[#B0B0B0] text-xs tv:text-sm truncate">{artist}</p>
          <p className="text-[#B0B0B0]/60 text-xs mt-0.5">{duration}</p>
        </div>

        {/* Price Badge */}
        {price && (
          <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[#00FF00]/10 border border-[#00FF00]/30">
            <span className="text-[#00FF00] text-xs font-bold">{price}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
