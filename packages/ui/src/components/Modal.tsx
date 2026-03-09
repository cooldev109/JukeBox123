import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={clsx(
              'fixed inset-0 z-50 flex items-center justify-center p-4',
              'pointer-events-none',
            )}
          >
            <div
              className={clsx(
                'pointer-events-auto w-full rounded-2xl overflow-hidden',
                'bg-gradient-to-br from-[#1A1A2E] to-[#0F0F0F]',
                'border border-white/10',
                'shadow-[0_0_40px_rgba(155,0,255,0.2)]',
                sizeClasses[size],
              )}
            >
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                  <h2 className="text-xl font-bold text-[#F5F5F5]">{title}</h2>
                  <button
                    onClick={onClose}
                    className="text-[#B0B0B0] hover:text-[#F5F5F5] transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="p-6">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
