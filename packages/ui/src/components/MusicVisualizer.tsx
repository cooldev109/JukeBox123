import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface MusicVisualizerProps {
  isPlaying?: boolean;
  barCount?: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { height: 16, barWidth: 2, gap: 1 },
  md: { height: 24, barWidth: 3, gap: 2 },
  lg: { height: 40, barWidth: 4, gap: 3 },
};

export const MusicVisualizer: React.FC<MusicVisualizerProps> = ({
  isPlaying = true,
  barCount = 5,
  color = '#00FF00',
  size = 'md',
  className,
}) => {
  const config = sizeConfig[size];

  return (
    <div
      className={clsx('flex items-end', className)}
      style={{ height: config.height, gap: config.gap }}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: config.barWidth,
            backgroundColor: color,
            opacity: 0.8,
          }}
          animate={
            isPlaying
              ? {
                  height: [
                    config.height * 0.3,
                    config.height * (0.5 + Math.random() * 0.5),
                    config.height * 0.2,
                    config.height * (0.4 + Math.random() * 0.6),
                    config.height * 0.3,
                  ],
                }
              : { height: config.height * 0.15 }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.8 + Math.random() * 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.1,
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
};
