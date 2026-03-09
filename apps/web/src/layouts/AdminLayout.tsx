import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const menuItems = [
  { id: 'overview', label: 'Machines', path: '/admin', icon: '\u{1F4E1}' },
  { id: 'venues', label: 'Venues', path: '/admin/venues', icon: '\u{1F3E2}' },
  { id: 'revenue', label: 'Revenue', path: '/admin/revenue', icon: '\u{1F4B0}' },
  { id: 'users', label: 'Users', path: '/admin/users', icon: '\u{1F465}' },
  { id: 'songs', label: 'Songs', path: '/admin/songs', icon: '\u{1F3B5}' },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: '\u{2699}\u{FE0F}' },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchMe();
  }, [isAuthenticated]);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user]);

  const getActiveId = () => {
    const path = location.pathname;
    if (path === '/admin') return 'overview';
    const match = menuItems.find(
      (item) => item.path !== '/admin' && path.startsWith(item.path),
    );
    return match?.id || 'overview';
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-jb-bg-primary border-r border-white/10 flex-shrink-0 hidden desktop:flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-2xl font-bold text-jb-accent-green neon-text-green">
            JukeBox
          </h1>
          <p className="text-jb-text-secondary text-xs mt-1">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                getActiveId() === item.id
                  ? 'bg-jb-bg-secondary text-jb-accent-green shadow-glow-green'
                  : 'text-jb-text-secondary hover:bg-jb-bg-secondary/50 hover:text-jb-text-primary'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <p className="text-jb-text-secondary text-xs truncate">{user?.name}</p>
          <p className="text-jb-text-secondary/60 text-[10px] truncate">
            {user?.email}
          </p>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-jb-highlight-pink hover:bg-white/5 transition-all"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="desktop:hidden fixed top-0 left-0 right-0 z-40 bg-jb-bg-primary/95 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-jb-accent-green">JukeBox Admin</h1>
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
                  ? 'bg-jb-accent-green text-jb-bg-primary'
                  : 'bg-white/5 text-jb-text-secondary'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto desktop:p-6 p-4 pt-24 desktop:pt-6">
        <Outlet />
      </main>
    </div>
  );
};
