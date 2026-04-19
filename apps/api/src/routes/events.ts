import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getIO } from '../socket.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export const eventRouter = Router();

// ============================================
// Default special event pricing config
// ============================================
const DEFAULT_EVENT_CONFIG = {
  skipQueue: { enabled: true, price: 5.0 },
  silence: {
    enabled: true,
    options: [
      { duration: 60, price: 5.0 },
      { duration: 120, price: 10.0 },
      { duration: 180, price: 15.0 },
    ],
  },
  textMessage: { enabled: true, price: 2.0, maxLength: 200, displayDuration: 30 },
  voiceMessage: {
    enabled: true,
    options: [
      { duration: 5, price: 8.0 },
      { duration: 15, price: 10.0 },
    ],
    requiresApproval: true,
  },
  photo: { enabled: true, price: 5.0, requiresApproval: true, displayDuration: 180 },
  reaction: {
    enabled: true,
    price: 1.0,
    types: ['APPLAUSE', 'BOO', 'LAUGH', 'HEART', 'FIRE'],
  },
  birthday: { enabled: true, price: 25.0 },
};

// ============================================
// Validation schemas
// ============================================
const skipQueueSchema = z.object({
  machineId: z.string().uuid(),
  queueItemId: z.string().uuid(),
});

const silenceSchema = z.object({
  machineId: z.string().uuid(),
  duration: z.number().refine((v) => [60, 120, 180].includes(v), {
    message: 'Duration must be 60, 120, or 180 seconds',
  }),
});

const textMessageSchema = z.object({
  machineId: z.string().uuid(),
  message: z.string().min(1).max(200),
});

const voiceMessageSchema = z.object({
  machineId: z.string().uuid(),
  audioUrl: z.string().min(1),
  duration: z.number().min(1).max(60),
});

const photoSchema = z.object({
  machineId: z.string().uuid(),
  photoUrl: z.string().min(1),
});

const reactionSchema = z.object({
  machineId: z.string().uuid(),
  reactionType: z.enum(['APPLAUSE', 'BOO', 'LAUGH', 'HEART', 'FIRE']),
});

const birthdaySchema = z.object({
  machineId: z.string().uuid(),
  birthdayName: z.string().min(1).max(100),
  message: z.string().max(200).optional(),
  songId: z.string().uuid().optional(),
});

// ============================================
// Helper: Get event config for a machine's venue
// ============================================
async function getEventConfig(machineId: string) {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { venue: { select: { settings: true } } },
  });
  if (!machine) throw new AppError('Machine not found', 404);

  const venueSettings = (machine.venue.settings || {}) as Record<string, unknown>;
  const venueEvents = (venueSettings.specialEvents || {}) as Record<string, unknown>;

  // Also check global config
  const globalConfig = await prisma.globalConfig.findUnique({
    where: { key: 'specialEvents' },
  });
  const globalEvents = (globalConfig?.value || {}) as Record<string, unknown>;

  // Merge: venue overrides > global config > defaults
  const merged = { ...DEFAULT_EVENT_CONFIG };
  for (const key of Object.keys(merged) as (keyof typeof DEFAULT_EVENT_CONFIG)[]) {
    if (globalEvents[key]) {
      (merged as any)[key] = { ...(merged as any)[key], ...(globalEvents[key] as any) };
    }
    if (venueEvents[key]) {
      (merged as any)[key] = { ...(merged as any)[key], ...(venueEvents[key] as any) };
    }
  }

  return { config: merged, machine };
}

// ============================================
// Helper: Charge wallet
// ============================================
async function chargeWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  type: 'SKIP_QUEUE' | 'SILENCE' | 'VOICE_MSG' | 'PHOTO' | 'REACTION' | 'BIRTHDAY_PACK',
  machineId: string,
) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Wallet not found. Please top up first.', 404);
  if (wallet.balance < amount) {
    throw new AppError(
      `Insufficient balance. Need ${amount.toFixed(2)}, have ${wallet.balance.toFixed(2)}`,
      400,
    );
  }

  await tx.wallet.update({
    where: { userId },
    data: { balance: { decrement: amount } },
  });

  const transaction = await tx.transaction.create({
    data: {
      userId,
      machineId,
      type,
      amount,
      paymentMethod: 'WALLET',
      status: 'COMPLETED',
      idempotencyKey: crypto.randomUUID(),
    },
  });

  return transaction;
}

// ============================================
// 1. GET /events/config — Event pricing for venue
// ============================================
eventRouter.get('/config', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machineId = req.query.machineId as string;
    if (!machineId) throw new AppError('machineId query parameter required', 400);

    const { config } = await getEventConfig(machineId);

    res.json({
      success: true,
      data: { events: config },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 2. POST /events/skip-queue
// ============================================
eventRouter.post(
  '/skip-queue',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = skipQueueSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.skipQueue.enabled) throw new AppError('Skip queue is not enabled at this venue', 400);

      // Verify queue item exists, belongs to user, and is PENDING
      const queueItem = await prisma.queueItem.findUnique({ where: { id: data.queueItemId } });
      if (!queueItem) throw new AppError('Queue item not found', 404);
      if (queueItem.userId !== userId) throw new AppError('Queue item does not belong to you', 403);
      if (queueItem.machineId !== data.machineId) throw new AppError('Queue item does not belong to this machine', 400);
      if (queueItem.status !== 'PENDING') throw new AppError('Queue item is not pending', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, config.skipQueue.price, 'SKIP_QUEUE', data.machineId);

        // Find currently playing item's position
        const playing = await tx.queueItem.findFirst({
          where: { machineId: data.machineId, status: 'PLAYING' },
        });
        const targetPosition = playing ? playing.position + 1 : 1;

        // Move other pending items down
        await tx.queueItem.updateMany({
          where: {
            machineId: data.machineId,
            status: 'PENDING',
            position: { gte: targetPosition },
            id: { not: data.queueItemId },
          },
          data: { position: { increment: 1 } },
        });

        // Move this item to position 2 (right after playing)
        const updatedItem = await tx.queueItem.update({
          where: { id: data.queueItemId },
          data: { position: targetPosition, isPriority: true },
        });

        // Create special event record for tracking
        await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'SILENCE', // reuse for skip-queue tracking
            content: JSON.stringify({ queueItemId: data.queueItemId, action: 'skip-queue' }),
            amount: config.skipQueue.price,
            status: 'APPROVED',
          },
        });

        return { transaction, updatedItem };
      });

      // Emit queue update
      const io = getIO();
      const updatedQueue = await prisma.queueItem.findMany({
        where: { machineId: data.machineId, status: { in: ['PENDING', 'PLAYING'] } },
        include: {
          song: { select: { id: true, title: true, artist: true, duration: true, coverArtUrl: true, fileUrl: true, videoUrl: true, format: true, album: true, genre: true } },
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { position: 'asc' },
      });
      io.to(`machine:${data.machineId}`).emit('queue:updated', updatedQueue);

      res.status(201).json({
        success: true,
        data: {
          position: result.updatedItem.position,
          transactionId: result.transaction.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 3. POST /events/silence
// ============================================
eventRouter.post(
  '/silence',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = silenceSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.silence.enabled) throw new AppError('Silence feature is not enabled at this venue', 400);

      const option = config.silence.options.find((o) => o.duration === data.duration);
      if (!option) throw new AppError('Invalid silence duration', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, option.price, 'SILENCE', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'SILENCE',
            duration: data.duration,
            amount: option.price,
            status: 'APPROVED',
          },
        });

        return { transaction, event };
      });

      // Emit to TV player
      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      io.to(`machine:${data.machineId}`).emit('event:silence', {
        eventId: result.event.id,
        duration: data.duration,
        startedAt: new Date().toISOString(),
        userName: user?.name,
      });

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 4. POST /events/text-message
// ============================================
eventRouter.post(
  '/text-message',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = textMessageSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.textMessage.enabled) throw new AppError('Text message feature is not enabled at this venue', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, config.textMessage.price, 'REACTION', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'TEXT_MESSAGE',
            content: data.message,
            amount: config.textMessage.price,
            status: 'APPROVED',
          },
        });

        return { transaction, event };
      });

      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      io.to(`machine:${data.machineId}`).emit('event:textMessage', {
        eventId: result.event.id,
        message: data.message,
        userName: user?.name,
        duration: (config.textMessage as any).displayDuration || 30,
      });

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 5. POST /events/voice-message
// ============================================
eventRouter.post(
  '/voice-message',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = voiceMessageSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.voiceMessage.enabled) throw new AppError('Voice message feature is not enabled at this venue', 400);

      // Map actual duration to nearest available tier (e.g. 3s → 5s tier, 12s → 15s tier)
      const sortedOptions = [...config.voiceMessage.options].sort((a, b) => a.duration - b.duration);
      const option = sortedOptions.find((o) => data.duration <= o.duration) || sortedOptions[sortedOptions.length - 1];
      if (!option) throw new AppError('No voice message option configured', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, option.price, 'VOICE_MSG', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'VOICE_MESSAGE',
            content: data.audioUrl,
            duration: data.duration,
            amount: option.price,
            status: 'PENDING_APPROVAL',
          },
        });

        return { transaction, event };
      });

      // Notify bar owner
      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const machine = await prisma.machine.findUnique({
        where: { id: data.machineId },
        select: { venueId: true },
      });
      if (machine) {
        io.to(`venue:${machine.venueId}`).emit('event:pendingApproval', {
          eventId: result.event.id,
          type: 'VOICE_MESSAGE',
          userName: user?.name,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
          message: 'Awaiting bar owner approval',
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 6. POST /events/photo
// ============================================
eventRouter.post(
  '/photo',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = photoSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.photo.enabled) throw new AppError('Photo feature is not enabled at this venue', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, config.photo.price, 'PHOTO', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'PHOTO',
            content: data.photoUrl,
            amount: config.photo.price,
            status: 'PENDING_APPROVAL',
          },
        });

        return { transaction, event };
      });

      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const machine = await prisma.machine.findUnique({
        where: { id: data.machineId },
        select: { venueId: true },
      });
      if (machine) {
        io.to(`venue:${machine.venueId}`).emit('event:pendingApproval', {
          eventId: result.event.id,
          type: 'PHOTO',
          userName: user?.name,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
          message: 'Awaiting bar owner approval',
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 7. POST /events/reaction
// ============================================
eventRouter.post(
  '/reaction',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = reactionSchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.reaction.enabled) throw new AppError('Reactions are not enabled at this venue', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, config.reaction.price, 'REACTION', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'REACTION',
            content: data.reactionType,
            amount: config.reaction.price,
            status: 'APPROVED',
          },
        });

        return { transaction, event };
      });

      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      io.to(`machine:${data.machineId}`).emit('event:reaction', {
        eventId: result.event.id,
        type: data.reactionType,
        userName: user?.name,
      });

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 8. POST /events/birthday
// ============================================
eventRouter.post(
  '/birthday',
  requireAuth,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = birthdaySchema.parse(req.body);
      const userId = req.user!.userId;

      const { config } = await getEventConfig(data.machineId);
      if (!config.birthday.enabled) throw new AppError('Birthday feature is not enabled at this venue', 400);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await chargeWallet(tx, userId, config.birthday.price, 'BIRTHDAY_PACK', data.machineId);

        const event = await tx.specialEvent.create({
          data: {
            machineId: data.machineId,
            userId,
            type: 'BIRTHDAY',
            content: JSON.stringify({
              name: data.birthdayName,
              message: data.message,
              songId: data.songId,
            }),
            amount: config.birthday.price,
            status: 'APPROVED',
          },
        });

        // If songId provided, add to queue at priority position
        let queueItem = null;
        if (data.songId) {
          const song = await tx.song.findUnique({ where: { id: data.songId } });
          if (song && song.isActive) {
            const playing = await tx.queueItem.findFirst({
              where: { machineId: data.machineId, status: 'PLAYING' },
            });
            const targetPosition = playing ? playing.position + 1 : 1;

            await tx.queueItem.updateMany({
              where: {
                machineId: data.machineId,
                status: 'PENDING',
                position: { gte: targetPosition },
              },
              data: { position: { increment: 1 } },
            });

            queueItem = await tx.queueItem.create({
              data: {
                machineId: data.machineId,
                songId: data.songId,
                userId,
                position: targetPosition,
                isPriority: true,
                status: 'PENDING',
              },
            });
          }
        }

        return { transaction, event, queueItem };
      });

      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

      // Get song title if applicable
      let songTitle: string | undefined;
      if (data.songId) {
        const song = await prisma.song.findUnique({ where: { id: data.songId }, select: { title: true } });
        songTitle = song?.title;
      }

      io.to(`machine:${data.machineId}`).emit('event:birthday', {
        eventId: result.event.id,
        name: data.birthdayName,
        message: data.message,
        songTitle,
        userName: user?.name,
      });

      // Also emit queue update if song was added
      if (result.queueItem) {
        const updatedQueue = await prisma.queueItem.findMany({
          where: { machineId: data.machineId, status: { in: ['PENDING', 'PLAYING'] } },
          include: {
            song: { select: { id: true, title: true, artist: true, duration: true, coverArtUrl: true, fileUrl: true, videoUrl: true, format: true, album: true, genre: true } },
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { position: 'asc' },
        });
        io.to(`machine:${data.machineId}`).emit('queue:updated', updatedQueue);
      }

      res.status(201).json({
        success: true,
        data: {
          eventId: result.event.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  },
);

// ============================================
// 9. POST /events/:id/approve
// ============================================
eventRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('BAR_OWNER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id as string;
      const approverId = req.user!.userId;

      const event = await prisma.specialEvent.findUnique({
        where: { id: eventId },
        include: {
          machine: { include: { venue: true } },
          user: true,
        },
      });

      if (!event) throw new AppError('Event not found', 404);
      if (event.status !== 'PENDING_APPROVAL') throw new AppError('Event is not pending approval', 400);

      // Bar owners can only approve events for their own venues
      if (req.user!.role === 'BAR_OWNER' && event.machine.venue.ownerId !== approverId) {
        throw new AppError('You can only approve events for your own venues', 403);
      }

      const updated = await prisma.specialEvent.update({
        where: { id: eventId },
        data: { status: 'APPROVED', approvedById: approverId },
      });

      // Emit the appropriate event to TV player
      const io = getIO();
      if (event.type === 'VOICE_MESSAGE') {
        io.to(`machine:${event.machineId}`).emit('event:voiceMessage', {
          eventId: event.id,
          audioUrl: event.content,
          userName: event.user.name,
          duration: event.duration,
        });
      } else if (event.type === 'PHOTO') {
        const photoConfig = await getEventConfig(event.machineId).then(r => r.config.photo as any);
        io.to(`machine:${event.machineId}`).emit('event:photo', {
          eventId: event.id,
          photoUrl: event.content,
          userName: event.user.name,
          duration: photoConfig?.displayDuration || 180,
        });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 10. POST /events/:id/reject
// ============================================
eventRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('BAR_OWNER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id as string;

      const event = await prisma.specialEvent.findUnique({
        where: { id: eventId },
        include: {
          machine: { include: { venue: true } },
        },
      });

      if (!event) throw new AppError('Event not found', 404);
      if (event.status !== 'PENDING_APPROVAL') throw new AppError('Event is not pending approval', 400);

      if (req.user!.role === 'BAR_OWNER' && event.machine.venue.ownerId !== req.user!.userId) {
        throw new AppError('You can only reject events for your own venues', 403);
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.specialEvent.update({
          where: { id: eventId },
          data: { status: 'REJECTED' },
        });

        // Refund wallet
        await tx.wallet.update({
          where: { userId: event.userId },
          data: { balance: { increment: event.amount } },
        });

        // Create refund transaction
        const refundTx = await tx.transaction.create({
          data: {
            userId: event.userId,
            machineId: event.machineId,
            type: event.type === 'VOICE_MESSAGE' ? 'VOICE_MSG' : 'PHOTO',
            amount: event.amount,
            paymentMethod: 'WALLET',
            status: 'REFUNDED',
            idempotencyKey: crypto.randomUUID(),
            metadata: { refundFor: eventId } as Prisma.InputJsonValue,
          },
        });

        return { updated, refundTx };
      });

      // Notify user
      const io = getIO();
      io.to(`user:${event.userId}`).emit('event:rejected', {
        eventId: event.id,
        type: event.type,
      });

      res.json({
        success: true,
        data: {
          event: result.updated,
          refundTransactionId: result.refundTx.id,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 11. GET /events/pending — Pending events for owner
// ============================================
eventRouter.get(
  '/pending',
  requireAuth,
  requireRole('BAR_OWNER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      let whereClause: any = { status: 'PENDING_APPROVAL' };

      if (req.user!.role === 'BAR_OWNER') {
        // Get venues owned by this user
        const venues = await prisma.venue.findMany({
          where: { ownerId: userId },
          select: { id: true },
        });
        const venueIds = venues.map((v) => v.id);

        // Get machines in those venues
        const machines = await prisma.machine.findMany({
          where: { venueId: { in: venueIds } },
          select: { id: true },
        });
        const machineIds = machines.map((m) => m.id);

        whereClause.machineId = { in: machineIds };
      }

      const events = await prisma.specialEvent.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          machine: {
            select: {
              id: true,
              name: true,
              venue: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: { events },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 12. POST /events/upload — File upload (audio/image)
// ============================================
eventRouter.post(
  '/upload',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle base64 upload (simpler than multer for now)
      const { file, type, filename } = req.body;

      if (!file) {
        throw new AppError('File is required (base64-encoded)', 400);
      }
      if (!type) {
        throw new AppError('Type is required (audio, image, or video)', 400);
      }

      if (!['audio', 'image', 'video'].includes(type)) {
        throw new AppError('Type must be audio, image, or video', 400);
      }

      // Validate base64 size (rough estimate)
      const sizeBytes = Buffer.from(file, 'base64').length;
      const maxSizes: Record<string, number> = { audio: 5 * 1024 * 1024, image: 10 * 1024 * 1024, video: 20 * 1024 * 1024 };
      const maxSize = maxSizes[type] || 10 * 1024 * 1024;
      if (sizeBytes > maxSize) {
        throw new AppError(`File too large. Max ${maxSize / (1024 * 1024)}MB`, 400);
      }

      // Create uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const extMap: Record<string, string> = { audio: '.webm', image: '.jpg', video: '.mp4' };
      const ext = extMap[type] || '.bin';
      const fileName = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, Buffer.from(file, 'base64'));

      res.status(201).json({
        success: true,
        data: { url: `/uploads/${fileName}` },
      });
    } catch (error) {
      next(error);
    }
  },
);
