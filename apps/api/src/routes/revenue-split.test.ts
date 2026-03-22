import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    venue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    machine: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    globalConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    machineAlert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
    },
    affiliateReferral: {
      findFirst: vi.fn(),
    },
    revenueSplit: {
      create: vi.fn(),
    },
    song: { findFirst: vi.fn(), create: vi.fn() },
    songRequest: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: { count: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
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
import { createSplit, getVenueSplitConfig } from '../services/revenueSplit.js';

const app = createApp();
const mockPrisma = prisma as any;

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000002';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const VENUE_ID = '00000000-0000-0000-0000-000000000020';
const TX_ID = '00000000-0000-0000-0000-000000000050';
const AFFILIATE_ID = '00000000-0000-0000-0000-000000000060';
const OPERATOR_ID = '00000000-0000-0000-0000-000000000070';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: OWNER_ID, role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Commission Split Config', () => {
  // -----------------------------------------------
  // GET /config/commission-split
  // -----------------------------------------------
  describe('GET /api/v1/config/commission-split', () => {
    it('returns global default split', async () => {
      mockPrisma.globalConfig.findUnique.mockResolvedValue({
        key: 'defaultCommissionSplit',
        value: { platformPercent: 30, venuePercent: 30, affiliatePercent: 35, operatorPercent: 5 },
      });

      const res = await request(app)
        .get('/api/v1/config/commission-split')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.split.platformPercent).toBe(30);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/config/commission-split')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // PUT /config/commission-split
  // -----------------------------------------------
  describe('PUT /api/v1/config/commission-split', () => {
    it('admin can update global split (sum = 100)', async () => {
      mockPrisma.globalConfig.upsert.mockResolvedValue({
        key: 'defaultCommissionSplit',
        value: { platformPercent: 25, venuePercent: 35, affiliatePercent: 35, operatorPercent: 5 },
      });

      const res = await request(app)
        .put('/api/v1/config/commission-split')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ platformPercent: 25, venuePercent: 35, affiliatePercent: 35, operatorPercent: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.split.platformPercent).toBe(25);
    });

    it('rejects split that does not sum to 100', async () => {
      const res = await request(app)
        .put('/api/v1/config/commission-split')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ platformPercent: 50, venuePercent: 30, affiliatePercent: 30, operatorPercent: 5 });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // GET /config/venue/:id/commission-split
  // -----------------------------------------------
  describe('GET /api/v1/config/venue/:id/commission-split', () => {
    it('returns venue split (with override)', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID,
        ownerId: OWNER_ID,
        settings: { commissionSplit: { platformPercent: 20, venuePercent: 40, affiliatePercent: 35, operatorPercent: 5 } },
      });

      const res = await request(app)
        .get(`/api/v1/config/venue/${VENUE_ID}/commission-split`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.split.venuePercent).toBe(40);
      expect(res.body.data.hasOverride).toBe(true);
    });

    it('bar owner can view their own venue split', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID,
        ownerId: OWNER_ID,
        settings: {},
      });
      mockPrisma.globalConfig.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/config/venue/${VENUE_ID}/commission-split`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasOverride).toBe(false);
    });

    it('bar owner cannot view other venue split', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID,
        ownerId: 'other-owner',
      });

      const res = await request(app)
        .get(`/api/v1/config/venue/${VENUE_ID}/commission-split`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // PUT /config/venue/:id/commission-split
  // -----------------------------------------------
  describe('PUT /api/v1/config/venue/:id/commission-split', () => {
    it('admin can set venue-specific split', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, settings: {} });
      mockPrisma.venue.update.mockResolvedValue({});

      const res = await request(app)
        .put(`/api/v1/config/venue/${VENUE_ID}/commission-split`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ platformPercent: 25, venuePercent: 35, affiliatePercent: 35, operatorPercent: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.split.venuePercent).toBe(35);
    });

    it('rejects split that does not sum to 100', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ id: VENUE_ID, settings: {} });

      const res = await request(app)
        .put(`/api/v1/config/venue/${VENUE_ID}/commission-split`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ platformPercent: 50, venuePercent: 50, affiliatePercent: 50, operatorPercent: 5 });

      expect(res.status).toBe(400);
    });
  });
});

describe('Revenue Split Service', () => {
  describe('createSplit', () => {
    it('creates split with all 4 parties', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID, amount: 100, status: 'COMPLETED',
      });
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID, settings: { commissionSplit: { platformPercent: 30, venuePercent: 30, affiliatePercent: 35, operatorPercent: 5 } },
        city: 'SP', state: 'SP',
      });
      mockPrisma.affiliateReferral.findFirst.mockResolvedValue({ affiliateId: AFFILIATE_ID });
      mockPrisma.user.findFirst.mockResolvedValue({ id: OPERATOR_ID });
      mockPrisma.revenueSplit.create.mockResolvedValue({});

      await createSplit(TX_ID, VENUE_ID);

      expect(mockPrisma.revenueSplit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 100,
          platformAmount: 30,
          platformPercent: 30,
          venueAmount: 30,
          venuePercent: 30,
          affiliateAmount: 35,
          affiliatePercent: 35,
          operatorAmount: 5,
          operatorPercent: 5,
          affiliateId: AFFILIATE_ID,
          operatorId: OPERATOR_ID,
        }),
      });
    });

    it('gives affiliate share to platform when no affiliate', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID, amount: 100, status: 'COMPLETED',
      });
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID, settings: { commissionSplit: { platformPercent: 30, venuePercent: 30, affiliatePercent: 35, operatorPercent: 5 } },
        city: 'SP', state: 'SP',
      });
      mockPrisma.affiliateReferral.findFirst.mockResolvedValue(null); // no affiliate
      mockPrisma.user.findFirst.mockResolvedValue({ id: OPERATOR_ID });
      mockPrisma.revenueSplit.create.mockResolvedValue({});

      await createSplit(TX_ID, VENUE_ID);

      expect(mockPrisma.revenueSplit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platformPercent: 65, // 30 + 35
          affiliatePercent: 0,
          affiliateAmount: 0,
          affiliateId: null,
        }),
      });
    });

    it('gives operator share to platform when no operator', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID, amount: 100, status: 'COMPLETED',
      });
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID, settings: { commissionSplit: { platformPercent: 30, venuePercent: 30, affiliatePercent: 35, operatorPercent: 5 } },
        city: 'SP', state: 'SP',
      });
      mockPrisma.affiliateReferral.findFirst.mockResolvedValue({ affiliateId: AFFILIATE_ID });
      mockPrisma.user.findFirst.mockResolvedValue(null); // no operator
      mockPrisma.revenueSplit.create.mockResolvedValue({});

      await createSplit(TX_ID, VENUE_ID);

      expect(mockPrisma.revenueSplit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platformPercent: 35, // 30 + 5
          operatorPercent: 0,
          operatorAmount: 0,
          operatorId: null,
        }),
      });
    });

    it('skips non-completed transactions', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID, amount: 100, status: 'PENDING',
      });

      await createSplit(TX_ID, VENUE_ID);

      expect(mockPrisma.revenueSplit.create).not.toHaveBeenCalled();
    });
  });

  describe('getVenueSplitConfig', () => {
    it('returns venue override when present', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        settings: { commissionSplit: { platformPercent: 20, venuePercent: 40, affiliatePercent: 35, operatorPercent: 5 } },
      });

      const config = await getVenueSplitConfig(VENUE_ID);
      expect(config.venuePercent).toBe(40);
    });

    it('falls back to global config', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ settings: {} });
      mockPrisma.globalConfig.findUnique.mockResolvedValue({
        value: { platformPercent: 25, venuePercent: 35, affiliatePercent: 35, operatorPercent: 5 },
      });

      const config = await getVenueSplitConfig(VENUE_ID);
      expect(config.venuePercent).toBe(35);
    });

    it('falls back to hardcoded default', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ settings: {} });
      mockPrisma.globalConfig.findUnique.mockResolvedValue(null);

      const config = await getVenueSplitConfig(VENUE_ID);
      expect(config.platformPercent).toBe(30);
      expect(config.venuePercent).toBe(30);
      expect(config.affiliatePercent).toBe(35);
      expect(config.operatorPercent).toBe(5);
    });
  });
});
