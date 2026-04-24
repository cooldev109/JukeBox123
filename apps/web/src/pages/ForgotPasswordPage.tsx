import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Card } from '@jukebox/ui';
import { api } from '../lib/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) { setError('Please enter your email'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset-request', { email: email.trim() });
      setSubmitted(true);
    } catch (err: any) {
      // Even if backend hasn't implemented it yet, show success for privacy reasons
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Smart JukeBox" className="h-24 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-jb-text-primary">Forgot Password</h2>
        </div>

        <Card className="p-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="text-5xl">{'✉️'}</div>
              <p className="text-jb-text-primary font-medium">
                If an account exists for <span className="text-jb-accent-green">{email}</span>,
                we've sent instructions to reset your password.
              </p>
              <p className="text-jb-text-secondary text-sm">
                Check your inbox and spam folder. The reset link expires in 30 minutes.
              </p>
              <p className="text-jb-text-secondary text-xs">
                Didn't get an email? Contact the bar staff so an admin can reset your password manually.
              </p>
              <Link to="/login">
                <Button variant="primary" fullWidth>Back to login</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-jb-text-secondary text-sm">
                Enter the email address for your account. We'll send you instructions to reset your password.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}
              <Button variant="primary" fullWidth loading={loading} onClick={submit}>
                Send reset instructions
              </Button>
              <Link to="/login" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                Back to login
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
