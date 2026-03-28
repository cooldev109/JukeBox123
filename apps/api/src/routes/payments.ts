import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createPaymentIntent, createCustomer, attachPaymentMethod, listPaymentMethods, constructWebhookEvent } from '../lib/stripe.js';
import { getPixGateway, simulatePixPayment, getPixProviderName } from '../lib/pix.js';
import { createSplit } from '../services/revenueSplit.js';
import { getIO } from '../socket.js';
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
  songId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const walletTopUpSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD']).default('PIX'),
  stripePaymentMethodId: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

const walletSpendSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(ALL_TRANSACTION_TYPES),
  machineId: z.string().uuid().optional(),
  songId: z.string().uuid().optional(),
  isPriority: z.boolean().default(false),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const cardPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(ALL_TRANSACTION_TYPES),
  machineId: z.string().uuid().optional(),
  stripePaymentMethodId: z.string().optional(),
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
): Promise<void> {
  if (!machineId) return;

  const machine = await tx.machine.findUnique({
    where: { id: machineId },
    select: { venueId: true },
  });
  if (!machine) return;

  const venueId = machine.venueId;

  const activeReferral = await tx.affiliateReferral.findFirst({
    where: {
      venueId,
      isActive: true,
      endDate: { gte: new Date() },
    },
  });

  if (!activeReferral) return;

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
// Helper: Add song to queue after payment
// ============================================
async function addSongToQueueAfterPayment(
  tx: Prisma.TransactionClient,
  machineId: string,
  songId: string,
  userId: string,
  isPriority: boolean,
): Promise<{ id: string; position: number }> {
  const song = await tx.song.findUnique({ where: { id: songId } });
  if (!song) throw new AppError('Song not found', 404);
  if (!song.isActive) throw new AppError('Song is not currently available', 400);

  let position: number;

  if (isPriority) {
    const playingItem = await tx.queueItem.findFirst({
      where: { machineId, status: 'PLAYING' },
    });
    const pendingPriorityCount = await tx.queueItem.count({
      where: { machineId, status: 'PENDING', isPriority: true },
    });
    const basePosition = playingItem ? playingItem.position : 0;
    position = basePosition + pendingPriorityCount + 1;

    await tx.queueItem.updateMany({
      where: { machineId, status: 'PENDING', isPriority: false, position: { gte: position } },
      data: { position: { increment: 1 } },
    });
  } else {
    const lastItem = await tx.queueItem.findFirst({
      where: { machineId, status: { in: ['PENDING', 'PLAYING'] } },
      orderBy: { position: 'desc' },
    });
    position = lastItem ? lastItem.position + 1 : 1;
  }

  const queueItem = await tx.queueItem.create({
    data: { machineId, songId, userId, position, isPriority, status: 'PENDING' },
  });

  return { id: queueItem.id, position };
}

// ============================================
// Helper: Get venue ID from machine
// ============================================
async function getVenueIdFromMachine(machineId: string | null): Promise<string | null> {
  if (!machineId) return null;
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    select: { venueId: true },
  });
  return machine?.venueId ?? null;
}

// ============================================
// Helper: Complete a Pix payment (shared by webhook + polling)
// ============================================
async function completePixPayment(
  transactionId: string,
  providerChargeId: string,
  paidAmount?: number,
): Promise<{ status: string; type: string; queueItemId?: string }> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) throw new AppError('Transaction not found', 404);
  if (transaction.status !== 'PENDING') {
    return { status: transaction.status, type: transaction.type };
  }

  const metadata = (transaction.metadata || {}) as Record<string, unknown>;
  const songId = metadata.songId as string | undefined;
  const isPriority = metadata.isPriority === true;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        pixTransactionId: providerChargeId,
      },
    });

    // If wallet top-up, add to balance
    if (transaction.type === 'CREDIT_PURCHASE') {
      await tx.wallet.upsert({
        where: { userId: transaction.userId },
        update: { balance: { increment: paidAmount || transaction.amount }, lastTopUp: new Date() },
        create: { userId: transaction.userId, balance: paidAmount || transaction.amount, lastTopUp: new Date() },
      });
    }

    // If song payment, add song to queue
    let queueItemId: string | undefined;
    if (songId && transaction.machineId && (transaction.type === 'SONG_PAYMENT' || transaction.type === 'SKIP_QUEUE')) {
      const queueItem = await addSongToQueueAfterPayment(
        tx,
        transaction.machineId,
        songId,
        transaction.userId,
        isPriority,
      );
      queueItemId = queueItem.id;
    }

    // Create affiliate commission
    await createAffiliateCommission(tx, updated.id, transaction.machineId, transaction.amount);

    return { updated, queueItemId };
  });

  // Create revenue split (outside main transaction for non-blocking)
  const venueId = await getVenueIdFromMachine(transaction.machineId);
  if (venueId) {
    try {
      await createSplit(transactionId, venueId);
    } catch (err) {
      console.error('[Payment] Failed to create revenue split:', err);
    }
  }

  // Emit WebSocket events for queue update
  if (result.queueItemId && transaction.machineId) {
    try {
      const io = getIO();
      const queue = await prisma.queueItem.findMany({
        where: { machineId: transaction.machineId, status: { in: ['PENDING', 'PLAYING'] } },
        include: {
          song: { select: { id: true, title: true, artist: true, album: true, genre: true, duration: true, coverArtUrl: true, fileUrl: true, videoUrl: true, format: true } },
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { position: 'asc' },
      });
      io.to(`machine:${transaction.machineId}`).emit('queue:updated', queue);
      io.to(`machine:${transaction.machineId}`).emit('queue:song-added', { queueItemId: result.queueItemId });
    } catch {
      // Socket not critical
    }
  }

  return {
    status: result.updated.status,
    type: result.updated.type,
    queueItemId: result.queueItemId,
  };
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
// POST /payments/pix — Generate real Pix payment
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

    // Get user info for Pix payer data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Create transaction in DB first
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        machineId: data.machineId || null,
        type: data.type,
        amount: data.amount,
        paymentMethod: 'PIX',
        status: 'PENDING',
        idempotencyKey,
        metadata: {
          ...(data.metadata || {}),
          ...(data.songId ? { songId: data.songId } : {}),
        } as Prisma.InputJsonValue,
      },
    });

    // Generate real Pix charge via gateway
    const pix = getPixGateway();
    const description = data.type === 'CREDIT_PURCHASE'
      ? `JukeBox - Top-up R$${data.amount.toFixed(2)}`
      : data.type === 'SKIP_QUEUE'
        ? `JukeBox - VIP Song`
        : `JukeBox - Song Payment`;

    const charge = await pix.createCharge({
      amount: data.amount,
      description,
      externalReference: transaction.id,
      expirationSeconds: 300,
      payer: {
        email: user?.email || undefined,
        name: user?.name || undefined,
      },
    });

    // Store provider charge ID on the transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        pixTransactionId: charge.providerChargeId,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        pixCopiaECola: charge.pixCopiaECola,
        qrCodeBase64: charge.qrCodeBase64,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        expiresAt: charge.expiresAt,
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
// GET /payments/pix/:id/status — Poll Pix payment status
// ============================================
paymentRouter.get('/pix/:id/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactionId = req.params.id as string;
    const userId = req.user!.userId;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) throw new AppError('Transaction not found', 404);
    if (transaction.userId !== userId) throw new AppError('Forbidden', 403);

    // If already completed/failed, return immediately
    if (transaction.status !== 'PENDING') {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      return res.json({
        success: true,
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          type: transaction.type,
          walletBalance: wallet?.balance ?? 0,
        },
      });
    }

    // Check with Pix provider for latest status
    if (transaction.pixTransactionId) {
      const pix = getPixGateway();
      const chargeStatus = await pix.getChargeStatus(transaction.pixTransactionId);

      if (chargeStatus.status === 'COMPLETED') {
        const result = await completePixPayment(
          transaction.id,
          chargeStatus.providerChargeId,
          chargeStatus.paidAmount,
        );
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        return res.json({
          success: true,
          data: {
            transactionId: transaction.id,
            status: 'COMPLETED',
            type: result.type,
            queueItemId: result.queueItemId,
            walletBalance: wallet?.balance ?? 0,
          },
        });
      }

      if (chargeStatus.status === 'EXPIRED' || chargeStatus.status === 'FAILED') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        return res.json({
          success: true,
          data: {
            transactionId: transaction.id,
            status: 'FAILED',
            type: transaction.type,
          },
        });
      }
    }

    // Still pending
    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: 'PENDING',
        type: transaction.type,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /payments/pix/webhook — Pix gateway webhook callback
// ============================================
paymentRouter.post('/pix/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pix = getPixGateway();
    const signature = (req.headers['x-webhook-signature'] || req.headers['x-signature'] || '') as string;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    let webhookData;
    try {
      webhookData = pix.verifyWebhook(rawBody, signature);
    } catch (err) {
      console.error('[Pix Webhook] Signature verification failed:', err);
      throw new AppError('Invalid webhook signature', 401);
    }

    const externalReference = webhookData.externalReference;

    // externalReference is our transaction ID
    let transaction = await prisma.transaction.findUnique({
      where: { id: externalReference },
    });

    // If not found by ID, try by pixTransactionId (provider charge ID)
    if (!transaction) {
      transaction = await prisma.transaction.findFirst({
        where: { pixTransactionId: webhookData.providerChargeId },
      });
    }

    if (!transaction) {
      console.warn('[Pix Webhook] Transaction not found for reference:', externalReference);
      return res.json({ received: true });
    }

    if (transaction.status !== 'PENDING') {
      return res.json({ received: true });
    }

    if (webhookData.status === 'COMPLETED') {
      await completePixPayment(
        transaction.id,
        webhookData.providerChargeId,
        webhookData.amount,
      );
    } else {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
    }

    res.json({ received: true });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    console.error('[Pix Webhook] Error:', error);
    // Always return 200 to avoid provider retrying indefinitely
    res.json({ received: true, error: 'Internal processing error' });
  }
});

// ============================================
// POST /payments/pix/simulate — SANDBOX ONLY: simulate payment
// ============================================
paymentRouter.post('/pix/simulate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (getPixProviderName() !== 'sandbox') {
      throw new AppError('Payment simulation only available in sandbox mode', 400);
    }

    const { transactionId } = z.object({ transactionId: z.string().uuid() }).parse(req.body);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) throw new AppError('Transaction not found', 404);
    if (transaction.status !== 'PENDING') throw new AppError('Transaction is not pending', 400);

    // Simulate the payment in sandbox provider
    const simResult = simulatePixPayment(transaction.pixTransactionId || '');
    if (!simResult) {
      throw new AppError('Could not simulate payment — charge not found in sandbox', 400);
    }

    // Complete the payment
    const result = await completePixPayment(
      transaction.id,
      simResult.providerChargeId,
      simResult.amount,
    );

    const wallet = await prisma.wallet.findUnique({ where: { userId: transaction.userId } });

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: 'COMPLETED',
        type: result.type,
        queueItemId: result.queueItemId,
        walletBalance: wallet?.balance ?? 0,
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new AppError('User not found', 404);

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

    const customer = await createCustomer(user.email, user.name);
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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

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

      // Generate real Pix charge
      const pix = getPixGateway();
      const charge = await pix.createCharge({
        amount: data.amount,
        description: `JukeBox - Top-up R$${data.amount.toFixed(2)}`,
        externalReference: transaction.id,
        expirationSeconds: 300,
        payer: {
          email: user?.email || undefined,
          name: user?.name || undefined,
        },
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { pixTransactionId: charge.providerChargeId },
      });

      return res.status(201).json({
        success: true,
        data: {
          transactionId: transaction.id,
          pixCopiaECola: charge.pixCopiaECola,
          qrCodeBase64: charge.qrCodeBase64,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          expiresAt: charge.expiresAt,
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

      if (!wallet) throw new AppError('Wallet not found. Please top up your credits first.', 404);
      if (wallet.balance < data.amount) {
        throw new AppError(`Insufficient balance. You have R$ ${wallet.balance.toFixed(2)} but need R$ ${data.amount.toFixed(2)}`, 400);
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
          metadata: {
            ...(data.metadata || {}),
            ...(data.songId ? { songId: data.songId } : {}),
            ...(data.isPriority ? { isPriority: true } : {}),
          } as Prisma.InputJsonValue,
        },
      });

      // Add song to queue if this is a song payment
      let queueItemId: string | undefined;
      if (data.songId && data.machineId && (data.type === 'SONG_PAYMENT' || data.type === 'SKIP_QUEUE')) {
        const queueItem = await addSongToQueueAfterPayment(
          tx,
          data.machineId,
          data.songId,
          userId,
          data.isPriority,
        );
        queueItemId = queueItem.id;
      }

      await createAffiliateCommission(tx, transaction.id, data.machineId || null, data.amount);

      return { transaction, wallet: updatedWallet, queueItemId };
    });

    // Create revenue split
    const venueId = await getVenueIdFromMachine(data.machineId || null);
    if (venueId) {
      try {
        await createSplit(result.transaction.id, venueId);
      } catch (err) {
        console.error('[Payment] Failed to create revenue split:', err);
      }
    }

    // Emit queue updates via WebSocket
    if (result.queueItemId && data.machineId) {
      try {
        const io = getIO();
        const queue = await prisma.queueItem.findMany({
          where: { machineId: data.machineId, status: { in: ['PENDING', 'PLAYING'] } },
          include: {
            song: { select: { id: true, title: true, artist: true, album: true, genre: true, duration: true, coverArtUrl: true, fileUrl: true, videoUrl: true, format: true } },
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { position: 'asc' },
        });
        io.to(`machine:${data.machineId}`).emit('queue:updated', queue);
        io.to(`machine:${data.machineId}`).emit('queue:song-added', { queueItemId: result.queueItemId });
      } catch {
        // Socket not critical
      }
    }

    res.status(201).json({
      success: true,
      data: {
        transactionId: result.transaction.id,
        status: result.transaction.status,
        type: result.transaction.type,
        amount: result.transaction.amount,
        walletBalance: result.wallet.balance,
        currency: result.wallet.currency,
        queueItemId: result.queueItemId,
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

// ============================================
// GET /payments/pix/provider — Get current Pix provider info
// ============================================
paymentRouter.get('/pix/provider', requireAuth, async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      provider: getPixProviderName(),
      isSandbox: getPixProviderName() === 'sandbox',
    },
  });
});

// ============================================
// PUT /payments/pix/venue-key — Set venue Pix key (bar owner or admin)
// ============================================
paymentRouter.put('/pix/venue-key', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      venueId: z.string().uuid(),
      pixKey: z.string().min(1).max(100),
      pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']),
    });
    const data = schema.parse(req.body);
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check authorization: admin can set any venue, bar owner only their own
    const venue = await prisma.venue.findUnique({ where: { id: data.venueId } });
    if (!venue) throw new AppError('Venue not found', 404);

    if (userRole !== 'ADMIN' && venue.ownerId !== userId) {
      throw new AppError('You can only configure Pix keys for your own venue', 403);
    }

    const updated = await prisma.venue.update({
      where: { id: data.venueId },
      data: {
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType,
      },
      select: { id: true, name: true, pixKey: true, pixKeyType: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});
