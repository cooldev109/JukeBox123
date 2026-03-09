import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const songRouter = Router();

// ============================================
// Validation schemas
// ============================================

const listSongsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  genre: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  query: z.string().optional(),
  sort: z.enum(['popularity', 'recent', 'title', 'artist']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const createSongSchema = z.object({
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(300),
  album: z.string().max(300).optional().nullable(),
  genre: z.string().min(1).max(100),
  duration: z.number().int().min(1),
  fileUrl: z.string().url(),
  videoUrl: z.string().url().optional().nullable(),
  coverArtUrl: z.string().url().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
  fileSize: z.number().int().min(0).optional().default(0),
  format: z.enum(['MP3', 'MP4']).default('MP3'),
});

const updateSongSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  artist: z.string().min(1).max(300).optional(),
  album: z.string().max(300).optional().nullable(),
  genre: z.string().min(1).max(100).optional(),
  duration: z.number().int().min(1).optional(),
  fileUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional().nullable(),
  coverArtUrl: z.string().url().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  fileSize: z.number().int().min(0).optional(),
  format: z.enum(['MP3', 'MP4']).optional(),
  isActive: z.boolean().optional(),
});

const songRequestSchema = z.object({
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(300),
  notes: z.string().max(1000).optional().nullable(),
});

const listArtistsSchema = z.object({
  query: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const listGenresSchema = z.object({
  query: z.string().optional(),
});

// ============================================
// Helper: normalize text for accent-insensitive search
// ============================================

/**
 * Strips diacritical marks (accents) from a string so that
 * Portuguese searches like "musica" match "musica" as well.
 * Used for building Prisma `contains` filters with `mode: 'insensitive'`.
 *
 * For PostgreSQL full-text search we rely on the `unaccent` extension
 * when available; this helper is the application-level fallback for
 * the simpler ILIKE-based approach used here.
 */
function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================
// GET /songs/genres — list all unique genres
// (defined BEFORE /:id to avoid route collision)
// ============================================
songRouter.get('/genres', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listGenresSchema.parse(req.query);

    const where: Prisma.SongWhereInput = { isActive: true };

    if (params.query) {
      where.genre = { contains: params.query, mode: 'insensitive' };
    }

    const genres = await prisma.song.findMany({
      where,
      select: { genre: true },
      distinct: ['genre'],
      orderBy: { genre: 'asc' },
    });

    const genreList = genres.map((g) => g.genre);

    res.json({
      success: true,
      data: { genres: genreList, total: genreList.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /songs/artists — list all unique artists with song count
// (defined BEFORE /:id to avoid route collision)
// ============================================
songRouter.get('/artists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listArtistsSchema.parse(req.query);

    const where: Prisma.SongWhereInput = { isActive: true };

    if (params.query) {
      where.artist = { contains: params.query, mode: 'insensitive' };
    }

    const artists = await prisma.song.groupBy({
      by: ['artist'],
      where,
      _count: { id: true },
      orderBy: { artist: 'asc' },
      take: params.limit,
    });

    const artistList = artists.map((a) => ({
      artist: a.artist,
      songCount: a._count.id,
    }));

    res.json({
      success: true,
      data: { artists: artistList, total: artistList.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /songs/request — customer requests a new song
// (defined BEFORE /:id to avoid route collision)
// ============================================
songRouter.post('/request', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = songRequestSchema.parse(req.body);

    const songRequest = await prisma.songRequest.create({
      data: {
        userId: req.user!.userId,
        title: data.title,
        artist: data.artist,
        notes: data.notes || null,
      },
      select: {
        id: true,
        title: true,
        artist: true,
        notes: true,
        isHandled: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: { songRequest } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /songs — list songs with filters, pagination, and search
// ============================================
songRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listSongsSchema.parse(req.query);
    const { page, limit, genre, artist, album, query, sort, order } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.SongWhereInput = { isActive: true };

    if (genre) {
      where.genre = { equals: genre, mode: 'insensitive' };
    }

    if (artist) {
      where.artist = { contains: artist, mode: 'insensitive' };
    }

    if (album) {
      where.album = { contains: album, mode: 'insensitive' };
    }

    // Full-text search across title, artist, and album
    // We use OR with ILIKE (case-insensitive contains) for broad matching.
    // Also search on accent-normalized variants for Portuguese support.
    if (query) {
      const normalizedQuery = normalizeAccents(query);
      const searchConditions: Prisma.SongWhereInput[] = [
        { title: { contains: query, mode: 'insensitive' } },
        { artist: { contains: query, mode: 'insensitive' } },
        { album: { contains: query, mode: 'insensitive' } },
      ];

      // If normalization changed the string (had accents), also search
      // with the normalized variant so "musica" matches "musica" and vice versa.
      if (normalizedQuery !== query) {
        searchConditions.push(
          { title: { contains: normalizedQuery, mode: 'insensitive' } },
          { artist: { contains: normalizedQuery, mode: 'insensitive' } },
          { album: { contains: normalizedQuery, mode: 'insensitive' } },
        );
      }

      where.OR = searchConditions;
    }

    // Build orderBy
    let orderBy: Prisma.SongOrderByWithRelationInput;
    switch (sort) {
      case 'popularity':
        orderBy = { playCount: order === 'asc' ? 'asc' : 'desc' };
        // Default to descending for popularity (most popular first)
        if (!req.query.order) orderBy = { playCount: 'desc' };
        break;
      case 'recent':
        orderBy = { addedAt: order === 'asc' ? 'asc' : 'desc' };
        // Default to descending for recent (newest first)
        if (!req.query.order) orderBy = { addedAt: 'desc' };
        break;
      case 'artist':
        orderBy = { artist: order };
        break;
      case 'title':
      default:
        orderBy = { title: order };
        break;
    }

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          genre: true,
          duration: true,
          coverArtUrl: true,
          fileUrl: true,
          format: true,
          playCount: true,
          addedAt: true,
        },
      }),
      prisma.song.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        songs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /songs/:id — song details
// ============================================
songRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const song = await prisma.song.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        genre: true,
        duration: true,
        fileUrl: true,
        videoUrl: true,
        coverArtUrl: true,
        metadata: true,
        fileSize: true,
        format: true,
        isActive: true,
        playCount: true,
        addedAt: true,
      },
    });

    if (!song) {
      throw new AppError('Song not found', 404);
    }

    if (!song.isActive) {
      throw new AppError('Song not found', 404);
    }

    res.json({ success: true, data: { song } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /songs — add a new song (ADMIN only)
// ============================================
songRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSongSchema.parse(req.body);

    const song = await prisma.song.create({
      data: {
        title: data.title,
        artist: data.artist,
        album: data.album || null,
        genre: data.genre,
        duration: data.duration,
        fileUrl: data.fileUrl,
        videoUrl: data.videoUrl || null,
        coverArtUrl: data.coverArtUrl || null,
        metadata: data.metadata as Prisma.JsonObject,
        fileSize: data.fileSize,
        format: data.format,
      },
    });

    res.status(201).json({ success: true, data: { song } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// PUT /songs/:id — update a song (ADMIN only)
// ============================================
songRouter.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = updateSongSchema.parse(req.body);

    // Verify song exists
    const existing = await prisma.song.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Song not found', 404);
    }

    // Build update payload — only include fields that were provided
    const updateData: Prisma.SongUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.artist !== undefined) updateData.artist = data.artist;
    if (data.album !== undefined) updateData.album = data.album;
    if (data.genre !== undefined) updateData.genre = data.genre;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
    if (data.coverArtUrl !== undefined) updateData.coverArtUrl = data.coverArtUrl;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Prisma.JsonObject;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
    if (data.format !== undefined) updateData.format = data.format;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const song = await prisma.song.update({
      where: { id },
      data: updateData as Prisma.SongUpdateInput,
    });

    res.json({ success: true, data: { song } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// DELETE /songs/:id — soft delete (ADMIN only)
// ============================================
songRouter.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.song.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Song not found', 404);
    }

    if (!existing.isActive) {
      throw new AppError('Song is already deactivated', 400);
    }

    await prisma.song.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Song deactivated successfully' });
  } catch (error) {
    next(error);
  }
});
