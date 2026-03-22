import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    venue: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    machine: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    wallet: { findUnique: vi.fn(), create: vi.fn() },
    globalConfig: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
    machineAlert: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    song: { findFirst: vi.fn(), create: vi.fn() },
    songRequest: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: { count: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
    transaction: { findMany: vi.fn() },
    revenueSplit: { findMany: vi.fn() },
    region: { findMany: vi.fn() },
    regionCatalog: { findMany: vi.fn() },
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
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = createApp();
const mockPrisma = prisma as any;

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000002';
const AFFILIATE_ID = '00000000-0000-0000-0000-000000000060';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000070';
const VENUE_ID = '00000000-0000-0000-0000-000000000020';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: OWNER_ID, role: 'BAR_OWNER' });
const affiliateToken = generateAccessToken({ userId: AFFILIATE_ID, role: 'AFFILIATE' });
const employeeToken = generateAccessToken({ userId: EMPLOYEE_ID, role: 'EMPLOYEE' });

function makeRevenueToken() {
  return jwt.sign({ type: 'revenue', userId: ADMIN_ID }, JWT_SECRET, { expiresIn: '15m' });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('Revenue Routes', () => {
  describe('POST /api/v1/revenue/auth', () => {
    it('creates revenue password on first use', async () => {
      mockPrisma.globalConfig.findUnique.mockResolvedValue(null);
      mockPrisma.globalConfig.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/revenue/auth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'myrevenuepass' });

      expect(res.status).toBe(200);
      expect(res.body.data.revenueToken).toBeDefined();
      expect(res.body.data.expiresIn).toBe(900);
    });

    it('verifies existing revenue password', async () => {
      const hash = await bcrypt.hash('secret123', 10);
      mockPrisma.globalConfig.findUnique.mockResolvedValue({
        key: 'revenuePassword',
        value: { hash },
      });

      const res = await request(app)
        .post('/api/v1/revenue/auth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res.body.data.revenueToken).toBeDefined();
    });

    it('rejects wrong revenue password', async () => {
      const hash = await bcrypt.hash('secret123', 10);
      mockPrisma.globalConfig.findUnique.mockResolvedValue({
        key: 'revenuePassword',
        value: { hash },
      });

      const res = await request(app)
        .post('/api/v1/revenue/auth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'wrong' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/revenue/admin', () => {
    it('returns revenue analytics with valid revenue token', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 't1', type: 'SONG_PAYMENT', amount: 100, status: 'COMPLETED',
          createdAt: new Date(), machine: { id: 'm1', name: 'M1', venue: { id: VENUE_ID, name: 'Bar', city: 'SP', state: 'SP' } },
          revenueSplits: [{ platformAmount: 30, venueAmount: 30, affiliateAmount: 35, operatorAmount: 5 }],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/revenue/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-revenue-token', makeRevenueToken());

      expect(res.status).toBe(200);
      expect(res.body.data.totals.total).toBe(100);
      expect(res.body.data.totals.platform).toBe(30);
    });

    it('rejects without revenue token', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/revenue/admin/export', () => {
    it('returns CSV', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 't1', type: 'SONG_PAYMENT', amount: 10, createdAt: new Date('2026-01-01'),
          user: { name: 'Test', email: 'test@test.com' },
          machine: { name: 'M1', venue: { name: 'Bar', city: 'SP', state: 'SP' } },
          revenueSplits: [{ platformAmount: 3, venueAmount: 3, affiliateAmount: 3.5, operatorAmount: 0.5 }],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/revenue/admin/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-revenue-token', makeRevenueToken());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Date,Type,Amount');
      expect(res.text).toContain('SONG_PAYMENT');
    });
  });

  describe('GET /api/v1/revenue/venue/:id', () => {
    it('bar owner can see their venue revenue', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, ownerId: OWNER_ID });
      mockPrisma.machine.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        { id: 't1', type: 'SONG_PAYMENT', amount: 50, revenueSplits: [{ venueAmount: 15 }] },
      ]);

      const res = await request(app)
        .get(`/api/v1/revenue/venue/${VENUE_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(50);
      expect(res.body.data.venueCut).toBe(15);
    });

    it('denies bar owner access to other venue', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, ownerId: 'other' });

      const res = await request(app)
        .get(`/api/v1/revenue/venue/${VENUE_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/revenue/affiliate', () => {
    it('affiliate can see their earnings', async () => {
      mockPrisma.revenueSplit.findMany.mockResolvedValue([
        {
          id: 's1', affiliateAmount: 35, affiliatePercent: 35, createdAt: new Date(),
          transaction: { type: 'SONG_PAYMENT', amount: 100, createdAt: new Date() },
          venue: { name: 'Bar' },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/revenue/affiliate')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(35);
      expect(res.body.data.splits).toHaveLength(1);
    });
  });

  describe('GET /api/v1/revenue/operator', () => {
    it('employee can see their operator cut', async () => {
      mockPrisma.revenueSplit.findMany.mockResolvedValue([
        {
          id: 's1', operatorAmount: 5, operatorPercent: 5, createdAt: new Date(),
          transaction: { type: 'SONG_PAYMENT', amount: 100, createdAt: new Date() },
          venue: { name: 'Bar' },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/revenue/operator')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(5);
    });
  });
});
