import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@jukebox/ui';

interface StripeCardFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '__STRIPE_PK__';

export const StripeCardForm: React.FC<StripeCardFormProps> = ({
  clientSecret,
  amount,
  onSuccess,
  onCancel,
}) => {
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadStripe();
    return () => { mountedRef.current = false; };
  }, []);

  const loadStripe = () => {
    if ((window as any).Stripe) {
      initStripe((window as any).Stripe);
      return;
    }

    // Check if script is already loading
    const existing = document.getElementById('stripe-js');
    if (existing) {
      existing.addEventListener('load', () => {
        if ((window as any).Stripe && mountedRef.current) initStripe((window as any).Stripe);
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'stripe-js';
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      if ((window as any).Stripe && mountedRef.current) initStripe((window as any).Stripe);
    };
    script.onerror = () => {
      if (mountedRef.current) {
        setError('Failed to load payment system. Please try again.');
        setLoading(false);
      }
    };
    document.head.appendChild(script);
  };

  const initStripe = (StripeConstructor: any) => {
    try {
      const stripeInstance = StripeConstructor(STRIPE_PUBLISHABLE_KEY);
      const elementsInstance = stripeInstance.elements({
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#00FF00',
            colorBackground: '#1A1A2E',
            colorText: '#F5F5F5',
            colorDanger: '#FF0080',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '12px',
          },
          rules: {
            '.Input': {
              backgroundColor: '#0F0F0F',
              border: '1px solid rgba(255,255,255,0.1)',
            },
            '.Input:focus': {
              border: '1px solid #9B00FF',
              boxShadow: '0 0 10px rgba(155,0,255,0.2)',
            },
            '.Label': {
              color: '#B0B0B0',
            },
          },
        },
      });

      const paymentElement = elementsInstance.create('payment');

      paymentElement.on('ready', () => {
        if (mountedRef.current) {
          setReady(true);
          setLoading(false);
        }
      });

      paymentElement.on('loaderror', (event: any) => {
        if (mountedRef.current) {
          setError(event.error?.message || 'Failed to load payment form');
          setLoading(false);
        }
      });

      // Mount after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (cardRef.current && mountedRef.current) {
          paymentElement.mount(cardRef.current);
        }
      }, 100);

      setStripe(stripeInstance);
      setElements(elementsInstance);
    } catch (err: any) {
      if (mountedRef.current) {
        setError('Failed to initialize payment form.');
        setLoading(false);
      }
    }
  };

  const handlePay = async () => {
    if (!stripe || !elements || !ready) return;

    setPaying(true);
    setError('');

    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        setPaying(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1500);
      } else if (paymentIntent?.status === 'requires_action') {
        // 3D Secure — Stripe handles this automatically
        setError('Additional authentication required. Please complete the verification.');
        setPaying(false);
      } else {
        setError('Payment was not completed. Please try again.');
        setPaying(false);
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setPaying(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 mx-auto bg-jb-accent-green/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-jb-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-jb-accent-green font-bold text-lg">Payment Confirmed!</p>
        <p className="text-jb-text-secondary text-sm">
          R$ {amount.toFixed(2)} added to your balance
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-jb-accent-purple font-bold text-lg">Card Payment</p>
        <p className="text-jb-accent-green font-bold text-xl">R$ {amount.toFixed(2)}</p>
      </div>

      {/* Always render the mount point */}
      <div
        ref={cardRef}
        className="min-h-[150px]"
        style={{ display: loading && !error ? 'none' : 'block' }}
      />

      {loading && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-jb-accent-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-jb-text-secondary ml-3 text-sm">Loading payment form...</p>
        </div>
      )}

      {error && (
        <p className="text-jb-highlight-pink text-sm text-center">{error}</p>
      )}

      {ready && (
        <Button
          variant="primary"
          fullWidth
          onClick={handlePay}
          loading={paying}
          disabled={paying}
        >
          {paying ? 'Processing...' : `Pay R$ ${amount.toFixed(2)}`}
        </Button>
      )}

      <Button variant="ghost" fullWidth onClick={onCancel}>
        Cancel
      </Button>

      <p className="text-jb-text-secondary/40 text-xs text-center flex items-center justify-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        Secured by Stripe
      </p>
    </div>
  );
};
