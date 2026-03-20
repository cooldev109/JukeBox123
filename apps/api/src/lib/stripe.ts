import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
});

/**
 * Create a payment intent for card payment
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe expects cents
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });
}

/**
 * Store a card token for future use (customer saved cards)
 */
export async function createCustomer(
  email: string | null,
  name: string,
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email: email || undefined,
    name,
    metadata: { source: 'jukebox' },
  });
}

/**
 * Attach a payment method to a customer for one-click payments
 */
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string,
): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

/**
 * List saved payment methods for a customer
 */
export async function listPaymentMethods(
  customerId: string,
): Promise<Stripe.PaymentMethod[]> {
  const result = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  return result.data;
}

/**
 * Retrieve a payment intent to check its status
 */
export async function retrievePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Construct and verify a webhook event from Stripe
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
