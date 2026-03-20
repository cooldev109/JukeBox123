import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    machine: { findUnique: vi.fn() },
    song: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
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

describe('Queue Routes', () => {
  // -----------------------------------------------
  // GET /machines/:id/queue
  // -----------------------------------------------
  describe('GET /api/v1/machines/:id/queue', () => {
    it('returns queue for a valid machine (no auth required)', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      const queueItems = [
        { id: 'q1', position: 1, status: 'PLAYING', isPriority: false, song: { id: 's1', title: 'Song 1', artist: 'Artist 1' }, user: { id: 'u1', name: 'User 1' } },
        { id: 'q2', position: 2, status: 'PENDING', isPriority: false, song: { id: 's2', title: 'Song 2', artist: 'Artist 2' }, user: { id: 'u2', name: 'User 2' } },
      ];
      mockPrisma.queueItem.findMany.mockResolvedValue(queueItems);

      const res = await request(app).get('/api/v1/machines/m1/queue');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queue).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.machineId).toBe('m1');
    });

    it('returns 404 when machine does not exist', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/machines/nonexistent/queue');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // -----------------------------------------------
  // POST /machines/:id/queue — Add song
  // -----------------------------------------------
  describe('POST /api/v1/machines/:id/queue', () => {
    const validSongId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    it('adds a song to the queue', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.song.findUnique.mockResolvedValue({ id: validSongId, isActive: true });
      mockPrisma.queueItem.findFirst.mockResolvedValue(null); // no last item
      mockPrisma.queueItem.create.mockResolvedValue({
        id: 'q1', machineId: 'm1', songId: validSongId, position: 1, isPriority: false, status: 'PENDING',
        song: { id: validSongId, title: 'Test Song', artist: 'Test Artist' },
        user: { id: 'customer-1', name: 'Customer' },
      });
      mockPrisma.queueItem.findMany.mockResolvedValue([]); // for getFullQueue

      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songId: validSongId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queueItem.songId).toBe(validSongId);
    });

    it('rejects when machine is offline', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'OFFLINE' });

      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songId: validSongId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/offline/i);
    });

    it('rejects when song does not exist', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.song.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songId: validSongId });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/song not found/i);
    });

    it('rejects when song is inactive', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.song.findUnique.mockResolvedValue({ id: validSongId, isActive: false });

      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songId: validSongId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not currently available/i);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .send({ songId: validSongId });

      expect(res.status).toBe(401);
    });

    it('rejects invalid songId format', async () => {
      const res = await request(app)
        .post('/api/v1/machines/m1/queue')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // DELETE /machines/:id/queue/:queueId
  // -----------------------------------------------
  describe('DELETE /api/v1/machines/:id/queue/:queueId', () => {
    it('admin can remove a pending queue item', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findUnique.mockResolvedValue({ id: 'q1', machineId: 'm1', status: 'PENDING', position: 2 });
      mockPrisma.queueItem.delete.mockResolvedValue({});
      mockPrisma.queueItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.queueItem.findMany.mockResolvedValue([]); // getFullQueue

      const res = await request(app)
        .delete('/api/v1/machines/m1/queue/q1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('cannot remove a currently playing song', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findUnique.mockResolvedValue({ id: 'q1', machineId: 'm1', status: 'PLAYING', position: 1 });

      const res = await request(app)
        .delete('/api/v1/machines/m1/queue/q1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/playing/i);
    });

    it('customer cannot remove queue items (403)', async () => {
      const res = await request(app)
        .delete('/api/v1/machines/m1/queue/q1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /machines/:id/queue/skip
  // -----------------------------------------------
  describe('POST /api/v1/machines/:id/queue/skip', () => {
    it('admin can skip the current song', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst
        .mockResolvedValueOnce({ id: 'q1', machineId: 'm1', status: 'PLAYING' }) // currently playing
        .mockResolvedValueOnce({ id: 'q2', machineId: 'm1', status: 'PENDING' }); // next in queue
      mockPrisma.$transaction.mockResolvedValue(undefined);
      mockPrisma.queueItem.findUnique.mockResolvedValue({
        id: 'q2', songId: 's2', status: 'PLAYING',
        song: { id: 's2', title: 'Next Song', artist: 'Artist', duration: 200 },
        user: { id: 'u1', name: 'User' },
      });
      mockPrisma.song.update.mockResolvedValue({});
      mockPrisma.queueItem.findMany.mockResolvedValue([]); // getFullQueue

      const res = await request(app)
        .post('/api/v1/machines/m1/queue/skip')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.skipped).toBe('q1');
      expect(res.body.data.nowPlaying).toBeDefined();
    });

    it('returns error when nothing is playing', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/machines/m1/queue/skip')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no song/i);
    });

    it('customer cannot skip (403)', async () => {
      const res = await request(app)
        .post('/api/v1/machines/m1/queue/skip')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /machines/:id/queue/advance (no auth)
  // -----------------------------------------------
  describe('POST /api/v1/machines/:id/queue/advance', () => {
    it('advances to next song (public endpoint)', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst
        .mockResolvedValueOnce({ id: 'q1', machineId: 'm1', status: 'PLAYING' }) // currently playing
        .mockResolvedValueOnce({ id: 'q2', machineId: 'm1', status: 'PENDING' }); // next
      mockPrisma.$transaction.mockResolvedValue(undefined);
      mockPrisma.queueItem.findUnique.mockResolvedValue({
        id: 'q2', songId: 's2', status: 'PLAYING',
        song: { id: 's2', title: 'Next', artist: 'Art', duration: 180 },
        user: { id: 'u1', name: 'User' },
      });
      mockPrisma.song.update.mockResolvedValue({});
      mockPrisma.queueItem.findMany.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/machines/m1/queue/advance');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nowPlaying).toBeDefined();
    });

    it('returns null when nothing is playing', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/machines/m1/queue/advance');

      expect(res.status).toBe(200);
      expect(res.body.data.nowPlaying).toBeNull();
    });
  });

  // -----------------------------------------------
  // GET /machines/:id/now-playing
  // -----------------------------------------------
  describe('GET /api/v1/machines/:id/now-playing', () => {
    it('returns currently playing song with progress', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst.mockResolvedValue({
        id: 'q1', songId: 's1', status: 'PLAYING',
        playedAt: new Date(Date.now() - 60000), // 60 seconds ago
        song: { id: 's1', title: 'Playing Song', artist: 'Artist', duration: 240 },
        user: { id: 'u1', name: 'User' },
      });

      const res = await request(app).get('/api/v1/machines/m1/now-playing');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nowPlaying).toBeDefined();
      expect(res.body.data.nowPlaying.progress).toBeDefined();
      expect(res.body.data.nowPlaying.progress.duration).toBe(240);
    });

    it('returns null when nothing is playing', async () => {
      mockPrisma.machine.findUnique.mockResolvedValue({ id: 'm1', status: 'ONLINE' });
      mockPrisma.queueItem.findFirst.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/machines/m1/now-playing');

      expect(res.status).toBe(200);
      expect(res.body.data.nowPlaying).toBeNull();
    });
  });
});
