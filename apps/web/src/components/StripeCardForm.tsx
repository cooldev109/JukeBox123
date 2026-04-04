import React, { useState, useEffect } from 'react';
import { Button } from '@jukebox/ui';

/**
 * Stripe Card Payment Form
 * Uses Stripe.js loaded dynamically — no npm package needed.
 * Renders a Stripe Payment Element for secure card input.
 */

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
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Load Stripe.js dynamically
  useEffect(() => {
    if ((window as any).Stripe) {
      initStripe((window as any).Stripe);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      if ((window as any).Stripe) {
        initStripe((window as any).Stripe);
      }
    };
    script.onerror = () => {
      setError('Failed to load payment system. Please try again.');
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  const initStripe = (StripeConstructor: any) => {
    try {
      const stripeInstance = StripeConstructor(STRIPE_PUBLISHABLE_KEY);
      setStripe(stripeInstance);

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
      if (cardRef.current) {
        paymentElement.mount(cardRef.current);
      }

      setElements(elementsInstance);
      setLoading(false);
    } catch (err: any) {
      setError('Failed to initialize payment form.');
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!stripe || !elements) return;

    setPaying(true);
    setError('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Validation error');
        setPaying(false);
        return;
      }

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
      } else {
        setError('Payment was not completed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
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

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-jb-accent-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-jb-text-secondary ml-3 text-sm">Loading payment form...</p>
        </div>
      ) : (
        <>
          <div ref={cardRef} className="min-h-[120px]" />

          {error && (
            <p className="text-jb-highlight-pink text-sm text-center">{error}</p>
          )}

          <Button
            variant="primary"
            fullWidth
            onClick={handlePay}
            loading={paying}
            disabled={paying}
          >
            {paying ? 'Processing...' : `Pay R$ ${amount.toFixed(2)}`}
          </Button>
        </>
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
