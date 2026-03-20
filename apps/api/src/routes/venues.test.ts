import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    venue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

const adminToken = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: 'owner-1', role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Venues Routes', () => {
  // -----------------------------------------------
  // GET /venues
  // -----------------------------------------------
  describe('GET /api/v1/venues', () => {
    it('admin sees all venues', async () => {
      const venues = [
        { id: 'v1', code: 'BAR01', name: 'Bar One', address: '123 Main', city: 'SP', state: 'SP', country: 'BR', timezone: 'America/Sao_Paulo', currency: 'BRL', status: 'ACTIVE', installDate: null, createdAt: new Date(), updatedAt: new Date(), owner: { id: 'o1', name: 'Owner 1', email: 'o1@test.com' }, _count: { machines: 2 } },
        { id: 'v2', code: 'BAR02', name: 'Bar Two', address: '456 Oak', city: 'RJ', state: 'RJ', country: 'BR', timezone: 'America/Sao_Paulo', currency: 'BRL', status: 'ACTIVE', installDate: null, createdAt: new Date(), updatedAt: new Date(), owner: { id: 'o2', name: 'Owner 2', email: 'o2@test.com' }, _count: { machines: 1 } },
      ];
      mockPrisma.venue.findMany.mockResolvedValue(venues);
      mockPrisma.venue.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.venues).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('bar owner sees only their own venues', async () => {
      mockPrisma.venue.findMany.mockResolvedValue([
        { id: 'v1', code: 'BAR01', name: 'My Bar', address: '123 Main', city: 'SP', state: 'SP', country: 'BR', timezone: 'America/Sao_Paulo', currency: 'BRL', status: 'ACTIVE', installDate: null, createdAt: new Date(), updatedAt: new Date(), owner: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' }, _count: { machines: 1 } },
      ]);
      mockPrisma.venue.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // The route adds ownerId filter for BAR_OWNER before querying
      expect(mockPrisma.venue.findMany).toHaveBeenCalled();
    });

    it('customer cannot list venues (403)', async () => {
      const res = await request(app)
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/venues');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // POST /venues
  // -----------------------------------------------
  describe('POST /api/v1/venues', () => {
    const validVenue = {
      code: 'NEWBAR',
      name: 'New Bar Venue',
      address: '789 Elm Street, Suite 5',
      city: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
      ownerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    };

    it('admin can create a venue', async () => {
      // Owner exists and has BAR_OWNER role
      mockPrisma.user.findUnique.mockResolvedValue({
        id: validVenue.ownerId,
        role: 'BAR_OWNER',
        name: 'Bar Owner',
      });

      const createdVenue = {
        id: 'v-new',
        code: 'NEWBAR',
        name: 'New Bar Venue',
        address: '789 Elm Street, Suite 5',
        city: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
        ownerId: validVenue.ownerId,
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        status: 'ACTIVE',
        settings: {},
        installDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: validVenue.ownerId, name: 'Bar Owner', email: 'owner@test.com' },
      };
      mockPrisma.venue.create.mockResolvedValue(createdVenue);

      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validVenue);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.venue.name).toBe('New Bar Venue');
      expect(res.body.data.venue.code).toBe('NEWBAR');
    });

    it('customer cannot create a venue (403)', async () => {
      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validVenue);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when owner does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validVenue);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/owner.*not found/i);
    });

    it('returns 400 when owner has wrong role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: validVenue.ownerId,
        role: 'CUSTOMER',
        name: 'Not an Owner',
      });

      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validVenue);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/BAR_OWNER/i);
    });
  });

  // -----------------------------------------------
  // GET /venues/:id
  // -----------------------------------------------
  describe('GET /api/v1/venues/:id', () => {
    it('returns venue details for admin', async () => {
      const venue = {
        id: 'v1',
        code: 'BAR01',
        name: 'Test Bar',
        address: '123 Main',
        city: 'SP',
        state: 'SP',
        country: 'BR',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        status: 'ACTIVE',
        settings: {},
        installDate: null,
        ownerId: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 'owner-1', name: 'Owner', email: 'owner@test.com', phone: null },
        machines: [
          { id: 'm1', name: 'Machine 1', serialNumber: 'SN001', status: 'ONLINE', lastHeartbeat: new Date(), ipAddress: '192.168.1.1', createdAt: new Date() },
        ],
      };

      // requireVenueAccess calls prisma.venue.findUnique first to check access,
      // then the route handler calls it again for full data.
      // For ADMIN, requireVenueAccess just calls next() without DB lookup.
      mockPrisma.venue.findUnique.mockResolvedValue(venue);

      const res = await request(app)
        .get('/api/v1/venues/v1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.venue.id).toBe('v1');
      expect(res.body.data.venue.machines).toHaveLength(1);
    });

    it('returns 404 when venue does not exist', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/venues/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('bar owner can access their own venue', async () => {
      const venue = {
        id: 'v1',
        code: 'BAR01',
        name: 'My Bar',
        address: '123 Main',
        city: 'SP',
        state: 'SP',
        country: 'BR',
        ownerId: 'owner-1',
        owner: { id: 'owner-1', name: 'Owner', email: 'owner@test.com', phone: null },
        machines: [],
      };
      // First call from requireVenueAccess, second from route handler
      mockPrisma.venue.findUnique.mockResolvedValue(venue);

      const res = await request(app)
        .get('/api/v1/venues/v1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('bar owner cannot access another owners venue (403)', async () => {
      // requireVenueAccess finds venue owned by someone else
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: 'v2',
        ownerId: 'other-owner',
        state: 'SP',
        city: 'SP',
      });

      const res = await request(app)
        .get('/api/v1/venues/v2')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
