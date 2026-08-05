import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

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

    // The genre list is driven by the admin-curated Genre table so the customer
    // sees exactly the genres the admin manages (no raw ID3 junk genres). We
    // only surface curated genres that actually have at least one active song.
    const [genreRows, songGenres] = await Promise.all([
      prisma.genre.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true },
      }),
      prisma.song.findMany({
        where: { isActive: true },
        select: { genre: true },
        distinct: ['genre'],
      }),
    ]);

    const songGenreSet = new Set(songGenres.map((s) => s.genre.toLowerCase()));
    let genreList = genreRows
      .map((g) => g.name)
      .filter((name) => songGenreSet.has(name.toLowerCase()));

    if (params.query) {
      const q = params.query.toLowerCase();
      genreList = genreList.filter((name) => name.toLowerCase().includes(q));
    }

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
// GET /songs/requests — list song requests (admin sees all, customer sees own)
// ============================================
songRouter.get('/requests', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CUSTOMER') {
      where.userId = req.user!.userId;
    }

    const requests = await prisma.songRequest.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: { requests } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /songs/requests/:id/handled — admin marks request as handled
// ============================================
songRouter.put('/requests/:id/handled', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const request = await prisma.songRequest.update({
      where: { id },
      data: { isHandled: true },
    });
    res.json({ success: true, data: { request } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Helper: persist an embedded cover image to /uploads/covers
// ============================================
function saveCoverImage(data: Buffer | Uint8Array, format: string): string {
  const ext = format.includes('png')
    ? 'png'
    : format.includes('webp')
      ? 'webp'
      : 'jpg';
  const coversDir = path.join(process.cwd(), 'uploads', 'covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(coversDir, name), Buffer.from(data));
  return `/uploads/covers/${name}`;
}

// ============================================
// Helper: upsert the Genre > Artist > Album hierarchy so an uploaded song
// lands in the correct "folder" and appears in the catalog tree (not only
// the flat list). Album falls back to "Singles" when the file has no album.
// ============================================
async function buildCatalogHierarchy(opts: {
  genre: string;
  artist: string;
  album?: string | null;
  coverArtUrl?: string | null;
}): Promise<string> {
  const genreName = opts.genre?.trim() || 'Other';
  const artistName = opts.artist.trim();
  const albumName = opts.album?.trim() || 'Singles';

  let genre = await prisma.genre.findUnique({ where: { name: genreName } });
  if (!genre) {
    genre = await prisma.genre.create({ data: { name: genreName } });
  }

  let artist = await prisma.artist.findFirst({
    where: { name: artistName, genreId: genre.id },
  });
  if (!artist) {
    artist = await prisma.artist.create({
      data: { name: artistName, genreId: genre.id },
    });
  }

  let album = await prisma.album.findFirst({
    where: { name: albumName, artistId: artist.id },
  });
  if (!album) {
    album = await prisma.album.create({
      data: { name: albumName, artistId: artist.id, coverArtUrl: opts.coverArtUrl || null },
    });
  } else if (opts.coverArtUrl && !album.coverArtUrl) {
    // Backfill the album cover from the first tagged song that carries one.
    album = await prisma.album.update({
      where: { id: album.id },
      data: { coverArtUrl: opts.coverArtUrl },
    });
  }

  return album.id;
}

// ============================================
// POST /songs/upload — Admin uploads an MP3 file
// Optional body fields `genre`, `artist`, `album` (e.g. from folder names)
// override the ID3 tags and decide where the song is filed.
// ============================================
songRouter.post('/upload', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file, filename, title, artist, album, genre } = req.body;

    if (!file) {
      throw new AppError('File (base64-encoded MP3) is required', 400);
    }

    // Decode base64 and validate size (max 50MB)
    const fileBuffer = Buffer.from(file, 'base64');
    const maxSize = 50 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new AppError('File too large. Max 50MB', 400);
    }

    // Validate it looks like an MP3 (check for ID3 header or MPEG sync word)
    const isMP3 =
      (fileBuffer[0] === 0x49 && fileBuffer[1] === 0x44 && fileBuffer[2] === 0x33) || // ID3
      (fileBuffer[0] === 0xFF && (fileBuffer[1] & 0xE0) === 0xE0); // MPEG sync
    if (!isMP3) {
      throw new AppError('Invalid file format. Only MP3 files are accepted', 400);
    }

    // Extract metadata from the buffer FIRST (before writing to disk) so we can
    // dedupe and read the embedded cover art without leaving orphan files.
    // Folder-derived genre/artist/album (passed in the body) take priority.
    let extractedTitle = title || null;
    let extractedArtist = artist || null;
    let extractedAlbum = album || null;
    let extractedGenre = genre || null;
    let extractedDuration = 0;
    let trackNumber: number | null = null;
    let coverPicture: { data: Uint8Array; format: string } | null = null;

    try {
      const mm = await import('music-metadata');
      const metadata = await mm.parseBuffer(
        fileBuffer,
        { mimeType: 'audio/mpeg' },
        { duration: true },
      );
      if (!extractedTitle && metadata.common.title) {
        extractedTitle = metadata.common.title;
      }
      if (!extractedArtist && metadata.common.artist) {
        extractedArtist = metadata.common.artist;
      }
      if (!extractedAlbum && metadata.common.album) {
        extractedAlbum = metadata.common.album;
      }
      // NOTE: we deliberately do NOT read the genre from ID3 tags — they are
      // wildly inconsistent ("Alternative Metal", "Arrocha", …) and created a
      // mess of junk genres. Genre is controlled by the admin: the folder name
      // or the upload form decides it, otherwise it falls back to "Other".
      if (metadata.format.duration) {
        extractedDuration = Math.round(metadata.format.duration);
      }
      if (metadata.common.track && metadata.common.track.no) {
        trackNumber = metadata.common.track.no;
      }
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        coverPicture = { data: pic.data, format: pic.format };
      }
    } catch {
      // music-metadata not available or parsing failed — use provided fields
    }

    // Fallbacks if metadata extraction did not fill the fields.
    // Prefer the original filename (sent by the uploader) over "Untitled"
    // so untagged MP3s still arrive in the catalog with a recognisable name.
    if (!extractedTitle && filename && typeof filename === 'string') {
      extractedTitle = filename.replace(/\.[^/.]+$/, '').trim() || null;
    }
    if (!extractedTitle) {
      extractedTitle = 'Untitled';
    }
    if (!extractedArtist) {
      extractedArtist = 'Unknown Artist';
    }
    if (!extractedGenre) {
      extractedGenre = 'Other';
    }
    if (!extractedDuration || extractedDuration <= 0) {
      extractedDuration = 0;
    }

    // Skip exact duplicates (same title + artist) so repeated folder uploads
    // don't pile up copies. Only when we actually resolved real names.
    if (extractedTitle !== 'Untitled' && extractedArtist !== 'Unknown Artist') {
      const dup = await prisma.song.findFirst({
        where: { title: extractedTitle, artist: extractedArtist, isActive: true },
        select: { id: true },
      });
      if (dup) {
        throw new AppError('Song already exists (duplicate)', 409);
      }
    }

    // Persist the audio file
    const musicDir = path.join(process.cwd(), 'uploads', 'music');
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }
    const fileName = `${crypto.randomUUID()}.mp3`;
    fs.writeFileSync(path.join(musicDir, fileName), fileBuffer);

    // Persist the embedded cover art, if the file carried one
    let coverArtUrl: string | null = null;
    if (coverPicture) {
      try {
        coverArtUrl = saveCoverImage(coverPicture.data, coverPicture.format);
      } catch {
        coverArtUrl = null;
      }
    }

    // File the song into Genre > Artist > Album (only when we know the artist)
    let albumId: string | null = null;
    if (extractedArtist !== 'Unknown Artist') {
      try {
        albumId = await buildCatalogHierarchy({
          genre: extractedGenre,
          artist: extractedArtist,
          album: extractedAlbum,
          coverArtUrl,
        });
      } catch {
        albumId = null;
      }
    }

    // Create Song record in database
    const song = await prisma.song.create({
      data: {
        title: extractedTitle,
        artist: extractedArtist,
        album: extractedAlbum || null,
        genre: extractedGenre,
        duration: extractedDuration,
        fileUrl: `/uploads/music/${fileName}`,
        coverArtUrl,
        fileSize: fileBuffer.length,
        format: 'MP3',
        albumId,
        trackNumber,
        metadata: {} as Prisma.JsonObject,
      },
    });

    res.status(201).json({ success: true, data: { song } });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
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

    // If genre / artist / album changed, re-file the song into the
    // Genre > Artist > Album tree so the hierarchy view stays in sync.
    if (data.genre !== undefined || data.artist !== undefined || data.album !== undefined) {
      const finalArtist = (data.artist ?? existing.artist) || '';
      const finalGenre = (data.genre ?? existing.genre) || 'Other';
      const finalAlbum = data.album ?? existing.album;
      if (finalArtist && finalArtist !== 'Unknown Artist') {
        try {
          const albumId = await buildCatalogHierarchy({
            genre: finalGenre,
            artist: finalArtist,
            album: finalAlbum,
            coverArtUrl: existing.coverArtUrl,
          });
          updateData.albumRef = { connect: { id: albumId } };
        } catch {
          // keep the existing filing if the tree could not be built
        }
      }
    }

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
