import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { balance } = useWalletStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        {/* User Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card glowColor="purple" className="p-6 mb-6 text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-jb-accent-purple to-jb-highlight-pink mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-jb-text-primary">{user?.name || 'Guest'}</h2>
            {user?.email && <p className="text-jb-text-secondary text-sm mt-1">{user.email}</p>}
            {user?.phone && <p className="text-jb-text-secondary text-sm mt-1">{user.phone}</p>}
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4 text-center">
            <p className="text-jb-text-secondary text-xs mb-1">Balance</p>
            <p className="text-jb-accent-green font-bold text-lg">R$ {(balance / 100).toFixed(2)}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-jb-text-secondary text-xs mb-1">Role</p>
            <p className="text-jb-accent-purple font-bold text-lg capitalize">{user?.role?.toLowerCase() || 'Customer'}</p>
          </Card>
        </div>

        {/* Menu Items */}
        <div className="space-y-2 mb-8">
          <button
            onClick={() => navigate('/wallet')}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-jb-accent-purple/30 transition-all text-left"
          >
            <span className="text-xl">💰</span>
            <div className="flex-1">
              <p className="text-jb-text-primary font-medium">My Wallet</p>
              <p className="text-jb-text-secondary text-xs">Top up credits, view transactions</p>
            </div>
            <svg className="w-5 h-5 text-jb-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/history')}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-jb-accent-purple/30 transition-all text-left"
          >
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <p className="text-jb-text-primary font-medium">Song History</p>
              <p className="text-jb-text-secondary text-xs">Previously played songs</p>
            </div>
            <svg className="w-5 h-5 text-jb-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Logout */}
        <Button variant="danger" fullWidth onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
};
