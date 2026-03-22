import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../stores/notificationStore';

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-500',
  HIGH: 'text-jb-highlight-pink',
  MEDIUM: 'text-amber-400',
  LOW: 'text-jb-accent-green',
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const NotificationBell: React.FC = () => {
  const { alerts, unreadCount, fetchAlerts, resolveAlert, markAllRead, fetchVapidKey, subscribe, isSubscribed } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVapidKey();
    fetchAlerts();
    // Poll every 60 seconds
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-subscribe on first load
  useEffect(() => {
    if (!isSubscribed && 'Notification' in window) {
      subscribe();
    }
  }, [isSubscribed]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-jb-text-secondary hover:text-jb-text-primary transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-10 w-80 bg-jb-bg-secondary border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-jb-text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-jb-accent-green hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-jb-text-secondary text-sm text-center py-8">No notifications</p>
              ) : (
                alerts.slice(0, 20).map((alert) => (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 border-b border-white/5 ${
                      !alert.isResolved ? 'bg-white/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-bold mt-0.5 ${severityColors[alert.severity] || 'text-jb-text-secondary'}`}>
                        {alert.severity === 'CRITICAL' ? '\u26A0\uFE0F' : alert.severity === 'HIGH' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-jb-text-primary truncate">{alert.message}</p>
                        <p className="text-xs text-jb-text-secondary mt-0.5">
                          {alert.machine.name} — {timeAgo(alert.createdAt)}
                        </p>
                      </div>
                      {!alert.isResolved && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="text-xs text-jb-accent-green hover:underline whitespace-nowrap"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
