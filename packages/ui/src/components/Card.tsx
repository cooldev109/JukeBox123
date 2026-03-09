import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

export interface CardProps extends HTMLMotionProps<'div'> {
  hoverable?: boolean;
  glowColor?: 'green' | 'purple' | 'pink';
  imageUrl?: string;
  children: React.ReactNode;
}

const glowMap = {
  green: 'hover:shadow-[0_0_20px_rgba(0,255,0,0.3)]',
  purple: 'hover:shadow-[0_0_20px_rgba(155,0,255,0.3)]',
  pink: 'hover:shadow-[0_0_20px_rgba(255,0,128,0.3)]',
};

export const Card: React.FC<CardProps> = ({
  hoverable = true,
  glowColor = 'purple',
  imageUrl,
  children,
  className,
  ...props
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -4 } : undefined}
      transition={{ duration: 0.2 }}
      className={clsx(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-br from-[rgba(26,26,46,0.8)] to-[rgba(15,15,15,0.9)]',
        'backdrop-blur-xl border border-white/10',
        hoverable && glowMap[glowColor],
        'transition-shadow duration-300',
        className,
      )}
      {...props}
    >
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
