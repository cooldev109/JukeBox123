import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const revenueRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// ============================================
// Revenue password middleware
// ============================================
async function requireRevenueAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const revenueToken = req.headers['x-revenue-token'] as string;
    if (!revenueToken) throw new AppError('Revenue authentication required', 401);

    try {
      jwt.verify(revenueToken, JWT_SECRET);
    } catch {
      throw new AppError('Revenue token expired or invalid', 401);
    }
    next();
  } catch (error) {
    next(error);
  }
}

// ============================================
// POST /revenue/auth — Verify revenue password
// ============================================
revenueRouter.post('/auth', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password) throw new AppError('Password required', 400);

    const config = await prisma.globalConfig.findUnique({
      where: { key: 'revenuePassword' },
    });

    if (!config) {
      // No password set — allow access with any password (first-time setup)
      const hash = await bcrypt.hash(password, 10);
      await prisma.globalConfig.create({
        data: { key: 'revenuePassword', value: { hash } },
      });
    } else {
      const stored = (config.value as any).hash;
      const valid = await bcrypt.compare(password, stored);
      if (!valid) throw new AppError('Invalid revenue password', 403);
    }

    const token = jwt.sign({ type: 'revenue', userId: req.user!.userId }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ success: true, data: { revenueToken: token, expiresIn: 900 } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /revenue/password — Change revenue password
// ============================================
revenueRouter.put('/password', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) throw new AppError('New password required', 400);

    const config = await prisma.globalConfig.findUnique({ where: { key: 'revenuePassword' } });
    if (config) {
      if (!currentPassword) throw new AppError('Current password required', 400);
      const valid = await bcrypt.compare(currentPassword, (config.value as any).hash);
      if (!valid) throw new AppError('Current password is incorrect', 403);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.globalConfig.upsert({
      where: { key: 'revenuePassword' },
      update: { value: { hash } },
      create: { key: 'revenuePassword', value: { hash } },
    });

    res.json({ success: true, message: 'Revenue password updated' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /revenue/admin — Admin revenue analytics
// ============================================
revenueRouter.get('/admin', requireAuth, requireRole('ADMIN'), requireRevenueAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId, city, state, country, startDate, endDate, type } = req.query;

    // Build transaction filter
    const where: any = { status: 'COMPLETED' };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Location-based filter via venue -> machine
    if (venueId || city || state || country) {
      const venueWhere: any = {};
      if (venueId) venueWhere.id = venueId;
      if (city) venueWhere.city = city;
      if (state) venueWhere.state = state;
      if (country) venueWhere.country = country;

      const venues = await prisma.venue.findMany({ where: venueWhere, select: { id: true } });
      const venueIds = venues.map(v => v.id);
      const machines = await prisma.machine.findMany({
        where: { venueId: { in: venueIds } },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true, venue: { select: { id: true, name: true, city: true, state: true } } } },
        revenueSplits: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Calculate totals
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const platformTotal = transactions.reduce((sum, t) => {
      const split = t.revenueSplits[0];
      return sum + (split?.platformAmount ?? 0);
    }, 0);
    const venueTotal = transactions.reduce((sum, t) => {
      const split = t.revenueSplits[0];
      return sum + (split?.venueAmount ?? 0);
    }, 0);
    const affiliateTotal = transactions.reduce((sum, t) => {
      const split = t.revenueSplits[0];
      return sum + (split?.affiliateAmount ?? 0);
    }, 0);
    const operatorTotal = transactions.reduce((sum, t) => {
      const split = t.revenueSplits[0];
      return sum + (split?.operatorAmount ?? 0);
    }, 0);

    // Group by type
    const byType: Record<string, number> = {};
    for (const t of transactions) {
      byType[t.type] = (byType[t.type] || 0) + t.amount;
    }

    // Group by venue
    const byVenue: Record<string, { name: string; total: number }> = {};
    for (const t of transactions) {
      const venueName = t.machine?.venue?.name || 'Unknown';
      const venueKey = t.machine?.venue?.id || 'unknown';
      if (!byVenue[venueKey]) byVenue[venueKey] = { name: venueName, total: 0 };
      byVenue[venueKey].total += t.amount;
    }

    res.json({
      success: true,
      data: {
        totals: {
          total: Math.round(total * 100) / 100,
          platform: Math.round(platformTotal * 100) / 100,
          venue: Math.round(venueTotal * 100) / 100,
          affiliate: Math.round(affiliateTotal * 100) / 100,
          operator: Math.round(operatorTotal * 100) / 100,
        },
        byType,
        byVenue: Object.values(byVenue),
        transactionCount: transactions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /revenue/admin/export — CSV export
// ============================================
revenueRouter.get('/admin/export', requireAuth, requireRole('ADMIN'), requireRevenueAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = { status: 'COMPLETED' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        machine: { select: { name: true, venue: { select: { name: true, city: true, state: true } } } },
        revenueSplits: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const header = 'Date,Type,Amount,User,Venue,City,State,Platform,VenueCut,Affiliate,Operator\n';
    const rows = transactions.map(t => {
      const split = t.revenueSplits[0];
      return [
        t.createdAt.toISOString(),
        t.type,
        t.amount.toFixed(2),
        t.user.name,
        t.machine?.venue?.name || '',
        t.machine?.venue?.city || '',
        t.machine?.venue?.state || '',
        split?.platformAmount?.toFixed(2) || '0.00',
        split?.venueAmount?.toFixed(2) || '0.00',
        split?.affiliateAmount?.toFixed(2) || '0.00',
        split?.operatorAmount?.toFixed(2) || '0.00',
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue-export.csv');
    res.send(header + rows);
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /revenue/venue/:id — Bar Owner revenue
// ============================================
revenueRouter.get('/venue/:id', requireAuth, requireRole('BAR_OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { startDate, endDate, type } = req.query;

    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new AppError('Venue not found', 404);
    if (req.user!.role === 'BAR_OWNER' && venue.ownerId !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    const machines = await prisma.machine.findMany({
      where: { venueId: id },
      select: { id: true },
    });
    const machineIds = machines.map(m => m.id);

    const where: any = { machineId: { in: machineIds }, status: 'COMPLETED' };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { revenueSplits: { where: { venueId: id } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const venueCut = transactions.reduce((sum, t: any) => {
      return sum + (t.revenueSplits[0]?.venueAmount ?? 0);
    }, 0);

    const byType: Record<string, number> = {};
    for (const t of transactions) {
      byType[t.type] = (byType[t.type] || 0) + t.amount;
    }

    res.json({
      success: true,
      data: {
        total: Math.round(total * 100) / 100,
        venueCut: Math.round(venueCut * 100) / 100,
        byType,
        transactionCount: transactions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /revenue/affiliate — Affiliate commissions
// ============================================
revenueRouter.get('/affiliate', requireAuth, requireRole('AFFILIATE', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.role === 'AFFILIATE' ? req.user!.userId : (req.query.affiliateId as string);
    if (!userId) throw new AppError('Affiliate ID required', 400);

    const splits = await prisma.revenueSplit.findMany({
      where: { affiliateId: userId },
      include: {
        transaction: { select: { type: true, amount: true, createdAt: true } },
        venue: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const totalEarned = splits.reduce((sum, s) => sum + s.affiliateAmount, 0);

    res.json({
      success: true,
      data: {
        totalEarned: Math.round(totalEarned * 100) / 100,
        splitCount: splits.length,
        splits: splits.map(s => ({
          id: s.id,
          amount: s.affiliateAmount,
          percent: s.affiliatePercent,
          transactionType: s.transaction.type,
          transactionAmount: s.transaction.amount,
          venueName: s.venue.name,
          date: s.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /revenue/operator — Employee/Operator cut
// ============================================
revenueRouter.get('/operator', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.role === 'EMPLOYEE' ? req.user!.userId : (req.query.operatorId as string);
    if (!userId) throw new AppError('Operator ID required', 400);

    const splits = await prisma.revenueSplit.findMany({
      where: { operatorId: userId },
      include: {
        transaction: { select: { type: true, amount: true, createdAt: true } },
        venue: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const totalEarned = splits.reduce((sum, s) => sum + s.operatorAmount, 0);

    res.json({
      success: true,
      data: {
        totalEarned: Math.round(totalEarned * 100) / 100,
        splitCount: splits.length,
        splits: splits.map(s => ({
          id: s.id,
          amount: s.operatorAmount,
          percent: s.operatorPercent,
          transactionType: s.transaction.type,
          transactionAmount: s.transaction.amount,
          venueName: s.venue.name,
          date: s.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
