import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const affiliateRouter = Router();

// ============================================
// Validation schemas
// ============================================
const commissionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'PAID']).optional(),
  type: z.enum(['SALE', 'VENUE_REFERRAL']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const referralQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isActive: z.coerce.boolean().optional(),
});

// ============================================
// GET /affiliates/me/commissions — Affiliate's own commission data
// ============================================
affiliateRouter.get(
  '/me/commissions',
  requireAuth,
  requireRole('AFFILIATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = commissionQuerySchema.parse(req.query);
      const affiliateId = req.user!.userId;

      const where: Record<string, unknown> = { affiliateId };
      if (query.status) where.status = query.status;
      if (query.type) where.type = query.type;
      if (query.dateFrom || query.dateTo) {
        where.createdAt = {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        };
      }

      const [commissions, total] = await Promise.all([
        prisma.commission.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            transaction: {
              select: { id: true, type: true, amount: true, createdAt: true },
            },
            venue: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.commission.count({ where }),
      ]);

      // Calculate summary
      const [totalPending, totalPaid, totalEarnings] = await Promise.all([
        prisma.commission.aggregate({
          where: { affiliateId, status: 'PENDING' },
          _sum: { amount: true },
        }),
        prisma.commission.aggregate({
          where: { affiliateId, status: 'PAID' },
          _sum: { amount: true },
        }),
        prisma.commission.aggregate({
          where: { affiliateId },
          _sum: { amount: true },
        }),
      ]);

      // Today's earnings
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEarnings = await prisma.commission.aggregate({
        where: { affiliateId, createdAt: { gte: todayStart } },
        _sum: { amount: true },
      });

      res.json({
        success: true,
        data: {
          commissions,
          summary: {
            totalEarnings: totalEarnings._sum.amount ?? 0,
            pendingAmount: totalPending._sum.amount ?? 0,
            paidAmount: totalPaid._sum.amount ?? 0,
            todayEarnings: todayEarnings._sum.amount ?? 0,
          },
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
  },
);

// ============================================
// GET /affiliates/me/referrals — Affiliate's referral tracking
// ============================================
affiliateRouter.get(
  '/me/referrals',
  requireAuth,
  requireRole('AFFILIATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = referralQuerySchema.parse(req.query);
      const affiliateId = req.user!.userId;

      const where: Record<string, unknown> = { affiliateId };
      if (query.isActive !== undefined) where.isActive = query.isActive;

      const [referrals, total] = await Promise.all([
        prisma.affiliateReferral.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            venue: {
              select: { id: true, name: true, city: true, state: true },
            },
          },
        }),
        prisma.affiliateReferral.count({ where }),
      ]);

      // For each referral, get total earnings from that venue
      const referralsWithEarnings = await Promise.all(
        referrals.map(async (referral) => {
          const earnings = await prisma.commission.aggregate({
            where: {
              affiliateId,
              venueId: referral.venueId,
              type: 'VENUE_REFERRAL',
            },
            _sum: { amount: true },
          });
          return {
            ...referral,
            totalEarnings: earnings._sum.amount ?? 0,
          };
        }),
      );

      res.json({
        success: true,
        data: {
          referrals: referralsWithEarnings,
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
  },
);

// ============================================
// GET /affiliates/me/qr — Get affiliate QR code data
// ============================================
affiliateRouter.get(
  '/me/qr',
  requireAuth,
  requireRole('AFFILIATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, name: true, referralCode: true },
      });

      if (!user || !user.referralCode) {
        throw new AppError('Referral code not found', 404);
      }

      // The QR code data that customer apps will scan
      const qrData = {
        type: 'affiliate_referral',
        code: user.referralCode,
        affiliateId: user.id,
        affiliateName: user.name,
      };

      res.json({
        success: true,
        data: {
          referralCode: user.referralCode,
          qrData: JSON.stringify(qrData),
          shareUrl: `${process.env.APP_URL || 'https://solodevs.net'}/?ref=${user.referralCode}`,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// GET /affiliates/me/summary — Earnings summary (daily/monthly/yearly)
// ============================================
affiliateRouter.get(
  '/me/summary',
  requireAuth,
  requireRole('AFFILIATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const affiliateId = req.user!.userId;
      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [daily, monthly, yearly, total] = await Promise.all([
        prisma.commission.aggregate({
          where: { affiliateId, createdAt: { gte: todayStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.commission.aggregate({
          where: { affiliateId, createdAt: { gte: monthStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.commission.aggregate({
          where: { affiliateId, createdAt: { gte: yearStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.commission.aggregate({
          where: { affiliateId },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      const activeReferrals = await prisma.affiliateReferral.count({
        where: { affiliateId, isActive: true },
      });

      res.json({
        success: true,
        data: {
          daily: { amount: daily._sum.amount ?? 0, count: daily._count },
          monthly: { amount: monthly._sum.amount ?? 0, count: monthly._count },
          yearly: { amount: yearly._sum.amount ?? 0, count: yearly._count },
          total: { amount: total._sum.amount ?? 0, count: total._count },
          activeReferrals,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
