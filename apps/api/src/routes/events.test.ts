import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    machine: { findUnique: vi.fn(), findMany: vi.fn() },
    venue: { findMany: vi.fn(), findUnique: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    queueItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    specialEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    globalConfig: { findUnique: vi.fn() },
    song: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../socket.js', () => ({
  getIO: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  }),
}));

vi.mock('../lib/stripe.js', () => ({
  createPaymentIntent: vi.fn(),
  createCustomer: vi.fn(),
  attachPaymentMethod: vi.fn(),
  listPaymentMethods: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

// Use valid UUIDs for test data
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000002';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const MACHINE_ID = '00000000-0000-0000-0000-000000000010';
const VENUE_ID = '00000000-0000-0000-0000-000000000020';
const QUEUE_ITEM_ID = '00000000-0000-0000-0000-000000000030';
const SONG_ID = '00000000-0000-0000-0000-000000000040';
const EVENT_ID = '00000000-0000-0000-0000-000000000050';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const ownerToken = generateAccessToken({ userId: OWNER_ID, role: 'BAR_OWNER' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: setup machine + venue mocks for getEventConfig
function setupMachineMock(overrides: Record<string, unknown> = {}) {
  const machine = {
    id: MACHINE_ID,
    venueId: VENUE_ID,
    venue: {
      settings: {},
      ownerId: OWNER_ID,
    },
    ...overrides,
  };
  mockPrisma.machine.findUnique.mockResolvedValue(machine);
  mockPrisma.globalConfig.findUnique.mockResolvedValue(null);
  return machine;
}

describe('Special Events API', () => {
  // -----------------------------------------------
  // GET /events/config
  // -----------------------------------------------
  describe('GET /api/v1/events/config', () => {
    it('returns event config for a machine', async () => {
      setupMachineMock();

      const res = await request(app)
        .get(`/api/v1/events/config?machineId=${MACHINE_ID}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveProperty('skipQueue');
      expect(res.body.data.events).toHaveProperty('silence');
      expect(res.body.data.events).toHaveProperty('textMessage');
      expect(res.body.data.events).toHaveProperty('reaction');
      expect(res.body.data.events).toHaveProperty('birthday');
    });

    it('returns 400 without machineId', async () => {
      const res = await request(app)
        .get('/api/v1/events/config')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/events/config?machineId=${MACHINE_ID}`);
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------
  // POST /events/silence
  // -----------------------------------------------
  describe('POST /api/v1/events/silence', () => {
    it('creates a silence event and charges wallet', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 95 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 5 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'SILENCE', duration: 60 }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/silence')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, duration: 60 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('eventId');
      expect(res.body.data).toHaveProperty('transactionId');
    });

    it('rejects invalid duration', async () => {
      const res = await request(app)
        .post('/api/v1/events/silence')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, duration: 45 });

      expect(res.status).toBe(400);
    });

    it('rejects non-customer role', async () => {
      const res = await request(app)
        .post('/api/v1/events/silence')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ machineId: MACHINE_ID, duration: 60 });

      expect(res.status).toBe(403);
    });

    it('rejects when wallet has insufficient balance', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 1 }),
          update: vi.fn(),
        },
        transaction: { create: vi.fn() },
        specialEvent: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));

      const res = await request(app)
        .post('/api/v1/events/silence')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, duration: 60 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');
    });
  });

  // -----------------------------------------------
  // POST /events/text-message
  // -----------------------------------------------
  describe('POST /api/v1/events/text-message', () => {
    it('creates a text message event', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 98 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 2 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'TEXT_MESSAGE' }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/text-message')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, message: 'Hello from the bar!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('eventId');
    });

    it('rejects message over 200 chars', async () => {
      const res = await request(app)
        .post('/api/v1/events/text-message')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, message: 'a'.repeat(201) });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // POST /events/reaction
  // -----------------------------------------------
  describe('POST /api/v1/events/reaction', () => {
    it('creates a reaction event', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 99 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 1 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'REACTION' }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/reaction')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, reactionType: 'FIRE' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects invalid reaction type', async () => {
      const res = await request(app)
        .post('/api/v1/events/reaction')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, reactionType: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // POST /events/voice-message
  // -----------------------------------------------
  describe('POST /api/v1/events/voice-message', () => {
    it('creates a pending voice message event', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 92 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 8 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'VOICE_MESSAGE', status: 'PENDING_APPROVAL' }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/voice-message')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, audioUrl: '/uploads/audio.webm', duration: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.message).toBe('Awaiting bar owner approval');
    });
  });

  // -----------------------------------------------
  // POST /events/photo
  // -----------------------------------------------
  describe('POST /api/v1/events/photo', () => {
    it('creates a pending photo event', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 95 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 5 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'PHOTO', status: 'PENDING_APPROVAL' }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/photo')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, photoUrl: '/uploads/photo.jpg' });

      expect(res.status).toBe(201);
      expect(res.body.data.message).toBe('Awaiting bar owner approval');
    });
  });

  // -----------------------------------------------
  // POST /events/birthday
  // -----------------------------------------------
  describe('POST /api/v1/events/birthday', () => {
    it('creates a birthday event', async () => {
      setupMachineMock();

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 75 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 25 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID, type: 'BIRTHDAY' }),
        },
        song: { findUnique: vi.fn() },
        queueItem: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Customer' });

      const res = await request(app)
        .post('/api/v1/events/birthday')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, birthdayName: 'Maria' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // -----------------------------------------------
  // POST /events/skip-queue
  // -----------------------------------------------
  describe('POST /api/v1/events/skip-queue', () => {
    it('moves queue item to priority position', async () => {
      setupMachineMock();

      mockPrisma.queueItem.findUnique.mockResolvedValue({
        id: QUEUE_ITEM_ID,
        userId: CUSTOMER_ID,
        machineId: MACHINE_ID,
        status: 'PENDING',
        position: 5,
      });

      const mockTx = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ userId: CUSTOMER_ID, balance: 100 }),
          update: vi.fn().mockResolvedValue({ balance: 95 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 5 }),
        },
        specialEvent: {
          create: vi.fn().mockResolvedValue({ id: EVENT_ID }),
        },
        queueItem: {
          findFirst: vi.fn().mockResolvedValue({ id: 'playing-1', position: 1 }),
          updateMany: vi.fn(),
          update: vi.fn().mockResolvedValue({ id: QUEUE_ITEM_ID, position: 2, isPriority: true }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));
      mockPrisma.queueItem.findMany.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/events/skip-queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, queueItemId: QUEUE_ITEM_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects if queue item belongs to another user', async () => {
      setupMachineMock();

      mockPrisma.queueItem.findUnique.mockResolvedValue({
        id: QUEUE_ITEM_ID,
        userId: '00000000-0000-0000-0000-000000000099',
        machineId: MACHINE_ID,
        status: 'PENDING',
      });

      const res = await request(app)
        .post('/api/v1/events/skip-queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ machineId: MACHINE_ID, queueItemId: QUEUE_ITEM_ID });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /events/:id/approve
  // -----------------------------------------------
  describe('POST /api/v1/events/:id/approve', () => {
    it('approves a pending event', async () => {
      mockPrisma.specialEvent.findUnique.mockResolvedValue({
        id: EVENT_ID,
        status: 'PENDING_APPROVAL',
        type: 'VOICE_MESSAGE',
        machineId: MACHINE_ID,
        userId: CUSTOMER_ID,
        content: '/uploads/audio.webm',
        duration: 5,
        machine: {
          venueId: VENUE_ID,
          venue: { ownerId: OWNER_ID },
        },
        user: { name: 'Customer' },
      });

      mockPrisma.specialEvent.update.mockResolvedValue({
        id: EVENT_ID,
        status: 'APPROVED',
        approvedById: OWNER_ID,
      });

      const res = await request(app)
        .post(`/api/v1/events/${EVENT_ID}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('rejects if event is not pending', async () => {
      mockPrisma.specialEvent.findUnique.mockResolvedValue({
        id: EVENT_ID,
        status: 'APPROVED',
        machine: { venueId: VENUE_ID, venue: { ownerId: OWNER_ID } },
        user: { name: 'Customer' },
      });

      const res = await request(app)
        .post(`/api/v1/events/${EVENT_ID}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });

    it('rejects if customer tries to approve', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${EVENT_ID}/approve`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /events/:id/reject
  // -----------------------------------------------
  describe('POST /api/v1/events/:id/reject', () => {
    it('rejects event and refunds wallet', async () => {
      mockPrisma.specialEvent.findUnique.mockResolvedValue({
        id: EVENT_ID,
        status: 'PENDING_APPROVAL',
        type: 'VOICE_MESSAGE',
        machineId: MACHINE_ID,
        userId: CUSTOMER_ID,
        amount: 8,
        machine: {
          venueId: VENUE_ID,
          venue: { ownerId: OWNER_ID },
        },
      });

      const mockTx = {
        specialEvent: {
          update: vi.fn().mockResolvedValue({ id: EVENT_ID, status: 'REJECTED' }),
        },
        wallet: {
          update: vi.fn().mockResolvedValue({ balance: 108 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: 'refund-tx-1' }),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => void) => fn(mockTx));

      const res = await request(app)
        .post(`/api/v1/events/${EVENT_ID}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.event.status).toBe('REJECTED');
      expect(res.body.data).toHaveProperty('refundTransactionId');
    });
  });

  // -----------------------------------------------
  // GET /events/pending
  // -----------------------------------------------
  describe('GET /api/v1/events/pending', () => {
    it('returns pending events for admin', async () => {
      mockPrisma.specialEvent.findMany.mockResolvedValue([
        {
          id: EVENT_ID,
          type: 'VOICE_MESSAGE',
          status: 'PENDING_APPROVAL',
          user: { id: CUSTOMER_ID, name: 'Customer', email: 'c@test.com' },
          machine: { id: MACHINE_ID, name: 'Machine 1', venue: { id: VENUE_ID, name: 'Bar' } },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/events/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(1);
    });

    it('returns pending events for bar owner (filtered by venue)', async () => {
      mockPrisma.venue.findMany.mockResolvedValue([{ id: VENUE_ID }]);
      mockPrisma.machine.findMany.mockResolvedValue([{ id: MACHINE_ID }]);
      mockPrisma.specialEvent.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/events/pending')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(0);
    });

    it('rejects customer access', async () => {
      const res = await request(app)
        .get('/api/v1/events/pending')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /events/upload
  // -----------------------------------------------
  describe('POST /api/v1/events/upload', () => {
    it('rejects without file data', async () => {
      const res = await request(app)
        .post('/api/v1/events/upload')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
      const res = await request(app)
        .post('/api/v1/events/upload')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ file: 'dGVzdA==', type: 'video' });

      expect(res.status).toBe(400);
    });
  });
});
