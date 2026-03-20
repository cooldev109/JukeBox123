import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createPaymentIntent, createCustomer, attachPaymentMethod, listPaymentMethods, constructWebhookEvent } from '../lib/stripe.js';
import crypto from 'crypto';

export const paymentRouter = Router();

// ============================================
// Transaction types for all payment methods
// ============================================
const ALL_TRANSACTION_TYPES = [
  'SONG_PAYMENT', 'CREDIT_PURCHASE', 'SKIP_QUEUE',
  'SILENCE', 'VOICE_MSG', 'REACTION', 'PHOTO', 'BIRTHDAY_PACK',
] as const;

// ============================================
// Validation schemas
// ============================================
const pixPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(ALL_TRANSACTION_TYPES),
  machineId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const pixWebhookSchema = z.object({
  transactionId: z.string().uuid(),
  status: z.enum(['COMPLETED', 'FAILED']),
});

const walletTopUpSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD']).default('PIX'),
  stripePaymentMethodId: z.string().optional(), // For card top-ups
  idempotencyKey: z.string().min(1).optional(),
});

const walletSpendSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(ALL_TRANSACTION_TYPES),
  machineId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const cardPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(ALL_TRANSACTION_TYPES),
  machineId: z.string().uuid().optional(),
  stripePaymentMethodId: z.string().optional(), // Existing saved card
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const tokenizeCardSchema = z.object({
  stripePaymentMethodId: z.string().min(1),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(ALL_TRANSACTION_TYPES).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
});

// ============================================
// Helper: Generate mock Pix QR code
// ============================================
function generateMockPixQrCode(transactionId: string, amount: number): string {
  const payload = `00020126580014br.gov.bcb.pix0136${transactionId}5204000053039865404${amount.toFixed(2)}5802BR6009SAO PAULO62070503***6304`;
  return payload;
}

// ============================================
// Helper: Check idempotency key
// ============================================
async function checkIdempotency(key: string | undefined): Promise<string> {
  const idempotencyKey = key || crypto.randomUUID();

  if (key) {
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      throw new AppError('Duplicate transaction — idempotency key already used', 409);
    }
  }

  return idempotencyKey;
}

// ============================================
// Helper: Create affiliate commission if applicable
// ============================================
async function createAffiliateCommission(
  tx: Prisma.TransactionClient,
  transactionId: string,
  machineId: string | null,
  amount: number,
  referralCode?: string | null,
): Promise<void> {
  if (!machineId) return;

  // Get venue for this machine
  const machine = await tx.machine.findUnique({
    where: { id: machineId },
    select: { venueId: true },
  });
  if (!machine) return;

  const venueId = machine.venueId;

  // Check for active affiliate referral for this venue
  const activeReferral = await tx.affiliateReferral.findFirst({
    where: {
      venueId,
      isActive: true,
      endDate: { gte: new Date() },
      ...(referralCode ? { referralCode } : {}),
    },
  });

  if (!activeReferral) return;

  // Get venue settings for affiliate commission percent
  const venue = await tx.venue.findUnique({
    where: { id: venueId },
    select: { settings: true },
  });
  const settings = (venue?.settings || {}) as Record<string, unknown>;
  const affiliatePercent = (settings.affiliateCommissionPercent as number) || 25;

  const commissionAmount = (amount * affiliatePercent) / 100;

  await tx.commission.create({
    data: {
      affiliateId: activeReferral.affiliateId,
      transactionId,
      venueId,
      percentage: affiliatePercent,
      amount: commissionAmount,
      type: 'SALE',
      status: 'PENDING',
    },
  });
}

// ============================================
// GET /payments/wallet — Get wallet balance
// ============================================
paymentRouter.get('/wallet', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    res.json({
      success: true,
      data: {
        balance: wallet?.balance ?? 0,
        currency: wallet?.currency ?? 'BRL',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /payments/pix — Generate Pix payment
// ============================================
paymentRouter.post('/pix', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pixPaymentSchema.parse(req.body);
    const userId = req.user!.userId;

    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    if (data.machineId) {
      const machine = await prisma.machine.findUnique({ where: { id: data.machineId } });
      if (!machine) throw new AppError('Machine not found', 404);
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        machineId: data.machineId || null,
        type: data.type,
        amount: data.amount,
        paymentMethod: 'PIX',
        status: 'PENDING',
        idempotencyKey,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });

    const qrCode = generateMockPixQrCode(transaction.id, data.amount);

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        qrCode,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        expiresIn: 300,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /payments/pix/webhook — Pix webhook callback
// ============================================
paymentRouter.post('/pix/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pixWebhookSchema.parse(req.body);

    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
    });

    if (!transaction) throw new AppError('Transaction not found', 404);
    if (transaction.status !== 'PENDING') {
      throw new AppError(`Transaction already ${transaction.status.toLowerCase()}`, 400);
    }

    if (data.status === 'COMPLETED') {
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.update({
          where: { id: data.transactionId },
          data: {
            status: 'COMPLETED',
            pixTransactionId: `PIX_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          },
        });

        if (transaction.type === 'CREDIT_PURCHASE') {
          await tx.wallet.upsert({
            where: { userId: transaction.userId },
            update: { balance: { increment: transaction.amount }, lastTopUp: new Date() },
            create: { userId: transaction.userId, balance: transaction.amount, lastTopUp: new Date() },
          });
        }

        // Create affiliate commission if applicable
        await createAffiliateCommission(tx, updated.id, transaction.machineId, transaction.amount);

        return updated;
      });

      return res.json({
        success: true,
        data: { transactionId: updatedTransaction.id, status: updatedTransaction.status, type: updatedTransaction.type },
      });
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: data.transactionId },
      data: { status: 'FAILED' },
    });

    res.json({
      success: true,
      data: { transactionId: updatedTransaction.id, status: updatedTransaction.status },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /payments/card — Charge via Stripe card
// ============================================
paymentRouter.post('/card', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = cardPaymentSchema.parse(req.body);
    const userId = req.user!.userId;

    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    if (data.machineId) {
      const machine = await prisma.machine.findUnique({ where: { id: data.machineId } });
      if (!machine) throw new AppError('Machine not found', 404);
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new AppError('User not found', 404);

    // Create Stripe PaymentIntent
    const paymentIntent = await createPaymentIntent(
      data.amount,
      'BRL',
      {
        userId,
        transactionType: data.type,
        machineId: data.machineId || '',
        idempotencyKey,
      },
    );

    // Create pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        machineId: data.machineId || null,
        type: data.type,
        amount: data.amount,
        paymentMethod: 'CREDIT_CARD',
        status: 'PENDING',
        stripePaymentId: paymentIntent.id,
        idempotencyKey,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        clientSecret: paymentIntent.client_secret,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /payments/card/tokenize — Save card for future use
// ============================================
paymentRouter.post('/card/tokenize', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = tokenizeCardSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new AppError('User not found', 404);

    // Create Stripe customer if needed
    // In production, store stripeCustomerId on User model
    const customer = await createCustomer(user.email, user.name);

    // Attach payment method to customer
    const paymentMethod = await attachPaymentMethod(data.stripePaymentMethodId, customer.id);

    res.status(201).json({
      success: true,
      data: {
        paymentMethodId: paymentMethod.id,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        } : null,
        customerId: customer.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /payments/card/methods — List saved payment methods
// ============================================
paymentRouter.get('/card/methods', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In production, fetch stripeCustomerId from User model
    const stripeCustomerId = req.query.customerId as string;
    if (!stripeCustomerId) {
      return res.json({ success: true, data: { methods: [] } });
    }

    const methods = await listPaymentMethods(stripeCustomerId);

    res.json({
      success: true,
      data: {
        methods: methods.map((m) => ({
          id: m.id,
          brand: m.card?.brand,
          last4: m.card?.last4,
          expMonth: m.card?.exp_month,
          expYear: m.card?.exp_year,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /payments/stripe/webhook — Stripe webhook
// ============================================
paymentRouter.post('/stripe/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      throw new AppError('Missing Stripe signature', 400);
    }

    let event;
    try {
      event = constructWebhookEvent(JSON.stringify(req.body), signature);
    } catch {
      throw new AppError('Invalid Stripe webhook signature', 400);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as { id: string; metadata: Record<string, string> };

      await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findFirst({
          where: { stripePaymentId: paymentIntent.id },
        });

        if (!transaction || transaction.status !== 'PENDING') return;

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED' },
        });

        if (transaction.type === 'CREDIT_PURCHASE') {
          await tx.wallet.upsert({
            where: { userId: transaction.userId },
            update: { balance: { increment: transaction.amount }, lastTopUp: new Date() },
            create: { userId: transaction.userId, balance: transaction.amount, lastTopUp: new Date() },
          });
        }

        // Create affiliate commission if applicable
        await createAffiliateCommission(tx, transaction.id, transaction.machineId, transaction.amount);
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as { id: string };

      await prisma.transaction.updateMany({
        where: { stripePaymentId: paymentIntent.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    }

    res.json({ received: true });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(error);
  }
});

// ============================================
// POST /payments/wallet/topup — Top up wallet (Pix or Card)
// ============================================
paymentRouter.post('/wallet/topup', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = walletTopUpSchema.parse(req.body);
    const userId = req.user!.userId;

    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    if (data.paymentMethod === 'PIX') {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: 'CREDIT_PURCHASE',
          amount: data.amount,
          paymentMethod: 'PIX',
          status: 'PENDING',
          idempotencyKey,
        },
      });

      const qrCode = generateMockPixQrCode(transaction.id, data.amount);

      return res.status(201).json({
        success: true,
        data: {
          transactionId: transaction.id,
          qrCode,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          expiresIn: 300,
        },
      });
    }

    // Card top-up via Stripe
    const paymentIntent = await createPaymentIntent(data.amount, 'BRL', {
      userId,
      transactionType: 'CREDIT_PURCHASE',
      idempotencyKey,
    });

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'CREDIT_PURCHASE',
        amount: data.amount,
        paymentMethod: data.paymentMethod as 'CREDIT_CARD' | 'DEBIT_CARD',
        status: 'PENDING',
        stripePaymentId: paymentIntent.id,
        idempotencyKey,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        clientSecret: paymentIntent.client_secret,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /payments/wallet/spend — Spend from wallet
// ============================================
paymentRouter.post('/wallet/spend', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = walletSpendSchema.parse(req.body);
    const userId = req.user!.userId;

    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    if (data.machineId) {
      const machine = await prisma.machine.findUnique({ where: { id: data.machineId } });
      if (!machine) throw new AppError('Machine not found', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });

      if (!wallet) throw new AppError('Wallet not found. Please create an account first.', 404);
      if (wallet.balance < data.amount) {
        throw new AppError(`Insufficient wallet balance. Current balance: ${wallet.balance.toFixed(2)} ${wallet.currency}`, 400);
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: data.amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          machineId: data.machineId || null,
          type: data.type,
          amount: data.amount,
          paymentMethod: 'WALLET',
          status: 'COMPLETED',
          idempotencyKey,
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        },
      });

      // Create affiliate commission if applicable
      await createAffiliateCommission(tx, transaction.id, data.machineId || null, data.amount);

      return { transaction, wallet: updatedWallet };
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: result.transaction.id,
        status: result.transaction.status,
        type: result.transaction.type,
        amount: result.transaction.amount,
        walletBalance: result.wallet.balance,
        currency: result.wallet.currency,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /payments/history — User transaction history
// ============================================
paymentRouter.get('/history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = historyQuerySchema.parse(req.query);
    const userId = req.user!.userId;

    const where: Record<string, unknown> = { userId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          paymentMethod: true,
          status: true,
          pixTransactionId: true,
          stripePaymentId: true,
          metadata: true,
          createdAt: true,
          machine: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});
