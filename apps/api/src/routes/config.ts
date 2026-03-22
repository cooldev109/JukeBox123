import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getVenueSplitConfig } from '../services/revenueSplit.js';

export const configRouter = Router();

// ============================================
// Validation schemas
// ============================================
const updateGlobalConfigSchema = z.object({
  defaultPricing: z.object({
    songPrice: z.number().nonnegative().optional(),
    prioritySongPrice: z.number().nonnegative().optional(),
    creditTopUpAmounts: z.array(z.number().positive()).optional(),
    defaultCommissionPercent: z.number().min(0).max(100).optional(),
    currency: z.string().length(3).optional(),
  }).optional(),
  featureToggles: z.record(z.boolean()).optional(),
});

// ============================================
// Known global config keys
// ============================================
const CONFIG_KEYS = {
  DEFAULT_PRICING: 'defaultPricing',
  FEATURE_TOGGLES: 'featureToggles',
} as const;

// ============================================
// GET /config/global — Get all global config
// ============================================
configRouter.get('/global', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.globalConfig.findMany({
      where: {
        key: {
          in: [CONFIG_KEYS.DEFAULT_PRICING, CONFIG_KEYS.FEATURE_TOGGLES],
        },
      },
    });

    // Build a key-value map from the results
    const configMap: Record<string, unknown> = {};
    for (const config of configs) {
      configMap[config.key] = config.value;
    }

    // Return with defaults if keys don't exist yet
    const defaultPricing = configMap[CONFIG_KEYS.DEFAULT_PRICING] ?? {
      songPrice: 2.00,
      prioritySongPrice: 5.00,
      creditTopUpAmounts: [10, 20, 50, 100],
      defaultCommissionPercent: 30,
      currency: 'BRL',
    };

    const featureToggles = configMap[CONFIG_KEYS.FEATURE_TOGGLES] ?? {
      pixPayments: true,
      walletPayments: true,
      priorityQueue: true,
      songRequests: true,
      whatsappIntegration: false,
      catalogBot: false,
      specialEvents: false,
    };

    res.json({
      success: true,
      data: {
        defaultPricing,
        featureToggles,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /config/global — Update global config (ADMIN only)
// ============================================
configRouter.put('/global', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateGlobalConfigSchema.parse(req.body);

    // At least one field must be provided
    if (!data.defaultPricing && !data.featureToggles) {
      throw new AppError('At least one config field (defaultPricing or featureToggles) is required', 400);
    }

    // Use a Prisma transaction to update all config keys atomically
    const results = await prisma.$transaction(async (tx) => {
      const updated: Record<string, unknown> = {};

      if (data.defaultPricing) {
        // Get existing value to merge (partial updates)
        const existing = await tx.globalConfig.findUnique({
          where: { key: CONFIG_KEYS.DEFAULT_PRICING },
        });

        const mergedValue = (existing
          ? { ...(existing.value as Record<string, unknown>), ...data.defaultPricing }
          : data.defaultPricing) as Prisma.InputJsonValue;

        const result = await tx.globalConfig.upsert({
          where: { key: CONFIG_KEYS.DEFAULT_PRICING },
          update: { value: mergedValue },
          create: {
            key: CONFIG_KEYS.DEFAULT_PRICING,
            value: mergedValue,
          },
        });
        updated[CONFIG_KEYS.DEFAULT_PRICING] = result.value;
      }

      if (data.featureToggles) {
        // Get existing value to merge (partial updates)
        const existing = await tx.globalConfig.findUnique({
          where: { key: CONFIG_KEYS.FEATURE_TOGGLES },
        });

        const mergedValue = (existing
          ? { ...(existing.value as Record<string, unknown>), ...data.featureToggles }
          : data.featureToggles) as Prisma.InputJsonValue;

        const result = await tx.globalConfig.upsert({
          where: { key: CONFIG_KEYS.FEATURE_TOGGLES },
          update: { value: mergedValue },
          create: {
            key: CONFIG_KEYS.FEATURE_TOGGLES,
            value: mergedValue,
          },
        });
        updated[CONFIG_KEYS.FEATURE_TOGGLES] = result.value;
      }

      return updated;
    });

    // Fetch full config state after update
    const allConfigs = await prisma.globalConfig.findMany({
      where: {
        key: {
          in: [CONFIG_KEYS.DEFAULT_PRICING, CONFIG_KEYS.FEATURE_TOGGLES],
        },
      },
    });

    const configMap: Record<string, unknown> = {};
    for (const config of allConfigs) {
      configMap[config.key] = config.value;
    }

    res.json({
      success: true,
      data: {
        defaultPricing: configMap[CONFIG_KEYS.DEFAULT_PRICING] ?? results[CONFIG_KEYS.DEFAULT_PRICING],
        featureToggles: configMap[CONFIG_KEYS.FEATURE_TOGGLES] ?? results[CONFIG_KEYS.FEATURE_TOGGLES],
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
// Commission Split Config
// ============================================
const commissionSplitSchema = z.object({
  platformPercent: z.number().min(0).max(100),
  venuePercent: z.number().min(0).max(100),
  affiliatePercent: z.number().min(0).max(100),
  operatorPercent: z.number().min(0).max(100),
}).refine(data => {
  const sum = data.platformPercent + data.venuePercent + data.affiliatePercent + data.operatorPercent;
  return Math.abs(sum - 100) < 0.01;
}, { message: 'Commission percentages must sum to 100%' });

// ============================================
// GET /config/commission-split — Global default split
// ============================================
configRouter.get('/commission-split', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.globalConfig.findUnique({
      where: { key: 'defaultCommissionSplit' },
    });

    const split = config?.value ?? {
      platformPercent: 30,
      venuePercent: 30,
      affiliatePercent: 35,
      operatorPercent: 5,
    };

    res.json({ success: true, data: { split } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /config/commission-split — Admin updates global default
// ============================================
configRouter.put('/commission-split', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = commissionSplitSchema.parse(req.body);

    const result = await prisma.globalConfig.upsert({
      where: { key: 'defaultCommissionSplit' },
      update: { value: data as unknown as Prisma.InputJsonValue },
      create: { key: 'defaultCommissionSplit', value: data as unknown as Prisma.InputJsonValue },
    });

    res.json({ success: true, data: { split: result.value } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// GET /config/venue/:id/commission-split — Venue-specific split
// ============================================
configRouter.get('/venue/:id/commission-split', requireAuth, requireRole('ADMIN', 'BAR_OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new AppError('Venue not found', 404);

    if (req.user!.role === 'BAR_OWNER' && venue.ownerId !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    const split = await getVenueSplitConfig(id);
    const venueSettings = (venue.settings || {}) as Record<string, unknown>;
    const hasOverride = !!venueSettings.commissionSplit;

    res.json({ success: true, data: { split, hasOverride } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /config/venue/:id/commission-split — Admin updates venue split
// ============================================
configRouter.put('/venue/:id/commission-split', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = commissionSplitSchema.parse(req.body);
    const { id } = req.params;

    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new AppError('Venue not found', 404);

    const currentSettings = (venue.settings || {}) as Record<string, unknown>;
    const updatedSettings = { ...currentSettings, commissionSplit: data };

    await prisma.venue.update({
      where: { id },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    res.json({ success: true, data: { split: data } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});
