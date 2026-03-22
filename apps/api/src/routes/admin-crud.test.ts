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
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
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
const USER_ID = '00000000-0000-0000-0000-000000000002';
const VENUE_ID = '00000000-0000-0000-0000-000000000020';
const MACHINE_ID = '00000000-0000-0000-0000-000000000030';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Admin CRUD', () => {
  // -----------------------------------------------
  // PUT /auth/users/:id — Admin edit user
  // -----------------------------------------------
  describe('PUT /api/v1/auth/users/:id', () => {
    it('admin can update a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        name: 'Old Name',
        email: 'old@test.com',
        role: 'CUSTOMER',
        isActive: true,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: USER_ID,
        name: 'New Name',
        email: 'new@test.com',
        role: 'CUSTOMER',
        isActive: true,
      });

      const res = await request(app)
        .put(`/api/v1/auth/users/${USER_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name', email: 'new@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .put(`/api/v1/auth/users/${USER_ID}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // DELETE /auth/users/:id — Admin deactivate user
  // -----------------------------------------------
  describe('DELETE /api/v1/auth/users/:id', () => {
    it('admin can deactivate a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        isActive: true,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: USER_ID,
        isActive: false,
      });

      const res = await request(app)
        .delete(`/api/v1/auth/users/${USER_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('admin cannot deactivate self', async () => {
      const res = await request(app)
        .delete(`/api/v1/auth/users/${ADMIN_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/auth/users/${USER_ID}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // GET /auth/users — with filters
  // -----------------------------------------------
  describe('GET /api/v1/auth/users with filters', () => {
    it('filters by role', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: USER_ID, name: 'Test', email: 'test@test.com', role: 'CUSTOMER', isActive: true },
      ]);

      const res = await request(app)
        .get('/api/v1/auth/users?role=CUSTOMER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toBeDefined();
    });

    it('searches by name', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/auth/users?search=john')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------
  // PUT /venues/:id/owner — Reassign venue owner
  // -----------------------------------------------
  describe('PUT /api/v1/venues/:id/owner', () => {
    it('admin can reassign venue owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        role: 'BAR_OWNER',
      });
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID,
        ownerId: ADMIN_ID,
      });
      mockPrisma.venue.update.mockResolvedValue({
        id: VENUE_ID,
        ownerId: USER_ID,
        owner: { id: USER_ID, name: 'New Owner', email: 'new@owner.com' },
      });

      const res = await request(app)
        .put(`/api/v1/venues/${VENUE_ID}/owner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ownerId: USER_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .put(`/api/v1/venues/${VENUE_ID}/owner`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ ownerId: USER_ID });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // DELETE /venues/:id — Deactivate venue
  // -----------------------------------------------
  describe('DELETE /api/v1/venues/:id', () => {
    it('admin can deactivate a venue', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: VENUE_ID,
        status: 'ACTIVE',
      });
      mockPrisma.venue.update.mockResolvedValue({
        id: VENUE_ID,
        status: 'SUSPENDED',
      });
      mockPrisma.machine.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete(`/api/v1/venues/${VENUE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/venues/${VENUE_ID}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /machines/:id/reassign — Reassign machine
  // -----------------------------------------------
  describe('POST /api/v1/machines/:id/reassign', () => {
    it('admin can reassign machine to new venue', async () => {
      const NEW_VENUE_ID = '00000000-0000-0000-0000-000000000021';
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: MACHINE_ID,
        venueId: VENUE_ID,
      });
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: NEW_VENUE_ID,
        name: 'New Venue',
      });
      mockPrisma.machine.update.mockResolvedValue({
        id: MACHINE_ID,
        venueId: NEW_VENUE_ID,
        venue: { id: NEW_VENUE_ID, name: 'New Venue', city: 'SP', state: 'SP' },
      });

      const res = await request(app)
        .post(`/api/v1/machines/${MACHINE_ID}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ venueId: NEW_VENUE_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post(`/api/v1/machines/${MACHINE_ID}/reassign`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ venueId: VENUE_ID });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // DELETE /machines/:id — Deactivate machine
  // -----------------------------------------------
  describe('DELETE /api/v1/machines/:id', () => {
    it('admin can deactivate a machine', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: MACHINE_ID,
        status: 'ONLINE',
      });
      mockPrisma.machine.update.mockResolvedValue({
        id: MACHINE_ID,
        status: 'OFFLINE',
      });

      const res = await request(app)
        .delete(`/api/v1/machines/${MACHINE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/machines/${MACHINE_ID}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
