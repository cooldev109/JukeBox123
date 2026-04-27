import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { LanguageToggle } from '../components/LanguageToggle';
import { PasswordInput } from '../components/PasswordInput';
import { useI18n } from '../lib/i18n';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, register, isLoading } = useAuthStore();
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [venueCode, setVenueCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [signupRole, setSignupRole] = useState<'CUSTOMER' | 'BAR_OWNER' | 'AFFILIATE'>('CUSTOMER');
  const [barName, setBarName] = useState('');
  const [barCity, setBarCity] = useState('');
  const [barState, setBarState] = useState('');

  const [searchParams] = useSearchParams();

  // Auto-fill venue code from URL params (from QR code scan)
  // and pre-select signup role + open register tab when ?signup=BAR_OWNER etc.
  React.useEffect(() => {
    const venueParam = searchParams.get('venue');
    if (venueParam) {
      setVenueCode(venueParam);
    }
    const signupParam = searchParams.get('signup');
    if (signupParam === 'BAR_OWNER' || signupParam === 'AFFILIATE' || signupParam === 'CUSTOMER') {
      setSignupRole(signupParam);
      setMode('register');
    }
  }, [searchParams]);

  // If already authenticated, redirect by role or to redirect param
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const redirect = searchParams.get('redirect');
      if (redirect) { navigate(redirect, { replace: true }); return; }
      if (user.role === 'ADMIN') navigate('/admin', { replace: true });
      else if (user.role === 'BAR_OWNER') navigate('/owner', { replace: true });
      else if (user.role === 'EMPLOYEE') navigate('/employee', { replace: true });
      else if (user.role === 'AFFILIATE') navigate('/affiliate', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate, searchParams]);

  const handleLogin = async () => {
    if (!email.trim()) { setError(t('enter_your_email')); return; }
    if (!password.trim()) { setError(t('enter_password')); return; }
    setError('');
    try {
      await login(email, password, venueCode.trim() || undefined);
      const redirect = searchParams.get('redirect');
      navigate(redirect || '/browse');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || t('login_failed'));
    }
  };

  const handleRegister = async () => {
    if (!email.trim()) { setError(t('enter_your_email')); return; }
    if (!password.trim() || password.length < 6) { setError(t('password_too_short')); return; }
    if (signupRole === 'CUSTOMER' && !venueCode.trim()) {
      setError(t('enter_venue_code_err'));
      return;
    }
    if (signupRole === 'BAR_OWNER' && !barName.trim()) {
      setError(t('enter_bar_name_err'));
      return;
    }
    setError('');
    try {
      // Derive a display name: use provided name, else the email prefix ("jane@foo" -> "jane")
      const displayName = name.trim() || email.trim().split('@')[0];
      await register({
        name: displayName,
        email: email.trim(),
        password,
        role: signupRole,
        ...(signupRole === 'BAR_OWNER' && {
          barName: barName.trim(),
          barCity: barCity.trim() || undefined,
          barState: barState.trim() || undefined,
        }),
      });
      if (signupRole === 'CUSTOMER') {
        // Customers need a second login pass to attach the venue+machine context.
        await login(email.trim(), password, venueCode.trim());
        navigate('/browse');
      }
      // For BAR_OWNER / AFFILIATE: register already authenticated the session.
      // The role-based useEffect above will redirect to /owner or /affiliate.
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || t('registration_failed'));
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-jb-accent-purple/10 via-transparent to-jb-highlight-pink/10" />

      {/* Animated background circles */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-jb-accent-purple/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-jb-highlight-pink/5 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

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
          <img src="/logo.png" alt="Smart JukeBox" className="h-48 mx-auto mb-2" />
          <p className="text-jb-text-secondary text-lg">{t('your_music_tagline')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 mx-2"
        >
          {mode === 'login' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">{t('welcome')}</h2>
              <p className="text-jb-text-secondary text-sm text-center mb-4">
                {t('signin_subtitle')}
              </p>

              <GoogleLoginButton
                onSuccess={() => {
                  const redirect = searchParams.get('redirect');
                  navigate(redirect || '/');
                }}
                onError={(err) => setError(err)}
              />

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-jb-text-secondary text-xs">{t('or_use_email')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

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
                {t('enter_jukebox')}
              </Button>

              <Link to="/forgot-password" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                {t('forgot_password_link')}
              </Link>

              <Button variant="ghost" fullWidth onClick={() => { setMode('register'); setError(''); }}>
                {t('new_here')}
              </Button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-jb-text-secondary text-xs">{t('or')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <Button variant="secondary" fullWidth onClick={() => navigate('/browse')}>
                {t('browse_without_login')}
              </Button>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">{t('create_account_title')}</h2>
              <p className="text-jb-text-secondary text-sm text-center mb-4">
                {t('choose_account_type')}
              </p>

              {/* Role selector */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'CUSTOMER', labelKey: 'role_customer' },
                  { key: 'BAR_OWNER', labelKey: 'role_bar_owner' },
                  { key: 'AFFILIATE', labelKey: 'role_affiliate' },
                ] as const).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => { setSignupRole(r.key); setError(''); }}
                    className={`text-xs font-semibold py-2 rounded-lg border transition-colors ${
                      signupRole === r.key
                        ? 'bg-jb-accent-green/20 text-jb-accent-green border-jb-accent-green/40'
                        : 'bg-white/5 text-jb-text-secondary border-white/10 hover:border-white/20'
                    }`}
                  >
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>

              {signupRole === 'CUSTOMER' && (
                <Input
                  label={t('venue_code_label')}
                  placeholder={t('venue_code_placeholder_v')}
                  value={venueCode}
                  onChange={(e) => setVenueCode(e.target.value)}
                />
              )}
              {signupRole === 'BAR_OWNER' && (
                <>
                  <Input
                    label={t('bar_name')}
                    placeholder={t('bar_name_placeholder')}
                    value={barName}
                    onChange={(e) => setBarName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t('city_optional')}
                      placeholder={t('city_placeholder')}
                      value={barCity}
                      onChange={(e) => setBarCity(e.target.value)}
                    />
                    <Input
                      label={t('state_optional')}
                      placeholder={t('state_placeholder')}
                      value={barState}
                      onChange={(e) => setBarState(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Input
                label={t('email')}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordInput
                label={t('password')}
                placeholder={t('password_min')}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <Input
                label={t('display_name_optional')}
                placeholder={t('display_name_placeholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {signupRole !== 'CUSTOMER' && (
                <p className="text-jb-text-secondary text-xs text-center">
                  {signupRole === 'BAR_OWNER' ? t('help_bar_owner') : t('help_affiliate')}
                </p>
              )}

              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}

              <Button variant="primary" fullWidth loading={isLoading} onClick={handleRegister}>
                {t('create_account_button')}
              </Button>

              <Button variant="ghost" fullWidth onClick={() => { setMode('login'); setError(''); }}>
                {t('back_to_login')}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Staff login link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <Link
            to="/staff-login"
            className="text-jb-text-secondary text-xs hover:text-jb-accent-green transition-colors"
          >
            {t('staff_login')}
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
