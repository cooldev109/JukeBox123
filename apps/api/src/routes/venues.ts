import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, requireVenueAccess } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const venueRouter = Router();

// ============================================
// Validation schemas
// ============================================
const createVenueSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  country: z.string().length(2).default('BR'),
  ownerId: z.string().uuid(),
  timezone: z.string().default('America/Sao_Paulo'),
  currency: z.string().length(3).default('BRL'),
  settings: z.object({
    songPrice: z.number().nonnegative().optional(),
    prioritySongPrice: z.number().nonnegative().optional(),
    creditTopUpAmounts: z.array(z.number().positive()).optional(),
    barOwnerCommissionPercent: z.number().min(0).max(100).optional(),
    featureToggles: z.record(z.boolean()).optional(),
  }).optional(),
  installDate: z.string().datetime().optional(),
});

const updateVenueSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(5).max(500).optional(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  country: z.string().length(2).optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  settings: z.object({
    songPrice: z.number().nonnegative().optional(),
    prioritySongPrice: z.number().nonnegative().optional(),
    creditTopUpAmounts: z.array(z.number().positive()).optional(),
    barOwnerCommissionPercent: z.number().min(0).max(100).optional(),
    featureToggles: z.record(z.boolean()).optional(),
  }).optional(),
  installDate: z.string().datetime().optional().nullable(),
});

const pricingSchema = z.object({
  songPrice: z.number().nonnegative().optional(),
  prioritySongPrice: z.number().nonnegative().optional(),
  creditTopUpAmounts: z.array(z.number().positive()).optional(),
  barOwnerCommissionPercent: z.number().min(0).max(100).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  search: z.string().optional(),
});

// ============================================
// GET /venues — List venues
// ============================================
venueRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const user = req.user!;

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    // BAR_OWNER can only see their own venues
    if (user.role === 'BAR_OWNER') {
      where.ownerId = user.userId;
    }

    // EMPLOYEE can only see venues in their assigned region
    if (user.role === 'EMPLOYEE') {
      const employee = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { regionAccess: true },
      });
      if (employee?.regionAccess) {
        where.OR = [
          { state: employee.regionAccess },
          { city: employee.regionAccess },
        ];
      }
    }

    // CUSTOMER and AFFILIATE should not list venues (they discover via QR code)
    if (user.role === 'CUSTOMER' || user.role === 'AFFILIATE') {
      throw new AppError('Cannot list venues with this role', 403);
    }

    // Optional filters
    if (query.status) where.status = query.status;
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.state) where.state = query.state;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [venues, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          city: true,
          state: true,
          country: true,
          timezone: true,
          currency: true,
          status: true,
          installDate: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { machines: true },
          },
        },
      }),
      prisma.venue.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        venues,
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
// GET /venues/:id — Venue details with machines
// ============================================
venueRouter.get('/:id', requireAuth, requireVenueAccess('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true },
        },
        machines: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
            status: true,
            lastHeartbeat: true,
            ipAddress: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    res.json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /venues — Create venue (ADMIN only)
// ============================================
venueRouter.post('/', requireAuth, requireRole('ADMIN', 'EMPLOYEE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createVenueSchema.parse(req.body);

    // Verify that the owner exists and has BAR_OWNER role
    const owner = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true, role: true, name: true },
    });

    if (!owner) {
      throw new AppError('Owner user not found', 404);
    }

    if (owner.role !== 'BAR_OWNER' && owner.role !== 'ADMIN') {
      throw new AppError('Owner must have BAR_OWNER or ADMIN role', 400);
    }

    // Employee can only create venues in their assigned region
    if (req.user!.role === 'EMPLOYEE') {
      const employee = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { regionAccess: true },
      });
      if (employee?.regionAccess && data.state !== employee.regionAccess && data.city !== employee.regionAccess) {
        throw new AppError('Cannot create venue outside your assigned region', 403);
      }
    }

    const venue = await prisma.venue.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        ownerId: data.ownerId,
        timezone: data.timezone,
        currency: data.currency,
        settings: (data.settings || {}) as Prisma.InputJsonValue,
        installDate: data.installDate ? new Date(data.installDate) : null,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// PUT /venues/:id — Update venue
// ============================================
venueRouter.put('/:id', requireAuth, requireVenueAccess('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateVenueSchema.parse(req.body);
    const venueId = req.params.id as string;

    // Verify venue exists
    const existing = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!existing) {
      throw new AppError('Venue not found', 404);
    }

    // BAR_OWNER cannot change status (only ADMIN can suspend/activate)
    if (req.user!.role === 'BAR_OWNER' && data.status) {
      throw new AppError('Only admins can change venue status', 403);
    }

    // If settings are provided, merge with existing settings
    let mergedSettings: Prisma.InputJsonValue = existing.settings as Prisma.InputJsonValue;
    if (data.settings) {
      mergedSettings = {
        ...(existing.settings as Record<string, unknown>),
        ...data.settings,
      } as Prisma.InputJsonValue;
    }

    const venue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.address && { address: data.address }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
        ...(data.country && { country: data.country }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.currency && { currency: data.currency }),
        ...(data.status && { status: data.status }),
        ...(data.settings && { settings: mergedSettings }),
        ...(data.installDate !== undefined && {
          installDate: data.installDate ? new Date(data.installDate) : null,
        }),
      } as Prisma.VenueUpdateInput,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /venues/:id/pricing — Get venue pricing
// ============================================
venueRouter.get('/:id/pricing', requireAuth, requireVenueAccess('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venueId = req.params.id as string;
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, settings: true, currency: true },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    const settings = venue.settings as Record<string, unknown>;

    // Extract pricing fields from settings, falling back to defaults
    const pricing = {
      songPrice: settings.songPrice ?? null,
      prioritySongPrice: settings.prioritySongPrice ?? null,
      creditTopUpAmounts: settings.creditTopUpAmounts ?? null,
      barOwnerCommissionPercent: settings.barOwnerCommissionPercent ?? null,
      currency: venue.currency,
    };

    res.json({
      success: true,
      data: {
        venueId: venue.id,
        venueName: venue.name,
        pricing,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /venues/:id/pricing — Update venue pricing
// ============================================
venueRouter.put('/:id/pricing', requireAuth, requireVenueAccess('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pricingSchema.parse(req.body);
    const venueId = req.params.id as string;

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, settings: true },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Merge pricing into existing settings
    const existingSettings = venue.settings as Record<string, unknown>;
    const updatedSettings = {
      ...existingSettings,
      ...(data.songPrice !== undefined && { songPrice: data.songPrice }),
      ...(data.prioritySongPrice !== undefined && { prioritySongPrice: data.prioritySongPrice }),
      ...(data.creditTopUpAmounts !== undefined && { creditTopUpAmounts: data.creditTopUpAmounts }),
      ...(data.barOwnerCommissionPercent !== undefined && { barOwnerCommissionPercent: data.barOwnerCommissionPercent }),
    };

    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
      select: { id: true, name: true, settings: true, currency: true },
    });

    const newSettings = updatedVenue.settings as Record<string, unknown>;

    res.json({
      success: true,
      data: {
        venueId: updatedVenue.id,
        venueName: updatedVenue.name,
        pricing: {
          songPrice: newSettings.songPrice ?? null,
          prioritySongPrice: newSettings.prioritySongPrice ?? null,
          creditTopUpAmounts: newSettings.creditTopUpAmounts ?? null,
          barOwnerCommissionPercent: newSettings.barOwnerCommissionPercent ?? null,
          currency: updatedVenue.currency,
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
// PUT /venues/:id/owner — Admin reassign venue to different owner
// ============================================
const reassignOwnerSchema = z.object({
  ownerId: z.string().uuid(),
});

venueRouter.put('/:id/owner', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = reassignOwnerSchema.parse(req.body);
    const venueId = req.params.id as string;

    // Verify venue exists
    const existing = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!existing) {
      throw new AppError('Venue not found', 404);
    }

    // Verify new owner exists and has BAR_OWNER or ADMIN role
    const newOwner = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true, role: true, name: true, email: true },
    });

    if (!newOwner) {
      throw new AppError('Owner user not found', 404);
    }

    if (newOwner.role !== 'BAR_OWNER' && newOwner.role !== 'ADMIN') {
      throw new AppError('Owner must have BAR_OWNER or ADMIN role', 400);
    }

    const venue = await prisma.venue.update({
      where: { id: venueId },
      data: { ownerId: data.ownerId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// DELETE /venues/:id — Admin soft-delete venue
// ============================================
venueRouter.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venueId = req.params.id as string;

    // Verify venue exists
    const existing = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!existing) {
      throw new AppError('Venue not found', 404);
    }

    // Set venue status to SUSPENDED and all its machines to OFFLINE
    await prisma.$transaction([
      prisma.venue.update({
        where: { id: venueId },
        data: { status: 'SUSPENDED' },
      }),
      prisma.machine.updateMany({
        where: { venueId },
        data: { status: 'OFFLINE' },
      }),
    ]);

    res.json({
      success: true,
      message: 'Venue deactivated',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /venues/:id/analytics — Venue analytics dashboard
// ============================================
venueRouter.get(
  '/:id/analytics',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const venue = await prisma.venue.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          machines: {
            select: { id: true, name: true, status: true, lastHeartbeat: true, serialNumber: true },
          },
          productPrices: {
            include: { product: { select: { id: true, code: true, name: true, category: true, basePrice: true } } },
          },
        },
      });

      if (!venue) throw new AppError('Venue not found', 404);

      if (req.user!.role === 'BAR_OWNER' && venue.ownerId !== req.user!.userId) {
        throw new AppError('Access denied', 403);
      }

      const machineIds = venue.machines.map(m => m.id);

      // Revenue summary
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayTx, weekTx, monthTx, allTimeTx] = await Promise.all([
        prisma.transaction.aggregate({
          where: { machineId: { in: machineIds }, status: 'COMPLETED', createdAt: { gte: todayStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { machineId: { in: machineIds }, status: 'COMPLETED', createdAt: { gte: weekStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { machineId: { in: machineIds }, status: 'COMPLETED', createdAt: { gte: monthStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { machineId: { in: machineIds }, status: 'COMPLETED' },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      // Active queue
      const queue = await prisma.queueItem.findMany({
        where: { machineId: { in: machineIds }, status: { in: ['PENDING', 'PLAYING'] } },
        include: {
          song: { select: { id: true, title: true, artist: true, duration: true, coverArtUrl: true } },
          user: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true } },
        },
        orderBy: { position: 'asc' },
        take: 50,
      });

      // Top songs
      const topSongs = await prisma.queueItem.groupBy({
        by: ['songId'],
        where: { machineId: { in: machineIds }, status: 'PLAYED' },
        _count: { songId: true },
        orderBy: { _count: { songId: 'desc' } },
        take: 10,
      });

      // Commission split
      const venueSettings = (venue.settings || {}) as Record<string, unknown>;
      const commissionSplit = venueSettings.commissionSplit ?? null;

      res.json({
        success: true,
        data: {
          venue: {
            id: venue.id,
            code: venue.code,
            name: venue.name,
            address: venue.address,
            city: venue.city,
            state: venue.state,
            country: venue.country,
            status: venue.status,
            owner: venue.owner,
          },
          machines: venue.machines,
          revenue: {
            today: todayTx._sum.amount ?? 0,
            week: weekTx._sum.amount ?? 0,
            month: monthTx._sum.amount ?? 0,
            allTime: allTimeTx._sum.amount ?? 0,
            todayCount: todayTx._count,
          },
          queue,
          topSongs,
          commissionSplit,
          productPrices: venue.productPrices,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
