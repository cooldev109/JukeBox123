import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    venue: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    machine: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    wallet: { findUnique: vi.fn(), create: vi.fn() },
    globalConfig: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
    machineAlert: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    song: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    songRequest: { findUnique: vi.fn(), update: vi.fn() },
    queueItem: { count: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
    genre: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    artist: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    album: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock('../socket.js', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
}));

vi.mock('../lib/stripe.js', () => ({
  createPaymentIntent: vi.fn(), createCustomer: vi.fn(), attachPaymentMethod: vi.fn(),
  listPaymentMethods: vi.fn(), constructWebhookEvent: vi.fn(),
}));

vi.mock('../lib/pushNotifications.js', () => ({
  getVapidPublicKey: vi.fn().mockReturnValue('test-vapid-key'),
  sendPushNotification: vi.fn(), notifyUser: vi.fn(), notifyRole: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const GENRE_ID = '00000000-0000-0000-0000-000000000080';
const ARTIST_ID = '00000000-0000-0000-0000-000000000081';
const ALBUM_ID = '00000000-0000-0000-0000-000000000082';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });

beforeEach(() => { vi.clearAllMocks(); });

describe('Catalog Hierarchy', () => {
  describe('GET /api/v1/catalog/genres', () => {
    it('lists genres with artist count', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: GENRE_ID, name: 'Rock', isActive: true, _count: { artists: 5 } },
      ]);

      const res = await request(app).get('/api/v1/catalog/genres');
      expect(res.status).toBe(200);
      expect(res.body.data.genres).toHaveLength(1);
      expect(res.body.data.genres[0]._count.artists).toBe(5);
    });
  });

  describe('GET /api/v1/catalog/genres/:id/artists', () => {
    it('lists artists in genre', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue({ id: GENRE_ID });
      mockPrisma.artist.findMany.mockResolvedValue([
        { id: ARTIST_ID, name: 'Metallica', _count: { albums: 3 } },
      ]);

      const res = await request(app).get(`/api/v1/catalog/genres/${GENRE_ID}/artists`);
      expect(res.status).toBe(200);
      expect(res.body.data.artists[0].name).toBe('Metallica');
    });

    it('returns 404 for non-existent genre', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/catalog/genres/${GENRE_ID}/artists`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/catalog/artists/:id/albums', () => {
    it('lists albums by artist', async () => {
      mockPrisma.artist.findUnique.mockResolvedValue({ id: ARTIST_ID });
      mockPrisma.album.findMany.mockResolvedValue([
        { id: ALBUM_ID, name: 'Master of Puppets', year: 1986, _count: { songs: 8 } },
      ]);

      const res = await request(app).get(`/api/v1/catalog/artists/${ARTIST_ID}/albums`);
      expect(res.status).toBe(200);
      expect(res.body.data.albums[0].name).toBe('Master of Puppets');
    });
  });

  describe('GET /api/v1/catalog/albums/:id/songs', () => {
    it('lists songs in album', async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ id: ALBUM_ID });
      mockPrisma.song.findMany.mockResolvedValue([
        { id: 's1', title: 'Battery', trackNumber: 1, duration: 312 },
      ]);

      const res = await request(app).get(`/api/v1/catalog/albums/${ALBUM_ID}/songs`);
      expect(res.status).toBe(200);
      expect(res.body.data.songs[0].title).toBe('Battery');
    });
  });

  describe('POST /api/v1/catalog/genres', () => {
    it('admin can create genre', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue(null);
      mockPrisma.genre.create.mockResolvedValue({ id: GENRE_ID, name: 'Jazz' });

      const res = await request(app)
        .post('/api/v1/catalog/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Jazz' });

      expect(res.status).toBe(201);
      expect(res.body.data.genre.name).toBe('Jazz');
    });

    it('rejects duplicate genre', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue({ id: GENRE_ID, name: 'Rock' });

      const res = await request(app)
        .post('/api/v1/catalog/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Rock' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/catalog/artists', () => {
    it('admin can create artist', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue({ id: GENRE_ID });
      mockPrisma.artist.create.mockResolvedValue({ id: ARTIST_ID, name: 'Iron Maiden', genreId: GENRE_ID });

      const res = await request(app)
        .post('/api/v1/catalog/artists')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Iron Maiden', genreId: GENRE_ID });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/v1/catalog/albums', () => {
    it('admin can create album', async () => {
      mockPrisma.artist.findUnique.mockResolvedValue({ id: ARTIST_ID });
      mockPrisma.album.create.mockResolvedValue({ id: ALBUM_ID, name: 'Powerslave', artistId: ARTIST_ID });

      const res = await request(app)
        .post('/api/v1/catalog/albums')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Powerslave', artistId: ARTIST_ID });

      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/v1/catalog/genres/:id', () => {
    it('admin can soft-delete genre', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue({ id: GENRE_ID });
      mockPrisma.genre.update.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/v1/catalog/genres/${GENRE_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/catalog/batch-import', () => {
    it('creates full hierarchy and imports songs', async () => {
      // Genre doesn't exist
      mockPrisma.genre.findUnique.mockResolvedValue(null);
      mockPrisma.genre.create.mockResolvedValue({ id: GENRE_ID, name: 'Rock' });
      // Artist doesn't exist
      mockPrisma.artist.findFirst.mockResolvedValue(null);
      mockPrisma.artist.create.mockResolvedValue({ id: ARTIST_ID, name: 'AC/DC', genreId: GENRE_ID });
      // Album doesn't exist
      mockPrisma.album.findFirst.mockResolvedValue(null);
      mockPrisma.album.create.mockResolvedValue({ id: ALBUM_ID, name: 'Back in Black', artistId: ARTIST_ID });
      // No duplicate songs
      mockPrisma.song.findFirst.mockResolvedValue(null);
      mockPrisma.song.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/catalog/batch-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          genre: 'Rock',
          artist: 'AC/DC',
          album: 'Back in Black',
          songs: [
            { title: 'Hells Bells', fileUrl: 'http://example.com/hells.mp3', duration: 312, fileSize: 5000000 },
            { title: 'Back in Black', fileUrl: 'http://example.com/bib.mp3', duration: 255, fileSize: 4000000 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.imported).toBe(2);
      expect(res.body.data.skipped).toBe(0);
    });

    it('skips duplicate songs', async () => {
      mockPrisma.genre.findUnique.mockResolvedValue({ id: GENRE_ID });
      mockPrisma.artist.findFirst.mockResolvedValue({ id: ARTIST_ID });
      mockPrisma.album.findFirst.mockResolvedValue({ id: ALBUM_ID });
      // Song already exists
      mockPrisma.song.findFirst.mockResolvedValue({ id: 's1', title: 'Existing' });

      const res = await request(app)
        .post('/api/v1/catalog/batch-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          genre: 'Rock',
          artist: 'AC/DC',
          album: 'Back in Black',
          songs: [
            { title: 'Existing', fileUrl: 'http://example.com/e.mp3', duration: 200, fileSize: 3000000 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.imported).toBe(0);
      expect(res.body.data.skipped).toBe(1);
    });
  });

  describe('POST /api/v1/catalog/sync', () => {
    it('returns song manifest', async () => {
      mockPrisma.song.findMany.mockResolvedValue([
        { id: 's1', title: 'Song 1', artist: 'A', genre: 'Rock', duration: 200 },
      ]);

      const res = await request(app)
        .post('/api/v1/catalog/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.totalSongs).toBe(1);
      expect(res.body.data.generatedAt).toBeDefined();
    });
  });
});
