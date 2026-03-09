import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input } from '@jukebox/ui';
import { useAuthStore } from '../stores/authStore';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, qrRegister, login, isLoading, fetchMe } = useAuthStore();
  const [mode, setMode] = useState<'entry' | 'login' | 'register'>('entry');
  const [venueCode, setVenueCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [searchParams] = useSearchParams();

  // Auto-fill venue code from URL params (from QR code scan)
  React.useEffect(() => {
    const venueParam = searchParams.get('venue');
    if (venueParam) {
      setVenueCode(venueParam);
      setMode('entry');
    }
  }, [searchParams]);

  // If already authenticated, fetch user and redirect by role
  React.useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe();
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'BAR_OWNER') navigate('/owner');
      else navigate('/browse');
    }
  }, [isAuthenticated, user, navigate]);

  const handleQuickEntry = async () => {
    if (!venueCode.trim()) { setError('Enter the venue code'); return; }
    setError('');
    try {
      const result = await qrRegister(venueCode.trim(), guestName.trim() || undefined, phone.trim() || undefined);
      navigate('/browse', { state: { venueName: result.venueName } });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid venue code');
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'BAR_OWNER') navigate('/owner');
      else navigate('/browse');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
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
          {mode === 'entry' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">Scan to Play</h2>
              <p className="text-jb-text-secondary text-sm text-center mb-4">
                Enter the venue code displayed at the bar
              </p>

              <Input
                label="Venue Code"
                placeholder="e.g. NEON-BAR-001"
                value={venueCode}
                onChange={(e) => setVenueCode(e.target.value)}
              />
              <Input
                label="Your Name (optional)"
                placeholder="What should we call you?"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
              <Input
                label="Phone (optional)"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}

              <Button variant="primary" fullWidth loading={isLoading} onClick={handleQuickEntry}>
                Enter JukeBox
              </Button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-jb-text-secondary text-xs">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <Button variant="ghost" fullWidth onClick={() => setMode('login')}>
                Already have an account? Login
              </Button>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center mb-2">Welcome Back</h2>

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
              <Button variant="ghost" fullWidth onClick={() => { setMode('entry'); setError(''); }}>
                Back to Quick Entry
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
