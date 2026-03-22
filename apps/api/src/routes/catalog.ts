import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { searchCatalog, importSongs, autoPopulateCatalog, handleSongRequest } from '../services/catalogBot.js';

export const catalogRouter = Router();

// ============================================
// Validation schemas
// ============================================

const searchSchema = z.object({
  query: z.string().default(''),
  genre: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const importSchema = z.object({
  songs: z.array(z.object({
    title: z.string().min(1),
    artist: z.string().min(1),
    album: z.string().optional(),
    genre: z.string().min(1),
    duration: z.number().int().min(1),
    fileUrl: z.string().url(),
    coverArtUrl: z.string().url().optional(),
    format: z.enum(['MP3', 'MP4']),
    fileSize: z.number().int().min(0),
  })).min(1),
});

const autoPopulateSchema = z.object({
  genres: z.array(z.string()).optional(),
  maxPerGenre: z.number().int().min(1).max(100).optional(),
});

// ============================================
// GET /catalog/search — search external sources
// ============================================
catalogRouter.get(
  '/search',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = searchSchema.parse(req.query);
      const results = await searchCatalog(params.query, {
        genre: params.genre,
        limit: params.limit,
      });

      res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
      next(err);
    }
  },
);

// ============================================
// POST /catalog/import — import selected songs
// ============================================
catalogRouter.post(
  '/import',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { songs } = importSchema.parse(req.body);
      const result = await importSongs(songs);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
      next(err);
    }
  },
);

// ============================================
// POST /catalog/auto-populate — auto-populate from all genres
// ============================================
catalogRouter.post(
  '/auto-populate',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = autoPopulateSchema.parse(req.body || {});
      const result = await autoPopulateCatalog(options);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
      next(err);
    }
  },
);

// ============================================
// POST /catalog/handle-request/:id — handle a song request
// ============================================
catalogRouter.post(
  '/handle-request/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Request ID is required', 400);

      const result = await handleSongRequest(id);

      if (!result.found) {
        return res.status(404).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
      next(err);
    }
  },
);

// ============================================
// HIERARCHICAL CATALOG BROWSE
// ============================================

// --- Validation schemas ---
const genreSchema = z.object({
  name: z.string().min(1).max(100),
  coverArtUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
});

const artistSchema = z.object({
  name: z.string().min(1).max(100),
  genreId: z.string().uuid(),
  coverArtUrl: z.string().url().optional(),
});

const albumSchema = z.object({
  name: z.string().min(1).max(100),
  artistId: z.string().uuid(),
  coverArtUrl: z.string().url().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

const batchImportSchema = z.object({
  genre: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  coverArtUrl: z.string().url().optional(),
  songs: z.array(z.object({
    title: z.string().min(1),
    trackNumber: z.number().int().optional(),
    fileUrl: z.string().min(1),
    duration: z.number().int().min(1),
    fileSize: z.number().int().min(0).default(0),
    format: z.enum(['MP3', 'MP4']).default('MP3'),
  })).min(1),
});

// --- GET /catalog/genres ---
catalogRouter.get('/genres', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const genres = await prisma.genre.findMany({
      where: { isActive: true },
      include: { _count: { select: { artists: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: { genres } });
  } catch (err) { next(err); }
});

// --- GET /catalog/genres/:id/artists ---
catalogRouter.get('/genres/:id/artists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genre = await prisma.genre.findUnique({ where: { id: req.params.id } });
    if (!genre) throw new AppError('Genre not found', 404);

    const artists = await prisma.artist.findMany({
      where: { genreId: req.params.id, isActive: true },
      include: { _count: { select: { albums: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { artists } });
  } catch (err) { next(err); }
});

// --- GET /catalog/artists/:id/albums ---
catalogRouter.get('/artists/:id/albums', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artist = await prisma.artist.findUnique({ where: { id: req.params.id } });
    if (!artist) throw new AppError('Artist not found', 404);

    const albums = await prisma.album.findMany({
      where: { artistId: req.params.id, isActive: true },
      include: { _count: { select: { songs: true } } },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: { albums } });
  } catch (err) { next(err); }
});

// --- GET /catalog/albums/:id/songs ---
catalogRouter.get('/albums/:id/songs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const album = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!album) throw new AppError('Album not found', 404);

    const songs = await prisma.song.findMany({
      where: { albumId: req.params.id, isActive: true },
      orderBy: [{ trackNumber: 'asc' }, { title: 'asc' }],
    });
    res.json({ success: true, data: { songs } });
  } catch (err) { next(err); }
});

// --- POST /catalog/genres (admin) ---
catalogRouter.post('/genres', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = genreSchema.parse(req.body);
    const existing = await prisma.genre.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('Genre already exists', 409);

    const genre = await prisma.genre.create({ data });
    res.status(201).json({ success: true, data: { genre } });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// --- POST /catalog/artists (admin) ---
catalogRouter.post('/artists', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = artistSchema.parse(req.body);
    const genre = await prisma.genre.findUnique({ where: { id: data.genreId } });
    if (!genre) throw new AppError('Genre not found', 404);

    const artist = await prisma.artist.create({ data });
    res.status(201).json({ success: true, data: { artist } });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// --- POST /catalog/albums (admin) ---
catalogRouter.post('/albums', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = albumSchema.parse(req.body);
    const artist = await prisma.artist.findUnique({ where: { id: data.artistId } });
    if (!artist) throw new AppError('Artist not found', 404);

    const album = await prisma.album.create({ data });
    res.status(201).json({ success: true, data: { album } });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// --- PUT /catalog/genres/:id (admin) ---
catalogRouter.put('/genres/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.genre.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Genre not found', 404);

    const data = genreSchema.partial().parse(req.body);
    const genre = await prisma.genre.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { genre } });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// --- DELETE /catalog/genres/:id (admin, soft-delete) ---
catalogRouter.delete('/genres/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.genre.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Genre not found', 404);

    await prisma.genre.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Genre deactivated' });
  } catch (err) { next(err); }
});

// --- DELETE /catalog/artists/:id (admin, soft-delete) ---
catalogRouter.delete('/artists/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.artist.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Artist not found', 404);

    await prisma.artist.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Artist deactivated' });
  } catch (err) { next(err); }
});

// --- DELETE /catalog/albums/:id (admin, soft-delete) ---
catalogRouter.delete('/albums/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Album not found', 404);

    await prisma.album.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Album deactivated' });
  } catch (err) { next(err); }
});

// --- POST /catalog/batch-import (admin) ---
catalogRouter.post('/batch-import', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = batchImportSchema.parse(req.body);

    // Upsert genre
    let genre = await prisma.genre.findUnique({ where: { name: data.genre } });
    if (!genre) {
      genre = await prisma.genre.create({ data: { name: data.genre } });
    }

    // Upsert artist
    let artist = await prisma.artist.findFirst({
      where: { name: data.artist, genreId: genre.id },
    });
    if (!artist) {
      artist = await prisma.artist.create({
        data: { name: data.artist, genreId: genre.id },
      });
    }

    // Upsert album
    let album = await prisma.album.findFirst({
      where: { name: data.album, artistId: artist.id },
    });
    if (!album) {
      album = await prisma.album.create({
        data: {
          name: data.album,
          artistId: artist.id,
          coverArtUrl: data.coverArtUrl,
        },
      });
    }

    // Import songs (skip duplicates by title + artist string)
    let imported = 0;
    let skipped = 0;
    for (const s of data.songs) {
      const existing = await prisma.song.findFirst({
        where: { title: s.title, artist: data.artist },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.song.create({
        data: {
          title: s.title,
          artist: data.artist,
          album: data.album,
          genre: data.genre,
          duration: s.duration,
          fileUrl: s.fileUrl,
          fileSize: s.fileSize,
          format: s.format as 'MP3' | 'MP4',
          albumId: album.id,
          trackNumber: s.trackNumber,
        },
      });
      imported++;
    }

    res.status(201).json({
      success: true,
      data: {
        genreId: genre.id,
        artistId: artist.id,
        albumId: album.id,
        imported,
        skipped,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// --- POST /catalog/sync — manifest for device sync ---
catalogRouter.post('/sync', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const since = req.body.since ? new Date(req.body.since) : undefined;

    const where: Record<string, unknown> = { isActive: true };
    if (since) {
      where.addedAt = { gte: since };
    }

    const songs = await prisma.song.findMany({
      where,
      select: {
        id: true, title: true, artist: true, album: true, genre: true,
        duration: true, fileUrl: true, fileSize: true, format: true,
        trackNumber: true, coverArtUrl: true, addedAt: true,
      },
      orderBy: [{ genre: 'asc' }, { artist: 'asc' }, { album: 'asc' }, { trackNumber: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        totalSongs: songs.length,
        generatedAt: new Date().toISOString(),
        songs,
      },
    });
  } catch (err) { next(err); }
});
