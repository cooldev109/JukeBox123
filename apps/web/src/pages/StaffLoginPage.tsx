import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';
import { PasswordInput } from '../components/PasswordInput';
import { LanguageToggle } from '../components/LanguageToggle';
import { useI18n } from '../lib/i18n';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
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
    if (!email.trim()) { setError(t('enter_your_email')); return; }
    if (!password.trim()) { setError(t('enter_password')); return; }
    setError('');
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'CUSTOMER') {
        setError(t('back_to_venue_entry'));
        useAuthStore.getState().logout();
        return;
      }
      if (loggedInUser.role === 'ADMIN') navigate('/admin');
      else if (loggedInUser.role === 'BAR_OWNER') navigate('/owner');
      else if (loggedInUser.role === 'EMPLOYEE') navigate('/employee');
      else if (loggedInUser.role === 'AFFILIATE') navigate('/affiliate');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || t('login_failed'));
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-jb-accent-purple/10 via-transparent to-jb-highlight-pink/10" />

      {/* Language toggle - top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

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
          <p className="text-jb-text-secondary text-lg">{t('staff_login_title')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">{t('sign_in')}</h2>
            <p className="text-jb-text-secondary text-sm text-center mb-4">
              {t('staff_login_subtitle')}
            </p>

            <Input
              label={t('email')}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              label={t('password')}
              placeholder={t('password')}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}

            <Button variant="primary" fullWidth loading={isLoading} onClick={handleLogin}>
              {t('login')}
            </Button>

            <Link
              to="/forgot-password"
              className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green"
            >
              {t('forgot_password_link')}
            </Link>
          </div>
        </motion.div>

        {/* Create new account */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 grid grid-cols-2 gap-3"
        >
          <Link
            to="/login?signup=BAR_OWNER"
            className="text-center bg-jb-accent-green/10 hover:bg-jb-accent-green/20 border border-jb-accent-green/30 text-jb-accent-green text-sm font-semibold rounded-lg py-2.5 transition-colors"
          >
            {t('create_bar_account')}
          </Link>
          <Link
            to="/login?signup=AFFILIATE"
            className="text-center bg-jb-accent-purple/10 hover:bg-jb-accent-purple/20 border border-jb-accent-purple/30 text-jb-accent-purple text-sm font-semibold rounded-lg py-2.5 transition-colors"
          >
            {t('create_affiliate_account')}
          </Link>
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
            {t('back_to_venue_entry')}
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
