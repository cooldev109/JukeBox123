import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

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
