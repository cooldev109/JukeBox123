import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    globalConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const adminToken = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: 'owner-1', role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Config Routes', () => {
  // -----------------------------------------------
  // GET /config/global
  // -----------------------------------------------
  describe('GET /api/v1/config/global', () => {
    it('returns global config with defaults when no config exists', async () => {
      mockPrisma.globalConfig.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/config/global')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultPricing).toBeDefined();
      expect(res.body.data.defaultPricing.songPrice).toBe(2.00);
      expect(res.body.data.defaultPricing.currency).toBe('BRL');
      expect(res.body.data.featureToggles).toBeDefined();
      expect(res.body.data.featureToggles.pixPayments).toBe(true);
    });

    it('returns stored config when it exists', async () => {
      mockPrisma.globalConfig.findMany.mockResolvedValue([
        { key: 'defaultPricing', value: { songPrice: 5.00, currency: 'USD' } },
        { key: 'featureToggles', value: { pixPayments: false, specialEvents: true } },
      ]);

      const res = await request(app)
        .get('/api/v1/config/global')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.defaultPricing.songPrice).toBe(5.00);
      expect(res.body.data.featureToggles.pixPayments).toBe(false);
    });

    it('any authenticated user can read config', async () => {
      mockPrisma.globalConfig.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/config/global')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/v1/config/global');

      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------
  // PUT /config/global
  // -----------------------------------------------
  describe('PUT /api/v1/config/global', () => {
    it('admin can update pricing config', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          globalConfig: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({ key: 'defaultPricing', value: { songPrice: 3.00 } }),
          },
        };
        return fn(tx);
      });
      mockPrisma.globalConfig.findMany.mockResolvedValue([
        { key: 'defaultPricing', value: { songPrice: 3.00 } },
      ]);

      const res = await request(app)
        .put('/api/v1/config/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ defaultPricing: { songPrice: 3.00 } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultPricing).toBeDefined();
    });

    it('admin can update feature toggles', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          globalConfig: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({ key: 'featureToggles', value: { specialEvents: true } }),
          },
        };
        return fn(tx);
      });
      mockPrisma.globalConfig.findMany.mockResolvedValue([
        { key: 'featureToggles', value: { specialEvents: true } },
      ]);

      const res = await request(app)
        .put('/api/v1/config/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ featureToggles: { specialEvents: true } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects when no config fields provided', async () => {
      const res = await request(app)
        .put('/api/v1/config/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least one/i);
    });

    it('bar owner cannot update config (403)', async () => {
      const res = await request(app)
        .put('/api/v1/config/global')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ defaultPricing: { songPrice: 10 } });

      expect(res.status).toBe(403);
    });

    it('customer cannot update config (403)', async () => {
      const res = await request(app)
        .put('/api/v1/config/global')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ featureToggles: { pixPayments: false } });

      expect(res.status).toBe(403);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .put('/api/v1/config/global')
        .send({ defaultPricing: { songPrice: 1 } });

      expect(res.status).toBe(401);
    });
  });
});
