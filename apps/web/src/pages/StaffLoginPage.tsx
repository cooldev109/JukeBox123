import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // If already authenticated, redirect by role
  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') navigate('/admin', { replace: true });
      else if (user.role === 'BAR_OWNER') navigate('/owner', { replace: true });
      else if (user.role === 'EMPLOYEE') navigate('/employee', { replace: true });
      else if (user.role === 'AFFILIATE') navigate('/affiliate', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    if (!password.trim()) { setError('Enter your password'); return; }
    setError('');
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'CUSTOMER') {
        setError('Customers should use the main page to enter a venue');
        useAuthStore.getState().logout();
        return;
      }
      if (loggedInUser.role === 'ADMIN') navigate('/admin');
      else if (loggedInUser.role === 'BAR_OWNER') navigate('/owner');
      else if (loggedInUser.role === 'EMPLOYEE') navigate('/employee');
      else if (loggedInUser.role === 'AFFILIATE') navigate('/affiliate');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-jb-accent-purple/10 via-transparent to-jb-highlight-pink/10" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-5xl font-bold text-jb-accent-green neon-text-green mb-2">
            JukeBox
          </h1>
          <p className="text-jb-text-secondary text-lg">Staff Login</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">Sign In</h2>
            <p className="text-jb-text-secondary text-sm text-center mb-4">
              For Admin, Bar Owner, Employee, and Affiliate accounts
            </p>

            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}

            <Button variant="primary" fullWidth loading={isLoading} onClick={handleLogin}>
              Login
            </Button>
          </div>
        </motion.div>

        {/* Back to customer entry */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <Link
            to="/"
            className="text-jb-text-secondary text-xs hover:text-jb-accent-green transition-colors"
          >
            Customer? Go back to venue entry
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
