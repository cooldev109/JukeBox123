import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    song: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    songRequest: {
      create: vi.fn(),
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
const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Songs Routes', () => {
  // -----------------------------------------------
  // GET /songs
  // -----------------------------------------------
  describe('GET /api/v1/songs', () => {
    it('returns paginated song list', async () => {
      const songs = [
        { id: 's1', title: 'Song One', artist: 'Artist A', album: null, genre: 'Pop', duration: 200, coverArtUrl: null, fileUrl: 'http://file.mp3', format: 'MP3', playCount: 5, addedAt: new Date() },
        { id: 's2', title: 'Song Two', artist: 'Artist B', album: 'Album X', genre: 'Rock', duration: 180, coverArtUrl: null, fileUrl: 'http://file2.mp3', format: 'MP3', playCount: 10, addedAt: new Date() },
      ];
      mockPrisma.song.findMany.mockResolvedValue(songs);
      mockPrisma.song.count.mockResolvedValue(2);

      const res = await request(app).get('/api/v1/songs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.songs).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('supports search via query parameter', async () => {
      mockPrisma.song.findMany.mockResolvedValue([
        { id: 's1', title: 'Test Song', artist: 'Test Artist', album: null, genre: 'Pop', duration: 200, coverArtUrl: null, fileUrl: 'http://file.mp3', format: 'MP3', playCount: 0, addedAt: new Date() },
      ]);
      mockPrisma.song.count.mockResolvedValue(1);

      const res = await request(app).get('/api/v1/songs?query=test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.songs).toHaveLength(1);
      // Verify that findMany was called (search filter is built)
      expect(mockPrisma.song.findMany).toHaveBeenCalled();
    });

    it('supports pagination parameters', async () => {
      mockPrisma.song.findMany.mockResolvedValue([]);
      mockPrisma.song.count.mockResolvedValue(50);

      const res = await request(app).get('/api/v1/songs?page=3&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(3);
      expect(res.body.data.pagination.limit).toBe(10);
      expect(res.body.data.pagination.totalPages).toBe(5);
      expect(res.body.data.pagination.hasNext).toBe(true);
      expect(res.body.data.pagination.hasPrev).toBe(true);
    });
  });

  // -----------------------------------------------
  // GET /songs/:id
  // -----------------------------------------------
  describe('GET /api/v1/songs/:id', () => {
    it('returns a single song by ID', async () => {
      const song = {
        id: 's1',
        title: 'Test Song',
        artist: 'Test Artist',
        album: null,
        genre: 'Pop',
        duration: 200,
        fileUrl: 'http://file.mp3',
        videoUrl: null,
        coverArtUrl: null,
        metadata: {},
        fileSize: 5000000,
        format: 'MP3',
        isActive: true,
        playCount: 10,
        addedAt: new Date(),
      };
      mockPrisma.song.findUnique.mockResolvedValue(song);

      const res = await request(app).get('/api/v1/songs/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.song.id).toBe('s1');
      expect(res.body.data.song.title).toBe('Test Song');
    });

    it('returns 404 when song does not exist', async () => {
      mockPrisma.song.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/songs/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 404 when song is inactive', async () => {
      mockPrisma.song.findUnique.mockResolvedValue({
        id: 's1',
        title: 'Deleted Song',
        isActive: false,
      });

      const res = await request(app).get('/api/v1/songs/s1');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // POST /songs
  // -----------------------------------------------
  describe('POST /api/v1/songs', () => {
    const validSong = {
      title: 'New Song',
      artist: 'New Artist',
      genre: 'Electronic',
      duration: 240,
      fileUrl: 'https://cdn.example.com/song.mp3',
    };

    it('admin can create a song', async () => {
      const created = {
        id: 's-new',
        ...validSong,
        album: null,
        videoUrl: null,
        coverArtUrl: null,
        metadata: {},
        fileSize: 0,
        format: 'MP3',
        isActive: true,
        playCount: 0,
        addedAt: new Date(),
      };
      mockPrisma.song.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/v1/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSong);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.song.title).toBe('New Song');
      expect(mockPrisma.song.create).toHaveBeenCalledOnce();
    });

    it('customer cannot create a song (403)', async () => {
      const res = await request(app)
        .post('/api/v1/songs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validSong);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/insufficient permissions/i);
      expect(mockPrisma.song.create).not.toHaveBeenCalled();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/v1/songs')
        .send(validSong);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with invalid song data', async () => {
      const res = await request(app)
        .post('/api/v1/songs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'No required fields' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // DELETE /songs/:id
  // -----------------------------------------------
  describe('DELETE /api/v1/songs/:id', () => {
    it('admin can soft-delete a song', async () => {
      mockPrisma.song.findUnique.mockResolvedValue({
        id: 's1',
        title: 'Song To Delete',
        isActive: true,
      });
      mockPrisma.song.update.mockResolvedValue({
        id: 's1',
        isActive: false,
      });

      const res = await request(app)
        .delete('/api/v1/songs/s1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('returns 404 when song does not exist', async () => {
      mockPrisma.song.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/v1/songs/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when song is already deactivated', async () => {
      mockPrisma.song.findUnique.mockResolvedValue({
        id: 's1',
        isActive: false,
      });

      const res = await request(app)
        .delete('/api/v1/songs/s1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already deactivated/i);
    });

    it('customer cannot delete a song (403)', async () => {
      const res = await request(app)
        .delete('/api/v1/songs/s1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
