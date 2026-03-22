import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const productRouter = Router();

// ============================================
// Validation schemas
// ============================================
const createProductSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['MUSIC', 'SPECIAL_EVENT', 'COMBO']),
  basePrice: z.number().min(0),
  sortOrder: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  basePrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const addComboItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

const batchVenuePricesSchema = z.object({
  prices: z.array(z.object({
    productId: z.string().uuid(),
    price: z.number().min(0),
    isActive: z.boolean().default(true),
  })),
});

// ============================================
// GET /products — List all products (public)
// ============================================
productRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        comboItems: {
          include: { product: { select: { id: true, code: true, name: true, basePrice: true } } },
        },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /products/all — List all products including inactive (admin)
// ============================================
productRouter.get('/all', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        comboItems: {
          include: { product: { select: { id: true, code: true, name: true, basePrice: true } } },
        },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /products/venue/:venueId — Products with venue-specific pricing
// ============================================
productRouter.get('/venue/:venueId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId } = req.params;

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new AppError('Venue not found', 404);

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        venuePrices: { where: { venueId } },
        comboItems: {
          include: { product: { select: { id: true, code: true, name: true, basePrice: true } } },
        },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Merge venue prices: if venue has a price override, use it
    const result = products
      .filter(p => {
        const venuePrice = p.venuePrices[0];
        // If venue has explicitly disabled this product, skip it
        if (venuePrice && !venuePrice.isActive) return false;
        return true;
      })
      .map(p => {
        const venuePrice = p.venuePrices[0];
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.category,
          basePrice: p.basePrice,
          price: venuePrice ? venuePrice.price : p.basePrice,
          hasVenueOverride: !!venuePrice,
          metadata: p.metadata,
          sortOrder: p.sortOrder,
          comboItems: p.comboItems.map(ci => ({
            id: ci.id,
            product: ci.product,
            quantity: ci.quantity,
          })),
        };
      });

    res.json({ success: true, data: { products: result } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /products — Admin creates product
// ============================================
productRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProductSchema.parse(req.body);

    // Check code uniqueness
    const existing = await prisma.product.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError('Product code already exists', 409);

    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category,
        basePrice: data.basePrice,
        sortOrder: data.sortOrder ?? 0,
        metadata: data.metadata ?? {},
      },
    });

    res.status(201).json({ success: true, data: { product } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// PUT /products/:id — Admin edits product
// ============================================
productRouter.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProductSchema.parse(req.body);
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404);

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: { product } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// DELETE /products/:id — Admin deactivates product
// ============================================
productRouter.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404);

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /products/:id/combo-items — Admin adds product to combo
// ============================================
productRouter.post('/:id/combo-items', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addComboItemSchema.parse(req.body);
    const comboId = req.params.id;

    const combo = await prisma.product.findUnique({ where: { id: comboId } });
    if (!combo) throw new AppError('Combo product not found', 404);
    if (combo.category !== 'COMBO') throw new AppError('Product is not a combo', 400);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new AppError('Product to add not found', 404);
    if (product.category === 'COMBO') throw new AppError('Cannot add a combo inside a combo', 400);

    const item = await prisma.comboItem.create({
      data: {
        comboId,
        productId: data.productId,
        quantity: data.quantity,
      },
      include: { product: { select: { id: true, code: true, name: true, basePrice: true } } },
    });

    res.status(201).json({ success: true, data: { comboItem: item } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});

// ============================================
// DELETE /products/:id/combo-items/:itemId — Admin removes from combo
// ============================================
productRouter.delete('/:id/combo-items/:itemId', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;

    const item = await prisma.comboItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Combo item not found', 404);
    if (item.comboId !== id) throw new AppError('Combo item does not belong to this product', 400);

    await prisma.comboItem.delete({ where: { id: itemId } });

    res.json({ success: true, message: 'Combo item removed' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /products/venue/:venueId/prices — Get all venue-specific prices
// ============================================
productRouter.get('/venue/:venueId/prices', requireAuth, requireRole('ADMIN', 'BAR_OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId } = req.params;

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new AppError('Venue not found', 404);

    // Bar owners can only see their own venue prices
    if (req.user!.role === 'BAR_OWNER' && venue.ownerId !== req.user!.userId) {
      throw new AppError('You can only view prices for your own venues', 403);
    }

    const venuePrices = await prisma.venueProductPrice.findMany({
      where: { venueId },
      include: { product: { select: { id: true, code: true, name: true, category: true, basePrice: true } } },
    });

    res.json({ success: true, data: { prices: venuePrices } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /products/venue/:venueId/prices — Batch update venue prices
// ============================================
productRouter.put('/venue/:venueId/prices', requireAuth, requireRole('ADMIN', 'BAR_OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = batchVenuePricesSchema.parse(req.body);
    const { venueId } = req.params;

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new AppError('Venue not found', 404);

    if (req.user!.role === 'BAR_OWNER' && venue.ownerId !== req.user!.userId) {
      throw new AppError('You can only update prices for your own venues', 403);
    }

    // Validate no negative prices
    for (const p of data.prices) {
      if (p.price < 0) throw new AppError('Price cannot be negative', 400);
    }

    const results = await prisma.$transaction(
      data.prices.map(p =>
        prisma.venueProductPrice.upsert({
          where: { venueId_productId: { venueId, productId: p.productId } },
          update: { price: p.price, isActive: p.isActive },
          create: { venueId, productId: p.productId, price: p.price, isActive: p.isActive },
        }),
      ),
    );

    res.json({ success: true, data: { updated: results.length } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
    next(error);
  }
});
