import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAffiliateStore } from '../stores/affiliateStore';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/affiliate', icon: '\u{1F4B0}' },
  { id: 'commissions', label: 'Commissions', path: '/affiliate/commissions', icon: '\u{1F4CA}' },
  { id: 'referrals', label: 'Referrals', path: '/affiliate/referrals', icon: '\u{1F91D}' },
  { id: 'qr', label: 'QR Code', path: '/affiliate/qr', icon: '\u{1F4F1}' },
];

export const AffiliateLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { qrData, fetchQRData } = useAffiliateStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    } else if (user && user.role !== 'AFFILIATE' && user.role !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchQRData();
    }
  }, [isAuthenticated, user]);

  const getActiveId = () => {
    const path = location.pathname;
    if (path === '/affiliate') return 'dashboard';
    const match = menuItems.find(
      (item) => item.path !== '/affiliate' && path.startsWith(item.path),
    );
    return match?.id || 'dashboard';
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-jb-bg-primary border-r border-white/10 flex-shrink-0 hidden desktop:flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-2xl font-bold text-jb-highlight-pink neon-text-pink">
            JukeBox
          </h1>
          <p className="text-jb-text-secondary text-xs mt-1">Affiliate Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                getActiveId() === item.id
                  ? 'bg-jb-bg-secondary text-jb-highlight-pink shadow-glow-pink'
                  : 'text-jb-text-secondary hover:bg-jb-bg-secondary/50 hover:text-jb-text-primary'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          {qrData?.referralCode && (
            <div className="mb-2 px-2 py-1.5 bg-white/5 rounded-lg">
              <p className="text-jb-text-secondary text-[10px] uppercase tracking-wider">Referral Code</p>
              <p className="text-jb-highlight-pink font-mono font-bold text-sm">{qrData.referralCode}</p>
            </div>
          )}
          <p className="text-jb-text-secondary text-xs truncate">{user?.name}</p>
          <p className="text-jb-text-secondary/60 text-[10px] truncate">
            {user?.email}
          </p>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-jb-highlight-pink hover:bg-white/5 transition-all"
          >
            <span>{'\u{1F6AA}'}</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="desktop:hidden fixed top-0 left-0 right-0 z-40 bg-jb-bg-primary/95 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-jb-highlight-pink">JukeBox Affiliate</h1>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="text-jb-highlight-pink text-xs hover:underline"
          >
            Logout
          </button>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                getActiveId() === item.id
                  ? 'bg-jb-highlight-pink text-jb-bg-primary'
                  : 'bg-white/5 text-jb-text-secondary'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto desktop:p-6 p-4 pt-28 desktop:pt-6">
        <Outlet />
      </main>
    </div>
  );
};
