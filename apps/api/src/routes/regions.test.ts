import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    venue: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    machine: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    wallet: { findUnique: vi.fn(), create: vi.fn() },
    globalConfig: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
    machineAlert: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    song: { findFirst: vi.fn(), create: vi.fn() },
    songRequest: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: { count: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
    region: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    regionCatalog: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock('../socket.js', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
}));

vi.mock('../lib/stripe.js', () => ({
  createPaymentIntent: vi.fn(), createCustomer: vi.fn(), attachPaymentMethod: vi.fn(),
  listPaymentMethods: vi.fn(), constructWebhookEvent: vi.fn(),
}));

vi.mock('../lib/pushNotifications.js', () => ({
  getVapidPublicKey: vi.fn().mockReturnValue('test-vapid-key'),
  sendPushNotification: vi.fn(), notifyUser: vi.fn(), notifyRole: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const REGION_ID = '00000000-0000-0000-0000-000000000090';
const ENTRY_ID = '00000000-0000-0000-0000-000000000091';
const GENRE_ID = '00000000-0000-0000-0000-000000000080';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => { vi.clearAllMocks(); });

describe('Region Routes', () => {
  describe('GET /api/v1/regions', () => {
    it('lists active regions', async () => {
      mockPrisma.region.findMany.mockResolvedValue([
        { id: REGION_ID, code: 'SP', name: 'São Paulo', _count: { venues: 5, catalogEntries: 10 } },
      ]);

      const res = await request(app).get('/api/v1/regions');
      expect(res.status).toBe(200);
      expect(res.body.data.regions).toHaveLength(1);
      expect(res.body.data.regions[0].code).toBe('SP');
    });
  });

  describe('POST /api/v1/regions', () => {
    it('admin can create region', async () => {
      mockPrisma.region.findUnique.mockResolvedValue(null);
      mockPrisma.region.create.mockResolvedValue({ id: REGION_ID, code: 'RJ', name: 'Rio de Janeiro' });

      const res = await request(app)
        .post('/api/v1/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'RJ', name: 'Rio de Janeiro' });

      expect(res.status).toBe(201);
      expect(res.body.data.region.code).toBe('RJ');
    });

    it('rejects duplicate code', async () => {
      mockPrisma.region.findUnique.mockResolvedValue({ id: REGION_ID, code: 'SP' });

      const res = await request(app)
        .post('/api/v1/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'SP', name: 'São Paulo' });

      expect(res.status).toBe(409);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/regions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'MG', name: 'Minas Gerais' });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/regions/:id', () => {
    it('admin can update region', async () => {
      mockPrisma.region.findUnique.mockResolvedValue({ id: REGION_ID });
      mockPrisma.region.update.mockResolvedValue({ id: REGION_ID, name: 'Updated' });

      const res = await request(app)
        .put(`/api/v1/regions/${REGION_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent region', async () => {
      mockPrisma.region.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/regions/${REGION_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/regions/:id/catalog', () => {
    it('returns catalog entries for region', async () => {
      mockPrisma.region.findUnique.mockResolvedValue({ id: REGION_ID });
      mockPrisma.regionCatalog.findMany.mockResolvedValue([
        { id: ENTRY_ID, regionId: REGION_ID, genreId: GENRE_ID, priority: 10 },
      ]);

      const res = await request(app).get(`/api/v1/regions/${REGION_ID}/catalog`);
      expect(res.status).toBe(200);
      expect(res.body.data.entries).toHaveLength(1);
    });
  });

  describe('POST /api/v1/regions/:id/catalog', () => {
    it('admin can add genre to region catalog', async () => {
      mockPrisma.region.findUnique.mockResolvedValue({ id: REGION_ID });
      mockPrisma.regionCatalog.create.mockResolvedValue({
        id: ENTRY_ID, regionId: REGION_ID, genreId: GENRE_ID, priority: 5,
      });

      const res = await request(app)
        .post(`/api/v1/regions/${REGION_ID}/catalog`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ genreId: GENRE_ID, priority: 5 });

      expect(res.status).toBe(201);
    });

    it('rejects if no genreId/artistId/songId provided', async () => {
      const res = await request(app)
        .post(`/api/v1/regions/${REGION_ID}/catalog`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 5 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/regions/:id/catalog/:entryId', () => {
    it('admin can remove catalog entry', async () => {
      mockPrisma.regionCatalog.findUnique.mockResolvedValue({ id: ENTRY_ID, regionId: REGION_ID });
      mockPrisma.regionCatalog.delete.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/v1/regions/${REGION_ID}/catalog/${ENTRY_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('rejects if entry does not belong to region', async () => {
      mockPrisma.regionCatalog.findUnique.mockResolvedValue({ id: ENTRY_ID, regionId: 'other-region' });

      const res = await request(app)
        .delete(`/api/v1/regions/${REGION_ID}/catalog/${ENTRY_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});
