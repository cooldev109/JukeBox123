import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
    },
    venueProductPrice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    comboItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    machine: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    machineAlert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    song: { findFirst: vi.fn(), create: vi.fn() },
    songRequest: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: { count: vi.fn() },
    $transaction: vi.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock('../socket.js', () => ({
  getIO: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  }),
}));

vi.mock('../lib/stripe.js', () => ({
  createPaymentIntent: vi.fn(),
  createCustomer: vi.fn(),
  attachPaymentMethod: vi.fn(),
  listPaymentMethods: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));

vi.mock('../lib/pushNotifications.js', () => ({
  getVapidPublicKey: vi.fn().mockReturnValue('test-vapid-key'),
  sendPushNotification: vi.fn(),
  notifyUser: vi.fn(),
  notifyRole: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000002';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const VENUE_ID = '00000000-0000-0000-0000-000000000020';
const PRODUCT_ID = '00000000-0000-0000-0000-000000000040';
const COMBO_ID = '00000000-0000-0000-0000-000000000041';
const COMBO_ITEM_ID = '00000000-0000-0000-0000-000000000042';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: OWNER_ID, role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Product Routes', () => {
  // -----------------------------------------------
  // GET /products — Public list
  // -----------------------------------------------
  describe('GET /api/v1/products', () => {
    it('returns active products', async () => {
      const products = [
        { id: PRODUCT_ID, code: 'SONG', name: 'Regular Song', category: 'MUSIC', basePrice: 1.20, isActive: true, comboItems: [] },
      ];
      mockPrisma.product.findMany.mockResolvedValue(products);

      const res = await request(app).get('/api/v1/products');

      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(1);
      expect(res.body.data.products[0].code).toBe('SONG');
    });
  });

  // -----------------------------------------------
  // GET /products/all — Admin list (includes inactive)
  // -----------------------------------------------
  describe('GET /api/v1/products/all', () => {
    it('admin can list all products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: PRODUCT_ID, code: 'SONG', name: 'Song', isActive: true, comboItems: [] },
        { id: '2', code: 'OLD', name: 'Old Product', isActive: false, comboItems: [] },
      ]);

      const res = await request(app)
        .get('/api/v1/products/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(2);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/products/all')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /products — Admin creates product
  // -----------------------------------------------
  describe('POST /api/v1/products', () => {
    it('admin can create a product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null); // no duplicate
      mockPrisma.product.create.mockResolvedValue({
        id: PRODUCT_ID,
        code: 'MEME',
        name: 'Meme',
        category: 'SPECIAL_EVENT',
        basePrice: 1.00,
      });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'MEME', name: 'Meme', category: 'SPECIAL_EVENT', basePrice: 1.00 });

      expect(res.status).toBe(201);
      expect(res.body.data.product.code).toBe('MEME');
    });

    it('rejects duplicate code', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, code: 'SONG' });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'SONG', name: 'Song', category: 'MUSIC', basePrice: 1.00 });

      expect(res.status).toBe(409);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'TEST', name: 'Test', category: 'MUSIC', basePrice: 1.00 });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // PUT /products/:id — Admin edits product
  // -----------------------------------------------
  describe('PUT /api/v1/products/:id', () => {
    it('admin can update a product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, code: 'SONG', basePrice: 1.20 });
      mockPrisma.product.update.mockResolvedValue({ id: PRODUCT_ID, code: 'SONG', name: 'Updated Song', basePrice: 1.50 });

      const res = await request(app)
        .put(`/api/v1/products/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Song', basePrice: 1.50 });

      expect(res.status).toBe(200);
      expect(res.body.data.product.basePrice).toBe(1.50);
    });

    it('returns 404 for non-existent product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/products/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------
  // DELETE /products/:id — Admin deactivates
  // -----------------------------------------------
  describe('DELETE /api/v1/products/:id', () => {
    it('admin can deactivate a product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: PRODUCT_ID });
      mockPrisma.product.update.mockResolvedValue({ id: PRODUCT_ID, isActive: false });

      const res = await request(app)
        .delete(`/api/v1/products/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -----------------------------------------------
  // POST /products/:id/combo-items — Admin adds to combo
  // -----------------------------------------------
  describe('POST /api/v1/products/:id/combo-items', () => {
    it('admin can add product to combo', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: COMBO_ID, category: 'COMBO' }) // combo
        .mockResolvedValueOnce({ id: PRODUCT_ID, category: 'SPECIAL_EVENT' }); // product to add
      mockPrisma.comboItem.create.mockResolvedValue({
        id: COMBO_ITEM_ID,
        comboId: COMBO_ID,
        productId: PRODUCT_ID,
        quantity: 1,
        product: { id: PRODUCT_ID, code: 'SILENCE_60S', name: 'Silence 60s', basePrice: 5.00 },
      });

      const res = await request(app)
        .post(`/api/v1/products/${COMBO_ID}/combo-items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: PRODUCT_ID, quantity: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data.comboItem.productId).toBe(PRODUCT_ID);
    });

    it('rejects adding to non-combo product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, category: 'MUSIC' });

      const res = await request(app)
        .post(`/api/v1/products/${PRODUCT_ID}/combo-items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: PRODUCT_ID, quantity: 1 });

      expect(res.status).toBe(400);
    });

    it('rejects adding combo inside combo', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: COMBO_ID, category: 'COMBO' }) // parent combo
        .mockResolvedValueOnce({ id: '99', category: 'COMBO' }); // child combo

      const res = await request(app)
        .post(`/api/v1/products/${COMBO_ID}/combo-items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: '99', quantity: 1 });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // DELETE /products/:id/combo-items/:itemId
  // -----------------------------------------------
  describe('DELETE /api/v1/products/:id/combo-items/:itemId', () => {
    it('admin can remove combo item', async () => {
      mockPrisma.comboItem.findUnique.mockResolvedValue({ id: COMBO_ITEM_ID, comboId: COMBO_ID });
      mockPrisma.comboItem.delete.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/v1/products/${COMBO_ID}/combo-items/${COMBO_ITEM_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('rejects if item does not belong to combo', async () => {
      mockPrisma.comboItem.findUnique.mockResolvedValue({ id: COMBO_ITEM_ID, comboId: 'other-combo' });

      const res = await request(app)
        .delete(`/api/v1/products/${COMBO_ID}/combo-items/${COMBO_ITEM_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // GET /products/venue/:venueId — Venue-specific pricing
  // -----------------------------------------------
  describe('GET /api/v1/products/venue/:venueId', () => {
    it('returns products with venue price overrides', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID });
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: PRODUCT_ID, code: 'SONG', name: 'Song', category: 'MUSIC',
          basePrice: 1.20, description: null, metadata: {}, sortOrder: 1, isActive: true,
          venuePrices: [{ price: 1.50, isActive: true }],
          comboItems: [],
        },
        {
          id: '2', code: 'MEME', name: 'Meme', category: 'SPECIAL_EVENT',
          basePrice: 1.00, description: null, metadata: {}, sortOrder: 41, isActive: true,
          venuePrices: [],
          comboItems: [],
        },
      ]);

      const res = await request(app).get(`/api/v1/products/venue/${VENUE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(2);
      // First product has venue override
      expect(res.body.data.products[0].price).toBe(1.50);
      expect(res.body.data.products[0].hasVenueOverride).toBe(true);
      // Second product uses base price
      expect(res.body.data.products[1].price).toBe(1.00);
      expect(res.body.data.products[1].hasVenueOverride).toBe(false);
    });

    it('filters out venue-disabled products', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID });
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: PRODUCT_ID, code: 'SONG', name: 'Song', category: 'MUSIC',
          basePrice: 1.20, description: null, metadata: {}, sortOrder: 1, isActive: true,
          venuePrices: [{ price: 1.50, isActive: false }], // disabled
          comboItems: [],
        },
      ]);

      const res = await request(app).get(`/api/v1/products/venue/${VENUE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(0);
    });
  });

  // -----------------------------------------------
  // PUT /products/venue/:venueId/prices — Batch update
  // -----------------------------------------------
  describe('PUT /api/v1/products/venue/:venueId/prices', () => {
    it('admin can batch update venue prices', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, ownerId: OWNER_ID });
      mockPrisma.venueProductPrice.upsert.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const res = await request(app)
        .put(`/api/v1/products/venue/${VENUE_ID}/prices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          prices: [
            { productId: PRODUCT_ID, price: 1.50, isActive: true },
            { productId: COMBO_ID, price: 20.00, isActive: true },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
    });

    it('bar owner can update their own venue prices', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, ownerId: OWNER_ID });
      mockPrisma.$transaction.mockResolvedValue([{}]);

      const res = await request(app)
        .put(`/api/v1/products/venue/${VENUE_ID}/prices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ prices: [{ productId: PRODUCT_ID, price: 1.50, isActive: true }] });

      expect(res.status).toBe(200);
    });

    it('bar owner cannot update other venue prices', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, ownerId: 'other-owner' });

      const res = await request(app)
        .put(`/api/v1/products/venue/${VENUE_ID}/prices`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ prices: [{ productId: PRODUCT_ID, price: 1.50, isActive: true }] });

      expect(res.status).toBe(403);
    });
  });
});
