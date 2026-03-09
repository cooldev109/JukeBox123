import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#00FF00] text-[#0F0F0F] hover:shadow-[0_0_30px_rgba(0,255,0,0.5)] active:bg-[#00CC00]',
  secondary:
    'bg-[#9B00FF] text-[#F5F5F5] hover:shadow-[0_0_30px_rgba(155,0,255,0.5)] active:bg-[#7D00CC]',
  danger:
    'bg-[#FF0080] text-[#F5F5F5] hover:shadow-[0_0_30px_rgba(255,0,128,0.5)] active:bg-[#CC0066]',
  ghost:
    'bg-transparent border border-[#F5F5F5]/20 text-[#F5F5F5] hover:border-[#00FF00]/50 hover:shadow-[0_0_15px_rgba(0,255,0,0.2)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-5 py-2.5 text-base rounded-lg',
  lg: 'px-7 py-3.5 text-lg rounded-xl',
  xl: 'px-10 py-5 text-xl rounded-2xl', // TV size
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        'font-semibold transition-all duration-200 cursor-pointer select-none',
        'focus:outline-none focus:ring-2 focus:ring-[#00FF00]/50 focus:ring-offset-2 focus:ring-offset-[#0F0F0F]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
};
