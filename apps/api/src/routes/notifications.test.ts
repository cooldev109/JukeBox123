import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    machineAlert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    venue: { findMany: vi.fn() },
    machine: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
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

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: OWNER_ID, role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Notification Routes', () => {
  // -----------------------------------------------
  // GET /notifications/vapid-key
  // -----------------------------------------------
  describe('GET /api/v1/notifications/vapid-key', () => {
    it('returns VAPID public key (no auth needed)', async () => {
      const res = await request(app).get('/api/v1/notifications/vapid-key');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publicKey).toBe('test-vapid-key');
    });
  });

  // -----------------------------------------------
  // POST /notifications/subscribe
  // -----------------------------------------------
  describe('POST /api/v1/notifications/subscribe', () => {
    it('saves a push subscription', async () => {
      mockPrisma.pushSubscription.upsert.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/notifications/subscribe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'key1', auth: 'key2' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example.com/abc' },
        update: { userId: ADMIN_ID, p256dh: 'key1', auth: 'key2' },
        create: { userId: ADMIN_ID, endpoint: 'https://push.example.com/abc', p256dh: 'key1', auth: 'key2' },
      });
    });

    it('requires auth', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/subscribe')
        .send({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'key1', auth: 'key2' },
        });

      expect(res.status).toBe(401);
    });

    it('validates endpoint is a URL', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/subscribe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          endpoint: 'not-a-url',
          keys: { p256dh: 'key1', auth: 'key2' },
        });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // DELETE /notifications/subscribe
  // -----------------------------------------------
  describe('DELETE /api/v1/notifications/subscribe', () => {
    it('removes a push subscription', async () => {
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete('/api/v1/notifications/subscribe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ endpoint: 'https://push.example.com/abc' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -----------------------------------------------
  // GET /notifications/history
  // -----------------------------------------------
  describe('GET /api/v1/notifications/history', () => {
    it('returns all alerts for admin', async () => {
      mockPrisma.machineAlert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          type: 'OFFLINE',
          message: 'Machine offline',
          severity: 'MEDIUM',
          isResolved: false,
          createdAt: new Date().toISOString(),
          machine: { id: 'm1', name: 'Machine 1', venue: { id: 'v1', name: 'Bar 1' } },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alerts).toHaveLength(1);
    });

    it('returns filtered alerts for bar owner', async () => {
      mockPrisma.venue.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.machine.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.machineAlert.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/notifications/history')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alerts).toHaveLength(0);
    });

    it('returns empty for customer', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/history')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alerts).toHaveLength(0);
    });
  });

  // -----------------------------------------------
  // POST /notifications/alerts/:id/resolve
  // -----------------------------------------------
  describe('POST /api/v1/notifications/alerts/:id/resolve', () => {
    it('resolves an alert', async () => {
      mockPrisma.machineAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        isResolved: false,
      });
      mockPrisma.machineAlert.update.mockResolvedValue({
        id: 'alert-1',
        isResolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedById: ADMIN_ID,
      });

      const res = await request(app)
        .post('/api/v1/notifications/alerts/alert-1/resolve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isResolved).toBe(true);
    });

    it('returns 404 for non-existent alert', async () => {
      mockPrisma.machineAlert.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/notifications/alerts/bad-id/resolve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 if already resolved', async () => {
      mockPrisma.machineAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        isResolved: true,
      });

      const res = await request(app)
        .post('/api/v1/notifications/alerts/alert-1/resolve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('rejects customer role', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/alerts/alert-1/resolve')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
