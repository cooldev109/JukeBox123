import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getVapidPublicKey } from '../lib/pushNotifications.js';

export const notificationRouter = Router();

// ============================================
// Validation schemas
// ============================================
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ============================================
// 1. GET /notifications/vapid-key — Public VAPID key
// ============================================
notificationRouter.get('/vapid-key', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { publicKey: getVapidPublicKey() },
  });
});

// ============================================
// 2. POST /notifications/subscribe — Save push subscription
// ============================================
notificationRouter.post(
  '/subscribe',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = subscribeSchema.parse(req.body);
      const userId = req.user!.userId;

      // Upsert by endpoint (re-subscribe)
      await prisma.pushSubscription.upsert({
        where: { endpoint: data.endpoint },
        update: {
          userId,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
        },
        create: {
          userId,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Push subscription saved',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  },
);

// ============================================
// 3. DELETE /notifications/subscribe — Remove subscription
// ============================================
notificationRouter.delete(
  '/subscribe',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = unsubscribeSchema.parse(req.body);

      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: data.endpoint,
          userId: req.user!.userId,
        },
      });

      res.json({
        success: true,
        message: 'Push subscription removed',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  },
);

// ============================================
// 4. GET /notifications/history — Recent alerts
// ============================================
notificationRouter.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      let alerts;

      if (role === 'ADMIN') {
        // Admin sees all alerts
        alerts = await prisma.machineAlert.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        });
      } else if (role === 'BAR_OWNER') {
        // Owner sees alerts for their machines
        const venues = await prisma.venue.findMany({
          where: { ownerId: userId },
          select: { id: true },
        });
        const venueIds = venues.map((v) => v.id);

        const machines = await prisma.machine.findMany({
          where: { venueId: { in: venueIds } },
          select: { id: true },
        });
        const machineIds = machines.map((m) => m.id);

        alerts = await prisma.machineAlert.findMany({
          where: { machineId: { in: machineIds } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        });
      } else if (role === 'EMPLOYEE') {
        // Employee sees alerts for machines in their region
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { regionAccess: true },
        });

        if (!user?.regionAccess) {
          alerts = [];
        } else {
          const venues = await prisma.venue.findMany({
            where: {
              OR: [
                { state: user.regionAccess },
                { city: user.regionAccess },
              ],
            },
            select: { id: true },
          });
          const venueIds = venues.map((v) => v.id);

          const machines = await prisma.machine.findMany({
            where: { venueId: { in: venueIds } },
            select: { id: true },
          });
          const machineIds = machines.map((m) => m.id);

          alerts = await prisma.machineAlert.findMany({
            where: { machineId: { in: machineIds } },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              machine: {
                select: {
                  id: true,
                  name: true,
                  venue: { select: { id: true, name: true } },
                },
              },
            },
          });
        }
      } else {
        alerts = [];
      }

      res.json({
        success: true,
        data: { alerts },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 5. POST /notifications/alerts/:id/resolve — Resolve an alert
// ============================================
notificationRouter.post(
  '/alerts/:id/resolve',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER', 'EMPLOYEE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertId = req.params.id;
      const userId = req.user!.userId;

      const alert = await prisma.machineAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new AppError('Alert not found', 404);
      if (alert.isResolved) throw new AppError('Alert is already resolved', 400);

      const updated = await prisma.machineAlert.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedById: userId,
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);
