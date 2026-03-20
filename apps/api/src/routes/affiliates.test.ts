import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    commission: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    affiliateReferral: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const affiliateToken = generateAccessToken({ userId: 'affiliate-1', role: 'AFFILIATE' });
const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });
const adminToken = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Affiliates Routes', () => {
  // -----------------------------------------------
  // GET /affiliates/me/commissions
  // -----------------------------------------------
  describe('GET /api/v1/affiliates/me/commissions', () => {
    it('affiliate can see their commissions', async () => {
      const commissions = [
        {
          id: 'c1',
          affiliateId: 'affiliate-1',
          transactionId: 'tx1',
          venueId: 'v1',
          percentage: 25,
          amount: 5.00,
          type: 'SALE',
          status: 'PENDING',
          createdAt: new Date(),
          transaction: { id: 'tx1', type: 'SONG_PAYMENT', amount: 20.00, createdAt: new Date() },
          venue: { id: 'v1', name: 'Bar One' },
        },
      ];
      mockPrisma.commission.findMany.mockResolvedValue(commissions);
      mockPrisma.commission.count.mockResolvedValue(1);
      mockPrisma.commission.aggregate.mockResolvedValue({ _sum: { amount: 5.00 }, _count: 1 });

      const res = await request(app)
        .get('/api/v1/affiliates/me/commissions')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.commissions).toHaveLength(1);
      expect(res.body.data.commissions[0].amount).toBe(5.00);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it('customer cannot access affiliate commissions (403)', async () => {
      const res = await request(app)
        .get('/api/v1/affiliates/me/commissions')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it('admin cannot access affiliate commissions (403)', async () => {
      const res = await request(app)
        .get('/api/v1/affiliates/me/commissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/affiliates/me/commissions');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /affiliates/me/summary
  // -----------------------------------------------
  describe('GET /api/v1/affiliates/me/summary', () => {
    it('returns earnings summary for affiliate', async () => {
      mockPrisma.commission.aggregate.mockResolvedValue({
        _sum: { amount: 150.00 },
        _count: 10,
      });
      mockPrisma.affiliateReferral.count.mockResolvedValue(3);

      const res = await request(app)
        .get('/api/v1/affiliates/me/summary')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.daily).toBeDefined();
      expect(res.body.data.monthly).toBeDefined();
      expect(res.body.data.yearly).toBeDefined();
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.activeReferrals).toBe(3);
    });

    it('non-affiliate gets 403', async () => {
      const res = await request(app)
        .get('/api/v1/affiliates/me/summary')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /affiliates/me/qr
  // -----------------------------------------------
  describe('GET /api/v1/affiliates/me/qr', () => {
    it('returns referral code and QR data for affiliate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'affiliate-1',
        name: 'John Affiliate',
        referralCode: 'AFF-JOHN-ABC123',
      });

      const res = await request(app)
        .get('/api/v1/affiliates/me/qr')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referralCode).toBe('AFF-JOHN-ABC123');
      expect(res.body.data.qrData).toBeDefined();
      expect(res.body.data.shareUrl).toContain('AFF-JOHN-ABC123');

      // Verify qrData is valid JSON
      const qrData = JSON.parse(res.body.data.qrData);
      expect(qrData.type).toBe('affiliate_referral');
      expect(qrData.code).toBe('AFF-JOHN-ABC123');
    });

    it('returns 404 when affiliate has no referral code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'affiliate-1',
        name: 'No Code',
        referralCode: null,
      });

      const res = await request(app)
        .get('/api/v1/affiliates/me/qr')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/referral code not found/i);
    });

    it('non-affiliate gets 403', async () => {
      const res = await request(app)
        .get('/api/v1/affiliates/me/qr')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('bar owner gets 403', async () => {
      const ownerToken = generateAccessToken({ userId: 'owner-1', role: 'BAR_OWNER' });

      const res = await request(app)
        .get('/api/v1/affiliates/me/qr')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /affiliates/me/referrals
  // -----------------------------------------------
  describe('GET /api/v1/affiliates/me/referrals', () => {
    it('affiliate can see their referrals', async () => {
      const referrals = [
        {
          id: 'r1',
          affiliateId: 'affiliate-1',
          venueId: 'v1',
          referralCode: 'AFF-JOHN-ABC123',
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          venue: { id: 'v1', name: 'Bar One', city: 'SP', state: 'SP' },
        },
      ];
      mockPrisma.affiliateReferral.findMany.mockResolvedValue(referrals);
      mockPrisma.affiliateReferral.count.mockResolvedValue(1);
      mockPrisma.commission.aggregate.mockResolvedValue({ _sum: { amount: 100.00 } });

      const res = await request(app)
        .get('/api/v1/affiliates/me/referrals')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referrals).toHaveLength(1);
      expect(res.body.data.referrals[0].totalEarnings).toBe(100.00);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('non-affiliate gets 403', async () => {
      const res = await request(app)
        .get('/api/v1/affiliates/me/referrals')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
