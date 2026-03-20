import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';
import { useWalletStore } from '../stores/walletStore';
import { connectSocket, joinMachine } from '../lib/socket';

// SVG icons as components
const SearchIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const QueueIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);
const WalletIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);
const ProfileIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const CustomerLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const { machineId, listenToUpdates, stopListening } = useQueueStore();
  const { fetchWallet } = useWalletStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchWallet();
    }
  }, [isAuthenticated, user]);

  // Socket connection and machine room
  useEffect(() => {
    if (machineId) {
      const socket = connectSocket();
      joinMachine(machineId);
      listenToUpdates(machineId);

      return () => {
        stopListening();
      };
    }
  }, [machineId]);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/browse')) return 'browse';
    if (path.startsWith('/queue')) return 'queue';
    if (path.startsWith('/wallet')) return 'wallet';
    if (path.startsWith('/profile') || path.startsWith('/history')) return 'profile';
    return 'browse';
  };

  const navItems = [
    { id: 'browse', label: 'Browse', icon: <SearchIcon />, onClick: () => navigate('/browse') },
    { id: 'queue', label: 'Queue', icon: <QueueIcon />, onClick: () => navigate('/queue') },
    { id: 'wallet', label: 'Wallet', icon: <WalletIcon />, onClick: () => navigate('/wallet') },
    { id: 'profile', label: 'Profile', icon: <ProfileIcon />, onClick: () => navigate('/profile') },
  ];

  return (
    <div className="min-h-screen bg-jb-bg-primary">
      <Outlet />
      <Navbar items={navItems} activeId={getActiveTab()} variant="bottom" />
    </div>
  );
};
