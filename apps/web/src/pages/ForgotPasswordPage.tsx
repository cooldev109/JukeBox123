import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@jukebox/ui';
import { api } from '../lib/api';

type Step = 'request' | 'requested' | 'confirm' | 'done';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async () => {
    if (!email.trim()) { setError('Please enter your email'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset-request', { email: email.trim() });
      setStep('requested');
    } catch {
      // Backend always returns 200 for privacy; only fail here if network
      setStep('requested');
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (!code.trim() || code.trim().length !== 6) { setError('Enter the 6-digit code you received'); return; }
    if (!newPassword.trim() || newPassword.length < 6) { setError('New password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset-confirm', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Smart JukeBox" className="h-24 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-jb-text-primary">Reset Password</h2>
        </div>

        <Card className="p-6">
          {step === 'request' && (
            <div className="space-y-4">
              <p className="text-jb-text-secondary text-sm">
                Enter the email for your account. We'll send a 6-digit code to reset your password.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}
              <Button variant="primary" fullWidth loading={loading} onClick={requestReset}>
                Send reset code
              </Button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="block w-full text-center text-jb-text-secondary text-xs hover:text-jb-accent-green"
              >
                Already have a code? Enter it here
              </button>
              <Link to="/login" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                Back to login
              </Link>
            </div>
          )}

          {step === 'requested' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">{'✉️'}</div>
              <p className="text-jb-text-primary font-medium">
                If an account exists for <span className="text-jb-accent-green">{email}</span>,
                a 6-digit reset code has been generated.
              </p>
              <p className="text-jb-text-secondary text-sm">
                The code expires in 30 minutes. Ask the bar staff or an admin to relay the code to you
                if you did not receive an email.
              </p>
              <Button variant="primary" fullWidth onClick={() => setStep('confirm')}>
                I have the code — enter it
              </Button>
              <Link to="/login" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                Back to login
              </Link>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-jb-text-secondary text-sm">
                Enter the 6-digit code and choose a new password.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Reset Code"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[34px] text-jb-text-secondary text-xs hover:text-jb-accent-green"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}
              <Button variant="primary" fullWidth loading={loading} onClick={confirmReset}>
                Reset password
              </Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); setCode(''); setNewPassword(''); }}
                className="block w-full text-center text-jb-text-secondary text-xs hover:text-jb-accent-green"
              >
                Request a new code
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">{'✅'}</div>
              <p className="text-jb-text-primary font-medium">Password updated successfully</p>
              <p className="text-jb-text-secondary text-sm">
                You can now log in with your new password.
              </p>
              <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                Go to login
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
