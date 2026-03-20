import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, register, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [venueCode, setVenueCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const [searchParams] = useSearchParams();

  // Auto-fill venue code from URL params (from QR code scan)
  React.useEffect(() => {
    const venueParam = searchParams.get('venue');
    if (venueParam) {
      setVenueCode(venueParam);
    }
  }, [searchParams]);

  // If already authenticated, redirect by role
  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') navigate('/admin', { replace: true });
      else if (user.role === 'BAR_OWNER') navigate('/owner', { replace: true });
      else if (user.role === 'EMPLOYEE') navigate('/employee', { replace: true });
      else if (user.role === 'AFFILIATE') navigate('/affiliate', { replace: true });
      else navigate('/browse', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async () => {
    if (!venueCode.trim()) { setError('Enter the venue code from the QR code at the bar'); return; }
    if (!email.trim()) { setError('Enter your email'); return; }
    if (!password.trim()) { setError('Enter your password'); return; }
    setError('');
    try {
      await login(email, password, venueCode.trim());
      navigate('/browse');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    }
  };

  const handleRegister = async () => {
    if (!venueCode.trim()) { setError('Enter the venue code from the QR code at the bar'); return; }
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!email.trim()) { setError('Enter your email'); return; }
    if (!password.trim() || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    try {
      await register({ name: name.trim(), email: email.trim(), password, role: 'CUSTOMER' });
      // After register, login with venue code to get machine context
      await login(email.trim(), password, venueCode.trim());
      navigate('/browse');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
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

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-6xl font-bold text-jb-accent-green neon-text-green mb-2">
            JukeBox
          </h1>
          <p className="text-jb-text-secondary text-lg">Your music, your bar, your vibe</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          {mode === 'login' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">Welcome to JukeBox</h2>
              <p className="text-jb-text-secondary text-sm text-center mb-4">
                Scan the QR code at the bar or enter the venue code
              </p>

              <Input
                label="Venue Code"
                placeholder="e.g. BAR-CARLOS"
                value={venueCode}
                onChange={(e) => setVenueCode(e.target.value)}
              />

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-jb-text-secondary text-xs">your account</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

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
                Enter JukeBox
              </Button>

              <Button variant="ghost" fullWidth onClick={() => { setMode('register'); setError(''); }}>
                New here? Create an account
              </Button>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">Create Account</h2>
              <p className="text-jb-text-secondary text-sm text-center mb-4">
                Sign up to start playing songs
              </p>

              <Input
                label="Venue Code"
                placeholder="e.g. BAR-CARLOS"
                value={venueCode}
                onChange={(e) => setVenueCode(e.target.value)}
              />
              <Input
                label="Your Name"
                placeholder="What should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}

              <Button variant="primary" fullWidth loading={isLoading} onClick={handleRegister}>
                Create Account & Enter
              </Button>

              <Button variant="ghost" fullWidth onClick={() => { setMode('login'); setError(''); }}>
                Already have an account? Login
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
            Staff Login (Admin / Owner / Employee / Affiliate)
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
