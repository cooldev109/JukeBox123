import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const regionRouter = Router();

// ============================================
// Validation schemas
// ============================================
const createRegionSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1).max(100),
  country: z.string().max(5).default('BR'),
});

const updateRegionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  country: z.string().max(5).optional(),
  isActive: z.boolean().optional(),
});

const addCatalogSchema = z.object({
  genreId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  songId: z.string().uuid().optional(),
  priority: z.number().int().default(0),
}).refine(data => data.genreId || data.artistId || data.songId, {
  message: 'At least one of genreId, artistId, or songId is required',
});

// ============================================
// GET /regions — List all regions
// ============================================
regionRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { venues: true, catalogEntries: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: { regions } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /regions — Admin creates region
// ============================================
regionRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRegionSchema.parse(req.body);

    const existing = await prisma.region.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError('Region code already exists', 409);

    const region = await prisma.region.create({ data });
    res.status(201).json({ success: true, data: { region } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// PUT /regions/:id — Admin edits region
// ============================================
regionRouter.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateRegionSchema.parse(req.body);
    const { id } = req.params;

    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) throw new AppError('Region not found', 404);

    const region = await prisma.region.update({ where: { id }, data });
    res.json({ success: true, data: { region } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// GET /regions/:id/catalog — Region's catalog assignments
// ============================================
regionRouter.get('/:id/catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const region = await prisma.region.findUnique({ where: { id } });
    if (!region) throw new AppError('Region not found', 404);

    const entries = await prisma.regionCatalog.findMany({
      where: { regionId: id },
      include: { genre: { select: { id: true, name: true } } },
      orderBy: { priority: 'desc' },
    });

    res.json({ success: true, data: { entries } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /regions/:id/catalog — Admin assigns to region
// ============================================
regionRouter.post('/:id/catalog', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addCatalogSchema.parse(req.body);
    const { id } = req.params;

    const region = await prisma.region.findUnique({ where: { id } });
    if (!region) throw new AppError('Region not found', 404);

    const entry = await prisma.regionCatalog.create({
      data: {
        regionId: id,
        genreId: data.genreId || null,
        artistId: data.artistId || null,
        songId: data.songId || null,
        priority: data.priority,
      },
    });

    res.status(201).json({ success: true, data: { entry } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// DELETE /regions/:id/catalog/:entryId — Remove from region
// ============================================
regionRouter.delete('/:id/catalog/:entryId', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, entryId } = req.params;

    const entry = await prisma.regionCatalog.findUnique({ where: { id: entryId } });
    if (!entry) throw new AppError('Catalog entry not found', 404);
    if (entry.regionId !== id) throw new AppError('Entry does not belong to this region', 400);

    await prisma.regionCatalog.delete({ where: { id: entryId } });
    res.json({ success: true, message: 'Catalog entry removed' });
  } catch (error) {
    next(error);
  }
});
