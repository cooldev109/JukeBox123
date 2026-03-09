import React from 'react';
import { clsx } from 'clsx';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface NavbarProps {
  items: NavItem[];
  activeId?: string;
  variant?: 'bottom' | 'sidebar';
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  items,
  activeId,
  variant = 'bottom',
  className,
}) => {
  if (variant === 'sidebar') {
    return (
      <nav
        className={clsx(
          'flex flex-col gap-1 p-3 w-64',
          'bg-[#0F0F0F] border-r border-white/10',
          'h-full',
          className,
        )}
      >
        {/* Logo */}
        <div className="px-3 py-4 mb-4">
          <h1
            className="text-2xl font-bold text-[#00FF00]"
            style={{ textShadow: '0 0 15px rgba(0,255,0,0.4)' }}
          >
            JukeBox
          </h1>
        </div>

        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-lg',
              'text-left transition-all duration-200',
              'hover:bg-[#1A1A2E] focus:outline-none',
              activeId === item.id
                ? 'bg-[#1A1A2E] text-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.15)]'
                : 'text-[#B0B0B0] hover:text-[#F5F5F5]',
            )}
          >
            <span className="w-6 h-6 flex items-center justify-center">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  // Bottom tab bar (mobile)
  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0',
        'flex items-center justify-around',
        'px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
        'bg-[#0F0F0F]/95 backdrop-blur-xl border-t border-white/10',
        'z-40',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={clsx(
            'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg',
            'transition-all duration-200 min-w-[60px]',
            'focus:outline-none',
            activeId === item.id
              ? 'text-[#00FF00]'
              : 'text-[#B0B0B0] hover:text-[#F5F5F5]',
          )}
        >
          <span className="w-6 h-6 flex items-center justify-center">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
          {activeId === item.id && (
            <div className="w-1 h-1 rounded-full bg-[#00FF00] shadow-[0_0_8px_rgba(0,255,0,0.5)]" />
          )}
        </button>
      ))}
    </nav>
  );
};
