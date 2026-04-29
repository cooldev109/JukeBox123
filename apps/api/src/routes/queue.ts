import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getIO } from '../socket.js';

export const queueRouter = Router();

// ============================================
// Validation schemas
// ============================================
const addToQueueSchema = z.object({
  songId: z.string().uuid(),
  isPriority: z.boolean().default(false),
});

const reorderQueueSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(1),
    }),
  ).min(1),
});

// ============================================
// Helper: Sweep stale PLAYING items.
// If a song has been PLAYING longer than (its duration + 60s buffer)
// the TV must have crashed or been closed mid-song — mark it PLAYED so
// the queue advances on the next fetch. This prevents the customer
// experience of a song restarting from the beginning when the TV
// reopens hours after that song already finished.
// ============================================
async function sweepStalePlaying(machineId: string) {
  const stalePlaying = await prisma.queueItem.findMany({
    where: { machineId, status: 'PLAYING' },
    include: { song: { select: { duration: true } } },
  });
  const now = Date.now();
  const stale: string[] = [];
  for (const item of stalePlaying) {
    if (!item.playedAt) continue;
    const songDurationMs = (item.song?.duration || 240) * 1000;
    const elapsed = now - item.playedAt.getTime();
    // 60s buffer to absorb minor clock skew + special-event silences
    if (elapsed > songDurationMs + 60_000) stale.push(item.id);
  }
  if (stale.length > 0) {
    await prisma.queueItem.updateMany({
      where: { id: { in: stale } },
      data: { status: 'PLAYED' },
    });
  }
}

// ============================================
// Helper: Fetch full queue for a machine
// ============================================
async function getFullQueue(machineId: string) {
  await sweepStalePlaying(machineId);
  return prisma.queueItem.findMany({
    where: {
      machineId,
      status: { in: ['PENDING', 'PLAYING'] },
    },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          genre: true,
          duration: true,
          coverArtUrl: true,
          fileUrl: true,
          videoUrl: true,
          format: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  });
}

// ============================================
// Helper: Verify machine exists
// ============================================
async function findMachineOrThrow(machineId: string) {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
  });
  if (!machine) {
    throw new AppError('Machine not found', 404);
  }
  return machine;
}

// ============================================
// GET /:id/queue — Current queue for a machine
// ============================================
queueRouter.get('/:id/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machineId = req.params.id as string;

    await findMachineOrThrow(machineId);

    const queue = await getFullQueue(machineId);

    res.json({
      success: true,
      data: {
        machineId,
        queue,
        total: queue.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /:id/queue — Add song to queue
// ============================================
queueRouter.post(
  '/:id/queue',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;
      const data = addToQueueSchema.parse(req.body);
      const userId = req.user!.userId;

      // Verify machine exists and is online
      const machine = await findMachineOrThrow(machineId);
      if (machine.status === 'OFFLINE') {
        throw new AppError('Machine is currently offline', 400);
      }

      // Verify song exists and is active
      const song = await prisma.song.findUnique({
        where: { id: data.songId },
      });
      if (!song) {
        throw new AppError('Song not found', 404);
      }
      if (!song.isActive) {
        throw new AppError('Song is not currently available', 400);
      }

      // Calculate position
      let position: number;

      if (data.isPriority) {
        // Priority songs go after any currently playing song, but before regular queue.
        // Find the first PENDING item's position. Priority inserts at position 1 or 2
        // (after the currently playing song).
        const playingItem = await prisma.queueItem.findFirst({
          where: { machineId, status: 'PLAYING' },
        });

        // Count existing priority items that are still pending to stack after them
        const pendingPriorityCount = await prisma.queueItem.count({
          where: {
            machineId,
            status: 'PENDING',
            isPriority: true,
          },
        });

        // Position right after playing song + existing priority items
        const basePosition = playingItem ? playingItem.position : 0;
        position = basePosition + pendingPriorityCount + 1;

        // Shift non-priority pending items down to make room
        await prisma.queueItem.updateMany({
          where: {
            machineId,
            status: 'PENDING',
            isPriority: false,
            position: { gte: position },
          },
          data: {
            position: { increment: 1 },
          },
        });
      } else {
        // Regular song goes to end of queue
        const lastItem = await prisma.queueItem.findFirst({
          where: {
            machineId,
            status: { in: ['PENDING', 'PLAYING'] },
          },
          orderBy: { position: 'desc' },
        });

        position = lastItem ? lastItem.position + 1 : 1;
      }

      // Create queue item
      const queueItem = await prisma.queueItem.create({
        data: {
          machineId,
          songId: data.songId,
          userId,
          position,
          isPriority: data.isPriority,
          status: 'PENDING',
        },
        include: {
          song: {
            select: {
              id: true,
              title: true,
              artist: true,
              album: true,
              genre: true,
              duration: true,
              coverArtUrl: true,
              fileUrl: true,
              videoUrl: true,
              format: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Emit WebSocket events
      const io = getIO();
      io.to(`machine:${machineId}`).emit('queue:song-added', queueItem);

      const updatedQueue = await getFullQueue(machineId);
      io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);

      res.status(201).json({
        success: true,
        data: { queueItem },
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
// DELETE /:id/queue/:queueId — Remove from queue
// ============================================
queueRouter.delete(
  '/:id/queue/:queueId',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;
      const queueId = req.params.queueId as string;

      await findMachineOrThrow(machineId);

      // Find the queue item
      const queueItem = await prisma.queueItem.findUnique({
        where: { id: queueId },
      });
      if (!queueItem) {
        throw new AppError('Queue item not found', 404);
      }
      if (queueItem.machineId !== machineId) {
        throw new AppError('Queue item does not belong to this machine', 400);
      }
      if (queueItem.status === 'PLAYING') {
        throw new AppError('Cannot remove a currently playing song. Use skip instead.', 400);
      }
      if (queueItem.status === 'PLAYED' || queueItem.status === 'SKIPPED') {
        throw new AppError('Cannot remove a song that has already been played or skipped', 400);
      }

      const removedPosition = queueItem.position;

      // Delete the item
      await prisma.queueItem.delete({
        where: { id: queueId },
      });

      // Shift remaining items up to fill the gap
      await prisma.queueItem.updateMany({
        where: {
          machineId,
          status: 'PENDING',
          position: { gt: removedPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // Emit updated queue
      const io = getIO();
      const updatedQueue = await getFullQueue(machineId);
      io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);

      res.json({
        success: true,
        message: 'Song removed from queue',
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// PUT /:id/queue/reorder — Reorder queue
// ============================================
queueRouter.put(
  '/:id/queue/reorder',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;
      const data = reorderQueueSchema.parse(req.body);

      await findMachineOrThrow(machineId);

      // Verify all queue items exist and belong to this machine
      const itemIds = data.items.map((item) => item.id);
      const existingItems = await prisma.queueItem.findMany({
        where: {
          id: { in: itemIds },
          machineId,
          status: 'PENDING',
        },
      });

      if (existingItems.length !== data.items.length) {
        throw new AppError(
          'One or more queue items not found, do not belong to this machine, or are not in PENDING status',
          400,
        );
      }

      // Check for duplicate positions
      const positions = data.items.map((item) => item.position);
      const uniquePositions = new Set(positions);
      if (uniquePositions.size !== positions.length) {
        throw new AppError('Duplicate positions are not allowed', 400);
      }

      // Update positions in a transaction
      await prisma.$transaction(
        data.items.map((item) =>
          prisma.queueItem.update({
            where: { id: item.id },
            data: { position: item.position },
          }),
        ),
      );

      // Emit updated queue
      const io = getIO();
      const updatedQueue = await getFullQueue(machineId);
      io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);

      res.json({
        success: true,
        data: {
          machineId,
          queue: updatedQueue,
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
// POST /:id/queue/skip — Skip current song
// ============================================
queueRouter.post(
  '/:id/queue/skip',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;

      await findMachineOrThrow(machineId);

      // Find the currently playing item
      const currentlyPlaying = await prisma.queueItem.findFirst({
        where: { machineId, status: 'PLAYING' },
      });

      if (!currentlyPlaying) {
        throw new AppError('No song is currently playing', 400);
      }

      // Find the next pending item in queue order
      const nextInQueue = await prisma.queueItem.findFirst({
        where: {
          machineId,
          status: 'PENDING',
        },
        orderBy: { position: 'asc' },
      });

      // Use a transaction: mark current as SKIPPED, advance next to PLAYING
      await prisma.$transaction(async (tx) => {
        // Mark current as SKIPPED
        await tx.queueItem.update({
          where: { id: currentlyPlaying.id },
          data: {
            status: 'SKIPPED',
            playedAt: new Date(),
          },
        });

        // Advance next song to PLAYING if there is one
        if (nextInQueue) {
          await tx.queueItem.update({
            where: { id: nextInQueue.id },
            data: {
              status: 'PLAYING',
              playedAt: new Date(),
            },
          });
        }
      });

      // Fetch the now-playing item with full data
      const nowPlaying = nextInQueue
        ? await prisma.queueItem.findUnique({
            where: { id: nextInQueue.id },
            include: {
              song: {
                select: {
                  id: true,
                  title: true,
                  artist: true,
                  album: true,
                  genre: true,
                  duration: true,
                  coverArtUrl: true,
                  fileUrl: true,
                  videoUrl: true,
                  format: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          })
        : null;

      // Increment play count for the new song
      if (nowPlaying) {
        await prisma.song.update({
          where: { id: nowPlaying.songId },
          data: { playCount: { increment: 1 } },
        });
      }

      // Emit WebSocket events
      const io = getIO();
      const updatedQueue = await getFullQueue(machineId);
      io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);
      io.to(`machine:${machineId}`).emit('queue:now-playing', nowPlaying);

      res.json({
        success: true,
        data: {
          skipped: currentlyPlaying.id,
          nowPlaying,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// POST /:id/queue/advance — TV player advances to next song (no auth)
// Called automatically when a song finishes playing on the TV
// ============================================
queueRouter.post('/:id/queue/advance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machineId = req.params.id as string;

    await findMachineOrThrow(machineId);
    await sweepStalePlaying(machineId);

    // Find the currently playing item
    const currentlyPlaying = await prisma.queueItem.findFirst({
      where: { machineId, status: 'PLAYING' },
    });

    // If nothing is playing yet, start the first PENDING song
    if (!currentlyPlaying) {
      const firstPending = await prisma.queueItem.findFirst({
        where: { machineId, status: 'PENDING' },
        orderBy: { position: 'asc' },
      });

      if (!firstPending) {
        return res.json({
          success: true,
          data: { skipped: null, nowPlaying: null },
        });
      }

      await prisma.queueItem.update({
        where: { id: firstPending.id },
        data: { status: 'PLAYING', playedAt: new Date() },
      });

      const nowPlaying = await prisma.queueItem.findUnique({
        where: { id: firstPending.id },
        include: {
          song: {
            select: {
              id: true, title: true, artist: true, album: true,
              genre: true, duration: true, coverArtUrl: true,
              fileUrl: true, videoUrl: true, format: true,
            },
          },
          user: { select: { id: true, name: true, avatar: true } },
        },
      });

      await prisma.song.update({
        where: { id: firstPending.songId },
        data: { playCount: { increment: 1 } },
      });

      const io = getIO();
      const updatedQueue = await getFullQueue(machineId);
      io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);
      io.to(`machine:${machineId}`).emit('queue:now-playing', nowPlaying);

      return res.json({
        success: true,
        data: { skipped: null, nowPlaying },
      });
    }

    // Find the next pending item
    const nextInQueue = await prisma.queueItem.findFirst({
      where: { machineId, status: 'PENDING' },
      orderBy: { position: 'asc' },
    });

    // Mark current as PLAYED, advance next to PLAYING
    await prisma.$transaction(async (tx) => {
      await tx.queueItem.update({
        where: { id: currentlyPlaying.id },
        data: { status: 'PLAYED', playedAt: new Date() },
      });

      if (nextInQueue) {
        await tx.queueItem.update({
          where: { id: nextInQueue.id },
          data: { status: 'PLAYING', playedAt: new Date() },
        });
      }
    });

    const nowPlaying = nextInQueue
      ? await prisma.queueItem.findUnique({
          where: { id: nextInQueue.id },
          include: {
            song: {
              select: {
                id: true, title: true, artist: true, album: true,
                genre: true, duration: true, coverArtUrl: true,
                fileUrl: true, videoUrl: true, format: true,
              },
            },
            user: { select: { id: true, name: true, avatar: true } },
          },
        })
      : null;

    if (nowPlaying) {
      await prisma.song.update({
        where: { id: nowPlaying.songId },
        data: { playCount: { increment: 1 } },
      });
    }

    // Emit WebSocket events
    const io = getIO();
    const updatedQueue = await getFullQueue(machineId);
    io.to(`machine:${machineId}`).emit('queue:updated', updatedQueue);
    io.to(`machine:${machineId}`).emit('queue:now-playing', nowPlaying);

    res.json({
      success: true,
      data: { skipped: currentlyPlaying.id, nowPlaying },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /:id/now-playing — Currently playing song
// ============================================
queueRouter.get('/:id/now-playing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machineId = req.params.id as string;

    await findMachineOrThrow(machineId);
    await sweepStalePlaying(machineId);

    const nowPlaying = await prisma.queueItem.findFirst({
      where: {
        machineId,
        status: 'PLAYING',
      },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            artist: true,
            album: true,
            genre: true,
            duration: true,
            coverArtUrl: true,
            fileUrl: true,
            videoUrl: true,
            format: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!nowPlaying) {
      return res.json({
        success: true,
        data: { nowPlaying: null },
      });
    }

    // Calculate elapsed time since playback started
    const elapsedSeconds = nowPlaying.playedAt
      ? Math.floor((Date.now() - nowPlaying.playedAt.getTime()) / 1000)
      : 0;

    res.json({
      success: true,
      data: {
        nowPlaying: {
          ...nowPlaying,
          progress: {
            elapsed: Math.min(elapsedSeconds, nowPlaying.song.duration),
            duration: nowPlaying.song.duration,
            percentage: nowPlaying.song.duration > 0
              ? Math.min(
                  Math.round((elapsedSeconds / nowPlaying.song.duration) * 100),
                  100,
                )
              : 0,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});
