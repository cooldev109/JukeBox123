import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onSuccess, onError }) => {
  const { loginWithGoogle } = useAuthStore();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || initialized.current) return;

    const loadGoogleScript = () => {
      if (document.getElementById('google-gsi')) {
        initializeGoogle();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.head.appendChild(script);
    };

    const initializeGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !buttonRef.current) return;

      initialized.current = true;

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      });

      google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    };

    loadGoogleScript();
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response?.credential) {
      onError?.('Google sign-in failed');
      return;
    }

    try {
      await loginWithGoogle(response.credential);
      onSuccess?.();
    } catch (err: any) {
      onError?.(err.response?.data?.error || 'Google sign-in failed');
    }
  };

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="w-full">
      <div ref={buttonRef} className="flex justify-center" />
    </div>
  );
};
