import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    playlist: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    song: { findMany: vi.fn() },
  },
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });
const otherUserToken = generateAccessToken({ userId: 'customer-2', role: 'CUSTOMER' });

const songId1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const songId2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Playlist Routes', () => {
  // -----------------------------------------------
  // GET /playlists
  // -----------------------------------------------
  describe('GET /api/v1/playlists', () => {
    it('returns user playlists', async () => {
      mockPrisma.playlist.findMany.mockResolvedValue([
        { id: 'p1', name: 'My Playlist', songIds: [songId1, songId2], createdAt: new Date(), updatedAt: new Date() },
      ]);

      const res = await request(app)
        .get('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.playlists).toHaveLength(1);
      expect(res.body.data.playlists[0].songCount).toBe(2);
    });

    it('returns empty array when user has no playlists', async () => {
      mockPrisma.playlist.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.playlists).toHaveLength(0);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/v1/playlists');

      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------
  // GET /playlists/:id
  // -----------------------------------------------
  describe('GET /api/v1/playlists/:id', () => {
    it('returns playlist details with songs', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 'p1', userId: 'customer-1', name: 'My Playlist', songIds: [songId1],
        createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.song.findMany.mockResolvedValue([
        { id: songId1, title: 'Song 1', artist: 'Artist 1', album: null, genre: 'Pop', duration: 200, coverArtUrl: null, format: 'mp3', isActive: true },
      ]);

      const res = await request(app)
        .get('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.playlist.name).toBe('My Playlist');
      expect(res.body.data.playlist.songs).toHaveLength(1);
      expect(res.body.data.playlist.songCount).toBe(1);
    });

    it('returns 404 for nonexistent playlist', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/playlists/nonexistent')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 403 when accessing another user playlist', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 'p1', userId: 'customer-1', name: 'Not Mine',
        songIds: [], createdAt: new Date(), updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
    });
  });

  // -----------------------------------------------
  // POST /playlists
  // -----------------------------------------------
  describe('POST /api/v1/playlists', () => {
    it('creates a new playlist', async () => {
      mockPrisma.song.findMany.mockResolvedValue([
        { id: songId1 },
        { id: songId2 },
      ]);
      mockPrisma.playlist.create.mockResolvedValue({
        id: 'p1', name: 'New Playlist', songIds: [songId1, songId2],
        createdAt: new Date(), updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'New Playlist', songIds: [songId1, songId2] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.playlist.name).toBe('New Playlist');
      expect(res.body.data.playlist.songCount).toBe(2);
    });

    it('rejects playlist with invalid song IDs', async () => {
      mockPrisma.song.findMany.mockResolvedValue([{ id: songId1 }]); // only 1 of 2 found

      const res = await request(app)
        .post('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Bad Playlist', songIds: [songId1, songId2] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found or inactive/i);
    });

    it('rejects playlist without songs', async () => {
      const res = await request(app)
        .post('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Empty Playlist', songIds: [] });

      expect(res.status).toBe(400);
    });

    it('rejects playlist without a name', async () => {
      const res = await request(app)
        .post('/api/v1/playlists')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songIds: [songId1] });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------
  // PUT /playlists/:id
  // -----------------------------------------------
  describe('PUT /api/v1/playlists/:id', () => {
    it('owner can update playlist name', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({ id: 'p1', userId: 'customer-1' });
      mockPrisma.playlist.update.mockResolvedValue({
        id: 'p1', name: 'Updated Name', songIds: [songId1],
        createdAt: new Date(), updatedAt: new Date(),
      });

      const res = await request(app)
        .put('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.playlist.name).toBe('Updated Name');
    });

    it('rejects update with no fields', async () => {
      const res = await request(app)
        .put('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least/i);
    });

    it('another user cannot update (403)', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({ id: 'p1', userId: 'customer-1' });

      const res = await request(app)
        .put('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // DELETE /playlists/:id
  // -----------------------------------------------
  describe('DELETE /api/v1/playlists/:id', () => {
    it('owner can delete their playlist', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({ id: 'p1', userId: 'customer-1', name: 'My Playlist' });
      mockPrisma.playlist.delete.mockResolvedValue({});

      const res = await request(app)
        .delete('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for nonexistent playlist', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/v1/playlists/nonexistent')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
    });

    it('another user cannot delete (403)', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({ id: 'p1', userId: 'customer-1', name: 'Not Mine' });

      const res = await request(app)
        .delete('/api/v1/playlists/p1')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });
  });
});
