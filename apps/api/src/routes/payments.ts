import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

export const paymentRouter = Router();

// ============================================
// Validation schemas
// ============================================
const pixPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['SONG_PAYMENT', 'CREDIT_PURCHASE', 'SKIP_QUEUE']),
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
  idempotencyKey: z.string().min(1).optional(),
});

const walletSpendSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['SONG_PAYMENT', 'SKIP_QUEUE']),
  machineId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['SONG_PAYMENT', 'CREDIT_PURCHASE', 'SKIP_QUEUE']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
});

// ============================================
// Helper: Generate mock Pix QR code
// ============================================
function generateMockPixQrCode(transactionId: string, amount: number): string {
  // In production, this would call a real Pix PSP API (e.g., Mercado Pago, PagSeguro)
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

    // Validate idempotency
    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    // Validate machine exists if provided
    if (data.machineId) {
      const machine = await prisma.machine.findUnique({
        where: { id: data.machineId },
      });
      if (!machine) {
        throw new AppError('Machine not found', 404);
      }
    }

    // Create pending transaction
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

    // Generate mock QR code
    const qrCode = generateMockPixQrCode(transaction.id, data.amount);

    res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.id,
        qrCode,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        expiresIn: 300, // 5 minutes to pay
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
    // In production, validate webhook signature from Pix PSP
    const data = pixWebhookSchema.parse(req.body);

    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (transaction.status !== 'PENDING') {
      throw new AppError(`Transaction already ${transaction.status.toLowerCase()}`, 400);
    }

    if (data.status === 'COMPLETED') {
      // Use a Prisma transaction for atomicity
      const updatedTransaction = await prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.update({
          where: { id: data.transactionId },
          data: {
            status: 'COMPLETED',
            pixTransactionId: `PIX_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          },
        });

        // If this is a CREDIT_PURCHASE, add to user's wallet
        if (transaction.type === 'CREDIT_PURCHASE') {
          await tx.wallet.upsert({
            where: { userId: transaction.userId },
            update: {
              balance: { increment: transaction.amount },
              lastTopUp: new Date(),
            },
            create: {
              userId: transaction.userId,
              balance: transaction.amount,
              lastTopUp: new Date(),
            },
          });
        }

        // If this is a SONG_PAYMENT, the song would be added to the queue here
        // For now, we just mark the transaction as completed
        // TODO: Add song to queue when queue routes are implemented

        return updated;
      });

      return res.json({
        success: true,
        data: {
          transactionId: updatedTransaction.id,
          status: updatedTransaction.status,
          type: updatedTransaction.type,
        },
      });
    }

    // Handle FAILED status
    const updatedTransaction = await prisma.transaction.update({
      where: { id: data.transactionId },
      data: { status: 'FAILED' },
    });

    res.json({
      success: true,
      data: {
        transactionId: updatedTransaction.id,
        status: updatedTransaction.status,
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
// POST /payments/wallet/topup — Top up wallet via Pix
// ============================================
paymentRouter.post('/wallet/topup', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = walletTopUpSchema.parse(req.body);
    const userId = req.user!.userId;

    // Validate idempotency
    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    // Create pending CREDIT_PURCHASE transaction (wallet is topped up when Pix webhook confirms)
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

    // Generate Pix QR code for the top-up
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
// POST /payments/wallet/spend — Spend from wallet
// ============================================
paymentRouter.post('/wallet/spend', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = walletSpendSchema.parse(req.body);
    const userId = req.user!.userId;

    // Validate idempotency
    const idempotencyKey = await checkIdempotency(data.idempotencyKey);

    // Validate machine exists if provided
    if (data.machineId) {
      const machine = await prisma.machine.findUnique({
        where: { id: data.machineId },
      });
      if (!machine) {
        throw new AppError('Machine not found', 404);
      }
    }

    // Atomic: check balance and deduct in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new AppError('Wallet not found. Please create an account first.', 404);
      }

      if (wallet.balance < data.amount) {
        throw new AppError(
          `Insufficient wallet balance. Current balance: ${wallet.balance.toFixed(2)} ${wallet.currency}`,
          400,
        );
      }

      // Deduct from wallet
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: data.amount },
        },
      });

      // Create completed transaction (wallet payments are instant)
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
