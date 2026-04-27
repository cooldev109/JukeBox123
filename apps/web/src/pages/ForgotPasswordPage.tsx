import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@jukebox/ui';
import { PasswordInput } from '../components/PasswordInput';
import { LanguageToggle } from '../components/LanguageToggle';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

type Step = 'request' | 'requested' | 'confirm' | 'done';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async () => {
    if (!email.trim()) { setError(t('reset_email_required')); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset-request', { email: email.trim() });
      setStep('requested');
    } catch {
      setStep('requested');
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (!code.trim() || code.trim().length !== 6) { setError(t('reset_code_invalid')); return; }
    if (!newPassword.trim() || newPassword.length < 6) { setError(t('new_password_too_short')); return; }
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
      setError(err.response?.data?.error || t('invalid_or_expired_code'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary flex items-center justify-center px-4 relative">
      {/* Language toggle - top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Smart JukeBox" className="h-24 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-jb-text-primary">{t('reset_password_title')}</h2>
        </div>

        <Card className="p-6">
          {step === 'request' && (
            <div className="space-y-4">
              <p className="text-jb-text-secondary text-sm">{t('reset_intro')}</p>
              <Input
                label={t('email')}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}
              <Button variant="primary" fullWidth loading={loading} onClick={requestReset}>
                {t('send_reset_code')}
              </Button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="block w-full text-center text-jb-text-secondary text-xs hover:text-jb-accent-green"
              >
                {t('have_code_link')}
              </button>
              <Link to="/login" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                {t('back_to_login_link')}
              </Link>
            </div>
          )}

          {step === 'requested' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">{'✉️'}</div>
              <p className="text-jb-text-primary font-medium">
                {t('reset_sent_body_1')} <span className="text-jb-accent-green">{email}</span>, {t('reset_sent_body_2')}
              </p>
              <p className="text-jb-text-secondary text-sm">{t('reset_sent_help')}</p>
              <Button variant="primary" fullWidth onClick={() => setStep('confirm')}>
                {t('i_have_the_code')}
              </Button>
              <Link to="/login" className="block text-center text-jb-text-secondary text-xs hover:text-jb-accent-green">
                {t('back_to_login_link')}
              </Link>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-jb-text-secondary text-sm">{t('confirm_intro')}</p>
              <Input
                label={t('email')}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label={t('reset_code_label')}
                placeholder={t('reset_code_placeholder')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <PasswordInput
                label={t('new_password_label')}
                placeholder={t('password_min')}
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              {error && <p className="text-jb-highlight-pink text-sm text-center">{error}</p>}
              <Button variant="primary" fullWidth loading={loading} onClick={confirmReset}>
                {t('reset_password_button')}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); setCode(''); setNewPassword(''); }}
                className="block w-full text-center text-jb-text-secondary text-xs hover:text-jb-accent-green"
              >
                {t('request_new_code')}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">{'✅'}</div>
              <p className="text-jb-text-primary font-medium">{t('reset_done_title')}</p>
              <p className="text-jb-text-secondary text-sm">{t('reset_done_body')}</p>
              <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                {t('go_to_login')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
