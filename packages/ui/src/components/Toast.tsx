import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose?: () => void;
}

const typeConfig: Record<ToastType, { border: string; icon: string }> = {
  success: { border: 'border-[#00FF00]/50', icon: '✓' },
  error: { border: 'border-[#FF0080]/50', icon: '✕' },
  info: { border: 'border-[#9B00FF]/50', icon: 'ℹ' },
  warning: { border: 'border-yellow-500/50', icon: '⚠' },
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', isVisible, onClose }) => {
  const config = typeConfig[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 100, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.3 }}
          className={clsx(
            'fixed top-4 right-4 z-[100] max-w-sm',
            'rounded-lg px-4 py-3',
            'bg-[#1A1A2E] backdrop-blur-xl',
            'border',
            config.border,
            'shadow-lg',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{config.icon}</span>
            <p className="text-sm text-[#F5F5F5] flex-1">{message}</p>
            {onClose && (
              <button
                onClick={onClose}
                className="text-[#B0B0B0] hover:text-[#F5F5F5] transition-colors ml-2"
              >
                ✕
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
