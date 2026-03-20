import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    machine: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    venue: { findUnique: vi.fn() },
    queueItem: { count: vi.fn() },
  },
}));

vi.mock('../socket.js', () => ({
  getIO: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  }),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const adminToken = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: 'owner-1', role: 'BAR_OWNER' });
const employeeToken = generateAccessToken({ userId: 'employee-1', role: 'EMPLOYEE' });
const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Machines Routes', () => {
  // -----------------------------------------------
  // GET /machines
  // -----------------------------------------------
  describe('GET /api/v1/machines', () => {
    it('admin can list all machines', async () => {
      const machines = [
        { id: 'm1', name: 'Machine 1', serialNumber: 'SN001', status: 'ONLINE', venueId: 'v1', createdAt: new Date(), venue: { id: 'v1', name: 'Bar One', city: 'SP', state: 'SP' } },
        { id: 'm2', name: 'Machine 2', serialNumber: 'SN002', status: 'OFFLINE', venueId: 'v2', createdAt: new Date(), venue: { id: 'v2', name: 'Bar Two', city: 'RJ', state: 'RJ' } },
      ];
      mockPrisma.machine.findMany.mockResolvedValue(machines);
      mockPrisma.machine.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/machines')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machines).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(2);
    });

    it('bar owner can list machines (filtered by own venues)', async () => {
      mockPrisma.machine.findMany.mockResolvedValue([
        { id: 'm1', name: 'My Machine', serialNumber: 'SN001', status: 'ONLINE', venue: { id: 'v1', name: 'My Bar', city: 'SP', state: 'SP' } },
      ]);
      mockPrisma.machine.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/machines')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('employee can list machines (filtered by region)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ regionAccess: 'SP' });
      mockPrisma.machine.findMany.mockResolvedValue([]);
      mockPrisma.machine.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/machines')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('customer cannot list machines (403)', async () => {
      const res = await request(app)
        .get('/api/v1/machines')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/machines');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /machines/:id
  // -----------------------------------------------
  describe('GET /api/v1/machines/:id', () => {
    it('admin can get machine detail with queue count', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: 'm1',
        name: 'Machine 1',
        serialNumber: 'SN001',
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        ipAddress: '192.168.1.10',
        venueId: 'v1',
        config: {},
        offlineSongCache: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        venue: { id: 'v1', name: 'Bar One', city: 'SP', state: 'SP', ownerId: 'owner-1' },
      });
      mockPrisma.queueItem.count.mockResolvedValue(5);

      const res = await request(app)
        .get('/api/v1/machines/m1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machine.id).toBe('m1');
      expect(res.body.data.machine.queueCount).toBe(5);
      // ownerId should be removed from venue response
      expect(res.body.data.machine.venue.ownerId).toBeUndefined();
    });

    it('returns 404 when machine does not exist', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/machines/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('bar owner cannot access machine from another venue (403)', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: 'm2',
        name: 'Other Machine',
        venue: { id: 'v2', name: 'Other Bar', city: 'RJ', state: 'RJ', ownerId: 'other-owner' },
      });

      const res = await request(app)
        .get('/api/v1/machines/m2')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/access denied/i);
    });
  });

  // -----------------------------------------------
  // POST /machines/:id/heartbeat
  // -----------------------------------------------
  describe('POST /api/v1/machines/:id/heartbeat', () => {
    it('updates machine heartbeat and returns status', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'OFFLINE',
        venueId: 'v1',
      });
      mockPrisma.machine.update.mockResolvedValue({
        id: 'm1',
        name: 'Machine 1',
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        ipAddress: '10.0.0.5',
        venueId: 'v1',
      });

      const res = await request(app)
        .post('/api/v1/machines/m1/heartbeat')
        .send({ ipAddress: '10.0.0.5' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machine.status).toBe('ONLINE');
      expect(res.body.data.cameOnline).toBe(true);
    });

    it('returns 404 when machine does not exist', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/machines/nonexistent/heartbeat')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('does not require authentication (public endpoint)', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'ONLINE',
        venueId: 'v1',
      });
      mockPrisma.machine.update.mockResolvedValue({
        id: 'm1',
        name: 'Machine 1',
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        ipAddress: null,
        venueId: 'v1',
      });

      const res = await request(app)
        .post('/api/v1/machines/m1/heartbeat')
        .send({});

      // Should work without auth
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('reports cameOnline=false when machine was already online', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'ONLINE',
        venueId: 'v1',
      });
      mockPrisma.machine.update.mockResolvedValue({
        id: 'm1',
        name: 'Machine 1',
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        ipAddress: null,
        venueId: 'v1',
      });

      const res = await request(app)
        .post('/api/v1/machines/m1/heartbeat')
        .send({});

      expect(res.body.data.cameOnline).toBe(false);
    });
  });
});
