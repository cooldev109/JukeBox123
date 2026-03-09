import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const playlistRouter = Router();

// ============================================
// Validation schemas
// ============================================
const createPlaylistSchema = z.object({
  name: z.string().min(1).max(200),
  songIds: z.array(z.string().uuid()).min(1, 'At least one song is required'),
});

const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  songIds: z.array(z.string().uuid()).optional(),
});

// ============================================
// GET /playlists — List current user's playlists
// ============================================
playlistRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlists = await prisma.playlist.findMany({
        where: { userId: req.user!.userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          songIds: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        data: {
          playlists: playlists.map((p) => ({
            ...p,
            songCount: p.songIds.length,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// GET /playlists/:id — Playlist details with song data
// ============================================
playlistRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlistId = req.params.id as string;

      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        select: {
          id: true,
          userId: true,
          name: true,
          songIds: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!playlist) {
        throw new AppError('Playlist not found', 404);
      }

      // Only the owner can view their playlist
      if (playlist.userId !== req.user!.userId) {
        throw new AppError('Access denied', 403);
      }

      // Fetch full song data for all songIds
      let songs: Array<{
        id: string;
        title: string;
        artist: string;
        album: string | null;
        genre: string;
        duration: number;
        coverArtUrl: string | null;
        format: string;
        isActive: boolean;
      }> = [];

      if (playlist.songIds.length > 0) {
        const songRecords = await prisma.song.findMany({
          where: { id: { in: playlist.songIds } },
          select: {
            id: true,
            title: true,
            artist: true,
            album: true,
            genre: true,
            duration: true,
            coverArtUrl: true,
            format: true,
            isActive: true,
          },
        });

        // Preserve the playlist order — return songs in the same order as songIds
        const songMap = new Map(songRecords.map((s) => [s.id, s]));
        songs = playlist.songIds
          .map((id) => songMap.get(id))
          .filter((s): s is NonNullable<typeof s> => s != null);
      }

      const { userId: _userId, ...playlistData } = playlist;

      res.json({
        success: true,
        data: {
          playlist: {
            ...playlistData,
            songCount: songs.length,
            songs,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// POST /playlists — Create playlist
// ============================================
playlistRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createPlaylistSchema.parse(req.body);

      // Validate that all songIds reference real, active songs
      const existingSongs = await prisma.song.findMany({
        where: { id: { in: data.songIds }, isActive: true },
        select: { id: true },
      });

      const existingIds = new Set(existingSongs.map((s) => s.id));
      const invalidIds = data.songIds.filter((id) => !existingIds.has(id));

      if (invalidIds.length > 0) {
        throw new AppError(
          `Songs not found or inactive: ${invalidIds.join(', ')}`,
          400,
        );
      }

      const playlist = await prisma.playlist.create({
        data: {
          userId: req.user!.userId,
          name: data.name,
          songIds: data.songIds,
        },
        select: {
          id: true,
          name: true,
          songIds: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          playlist: {
            ...playlist,
            songCount: playlist.songIds.length,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  },
);

// ============================================
// PUT /playlists/:id — Update playlist (owner only)
// ============================================
playlistRouter.put(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlistId = req.params.id as string;
      const data = updatePlaylistSchema.parse(req.body);

      // At least one field must be provided
      if (data.name === undefined && data.songIds === undefined) {
        throw new AppError('Provide at least name or songIds to update', 400);
      }

      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        select: { id: true, userId: true },
      });

      if (!playlist) {
        throw new AppError('Playlist not found', 404);
      }

      if (playlist.userId !== req.user!.userId) {
        throw new AppError('Access denied', 403);
      }

      // If songIds are provided, validate they exist and are active
      if (data.songIds !== undefined) {
        const existingSongs = await prisma.song.findMany({
          where: { id: { in: data.songIds }, isActive: true },
          select: { id: true },
        });

        const existingIds = new Set(existingSongs.map((s) => s.id));
        const invalidIds = data.songIds.filter((id) => !existingIds.has(id));

        if (invalidIds.length > 0) {
          throw new AppError(
            `Songs not found or inactive: ${invalidIds.join(', ')}`,
            400,
          );
        }
      }

      const updated = await prisma.playlist.update({
        where: { id: playlistId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.songIds !== undefined && { songIds: data.songIds }),
        },
        select: {
          id: true,
          name: true,
          songIds: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        data: {
          playlist: {
            ...updated,
            songCount: updated.songIds.length,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors[0].message, 400));
      }
      next(error);
    }
  },
);

// ============================================
// DELETE /playlists/:id — Delete playlist (owner only)
// ============================================
playlistRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlistId = req.params.id as string;

      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        select: { id: true, userId: true, name: true },
      });

      if (!playlist) {
        throw new AppError('Playlist not found', 404);
      }

      if (playlist.userId !== req.user!.userId) {
        throw new AppError('Access denied', 403);
      }

      await prisma.playlist.delete({
        where: { id: playlistId },
      });

      res.json({
        success: true,
        data: {
          message: `Playlist "${playlist.name}" deleted`,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
