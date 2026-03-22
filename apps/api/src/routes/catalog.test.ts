import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    song: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    songRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const REQUEST_ID = '00000000-0000-0000-0000-000000000060';

const adminToken = generateAccessToken({ userId: ADMIN_ID, role: 'ADMIN' });
const customerToken = generateAccessToken({ userId: CUSTOMER_ID, role: 'CUSTOMER' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Catalog Routes', () => {
  // -----------------------------------------------
  // GET /catalog/search
  // -----------------------------------------------
  describe('GET /api/v1/catalog/search', () => {
    it('returns search results for admin', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search?query=samba')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.songs).toBeDefined();
      expect(res.body.data.source).toBe('mock');
    });

    it('filters by genre', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search?genre=Bossa%20Nova')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.songs.length).toBeGreaterThan(0);
      expect(res.body.data.songs.every((s: any) => s.genre === 'Bossa Nova')).toBe(true);
    });

    it('returns empty for no match', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search?query=nonexistentsong')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.songs).toHaveLength(0);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search?query=samba')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('requires auth', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search?query=samba');

      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------
  // POST /catalog/import
  // -----------------------------------------------
  describe('POST /api/v1/catalog/import', () => {
    it('imports songs successfully', async () => {
      mockPrisma.song.findFirst.mockResolvedValue(null);
      mockPrisma.song.create.mockResolvedValue({ id: 'new-song-1' });

      const res = await request(app)
        .post('/api/v1/catalog/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          songs: [
            {
              title: 'Test Song',
              artist: 'Test Artist',
              genre: 'Pop',
              duration: 200,
              fileUrl: 'https://example.com/test.mp3',
              format: 'MP3',
              fileSize: 5000000,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.skipped).toBe(0);
    });

    it('skips duplicates', async () => {
      mockPrisma.song.findFirst.mockResolvedValue({ id: 'existing-song' });

      const res = await request(app)
        .post('/api/v1/catalog/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          songs: [
            {
              title: 'Existing Song',
              artist: 'Existing Artist',
              genre: 'Rock',
              duration: 180,
              fileUrl: 'https://example.com/existing.mp3',
              format: 'MP3',
              fileSize: 4000000,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.imported).toBe(0);
      expect(res.body.data.skipped).toBe(1);
    });

    it('validates song data', async () => {
      const res = await request(app)
        .post('/api/v1/catalog/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ songs: [] });

      expect(res.status).toBe(400);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/catalog/import')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ songs: [{ title: 'X', artist: 'Y', genre: 'Z', duration: 100, fileUrl: 'https://example.com/x.mp3', format: 'MP3', fileSize: 1000 }] });

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /catalog/auto-populate
  // -----------------------------------------------
  describe('POST /api/v1/catalog/auto-populate', () => {
    it('auto-populates catalog', async () => {
      mockPrisma.song.findFirst.mockResolvedValue(null);
      mockPrisma.song.create.mockResolvedValue({ id: 'new-song' });

      const res = await request(app)
        .post('/api/v1/catalog/auto-populate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ genres: ['Samba'], maxPerGenre: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBeGreaterThanOrEqual(0);
      expect(res.body.data).toHaveProperty('skipped');
      expect(res.body.data).toHaveProperty('errors');
    });

    it('works with empty body', async () => {
      mockPrisma.song.findFirst.mockResolvedValue({ id: 'existing' });

      const res = await request(app)
        .post('/api/v1/catalog/auto-populate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/catalog/auto-populate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------
  // POST /catalog/handle-request/:id
  // -----------------------------------------------
  describe('POST /api/v1/catalog/handle-request/:id', () => {
    it('handles a song request that matches', async () => {
      // handleSongRequest searches for "{title} {artist}" in mock catalog.
      // Mock catalog checks song.title.includes(query) || song.artist.includes(query).
      // "Garota de Ipanema" includes "garota" so query "Garota" will match.
      mockPrisma.songRequest.findUnique.mockResolvedValue({
        id: REQUEST_ID,
        title: 'Garota',
        artist: '',
      });
      mockPrisma.song.findFirst
        .mockResolvedValueOnce(null) // importSongs: not existing in catalog
        .mockResolvedValueOnce({ id: 'imported-song-1' }); // handleSongRequest: find newly imported
      mockPrisma.song.create.mockResolvedValue({ id: 'imported-song-1' });
      mockPrisma.songRequest.update.mockResolvedValue({});

      const res = await request(app)
        .post(`/api/v1/catalog/handle-request/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.found).toBe(true);
      expect(res.body.data.songId).toBe('imported-song-1');
    });

    it('returns 404 for non-existent request', async () => {
      mockPrisma.songRequest.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/catalog/handle-request/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when song not found in sources', async () => {
      mockPrisma.songRequest.findUnique.mockResolvedValue({
        id: REQUEST_ID,
        title: 'Unknown Song XYZ',
        artist: 'Nobody',
      });

      const res = await request(app)
        .post(`/api/v1/catalog/handle-request/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No results found');
    });

    it('rejects non-admin', async () => {
      const res = await request(app)
        .post(`/api/v1/catalog/handle-request/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
