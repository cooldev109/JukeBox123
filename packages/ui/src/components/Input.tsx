import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[#B0B0B0] mb-1.5">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]">{icon}</div>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full bg-[#1A1A2E] border border-white/10 rounded-lg',
              'text-[#F5F5F5] placeholder:text-[#B0B0B0]/50',
              'px-4 py-3 text-base',
              'transition-all duration-200',
              'focus:outline-none focus:border-[#9B00FF] focus:shadow-[0_0_15px_rgba(155,0,255,0.3)]',
              icon && 'pl-10',
              error && 'border-[#FF0080] focus:border-[#FF0080] focus:shadow-[0_0_15px_rgba(255,0,128,0.3)]',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-[#FF0080]">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export interface SearchBarProps extends InputProps {
  onSearch?: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, ...props }) => {
  return (
    <Input
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      placeholder="Search songs, artists..."
      onChange={(e) => onSearch?.(e.target.value)}
      {...props}
    />
  );
};
