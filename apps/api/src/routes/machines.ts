import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getIO } from '../socket.js';

export const machineRouter = Router();

// ============================================
// Validation schemas
// ============================================
const createMachineSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1).max(200),
  serialNumber: z.string().min(1).max(100),
  config: z.record(z.unknown()).default({}),
});

const updateMachineSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  offlineSongCache: z.array(z.string()).optional(),
});

const heartbeatSchema = z.object({
  ipAddress: z.string().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'ERROR', 'ALERT']).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// GET /machines — List machines (paginated)
// ADMIN sees all; BAR_OWNER sees only their venues' machines
// ============================================
machineRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER', 'EMPLOYEE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;

      // Build the where clause based on role
      let where: Prisma.MachineWhereInput = {};

      if (req.user!.role === 'BAR_OWNER') {
        where = { venue: { ownerId: req.user!.userId } };
      } else if (req.user!.role === 'EMPLOYEE') {
        // Employee: filter by assigned region
        const employee = await prisma.user.findUnique({
          where: { id: req.user!.userId },
          select: { regionAccess: true },
        });
        if (employee?.regionAccess) {
          where = {
            venue: {
              OR: [
                { state: employee.regionAccess },
                { city: employee.regionAccess },
              ],
            },
          };
        }
      }

      const [machines, total] = await Promise.all([
        prisma.machine.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            venue: {
              select: { id: true, name: true, city: true, state: true },
            },
          },
        }),
        prisma.machine.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          machines,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
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
// GET /machines/:id — Machine details with venue info & queue count
// ============================================
machineRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER', 'EMPLOYEE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;

      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          venue: {
            select: { id: true, name: true, city: true, state: true, ownerId: true },
          },
        },
      });

      if (!machine) {
        throw new AppError('Machine not found', 404);
      }

      // BAR_OWNER can only view machines in their own venues
      if (req.user!.role === 'BAR_OWNER' && machine.venue.ownerId !== req.user!.userId) {
        throw new AppError('Access denied to this machine', 403);
      }

      // EMPLOYEE can only view machines in their assigned region
      if (req.user!.role === 'EMPLOYEE') {
        const employee = await prisma.user.findUnique({
          where: { id: req.user!.userId },
          select: { regionAccess: true },
        });
        if (employee?.regionAccess && machine.venue.state !== employee.regionAccess && machine.venue.city !== employee.regionAccess) {
          throw new AppError('Machine is outside your assigned region', 403);
        }
      }

      // Get current queue count (PENDING + PLAYING items)
      const queueCount = await prisma.queueItem.count({
        where: {
          machineId: machine.id,
          status: { in: ['PENDING', 'PLAYING'] },
        },
      });

      // Remove ownerId from the response venue object
      const { ownerId: _ownerId, ...venueData } = machine.venue;

      res.json({
        success: true,
        data: {
          machine: {
            ...machine,
            venue: venueData,
            queueCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// POST /machines — Create machine (ADMIN only)
// ============================================
machineRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createMachineSchema.parse(req.body);

      // Verify venue exists
      const venue = await prisma.venue.findUnique({
        where: { id: data.venueId },
        select: { id: true, name: true },
      });
      if (!venue) {
        throw new AppError('Venue not found', 404);
      }

      // Check serial number uniqueness
      const existingMachine = await prisma.machine.findUnique({
        where: { serialNumber: data.serialNumber },
      });
      if (existingMachine) {
        throw new AppError('Serial number already in use', 409);
      }

      const machine = await prisma.machine.create({
        data: {
          venueId: data.venueId,
          name: data.name,
          serialNumber: data.serialNumber,
          config: data.config as Prisma.InputJsonValue,
        },
        include: {
          venue: {
            select: { id: true, name: true, city: true, state: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: { machine },
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
// PUT /machines/:id — Update machine config
// ADMIN can update any; BAR_OWNER can update only their venue's machines
// ============================================
machineRouter.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'BAR_OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;
      const data = updateMachineSchema.parse(req.body);

      // Fetch machine with venue ownership info
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          venue: { select: { ownerId: true } },
        },
      });

      if (!machine) {
        throw new AppError('Machine not found', 404);
      }

      // BAR_OWNER can only update machines in their own venues
      if (req.user!.role === 'BAR_OWNER' && machine.venue.ownerId !== req.user!.userId) {
        throw new AppError('Access denied to this machine', 403);
      }

      const updateData: Prisma.MachineUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.config !== undefined) updateData.config = data.config as Prisma.InputJsonValue;
      if (data.offlineSongCache !== undefined) updateData.offlineSongCache = data.offlineSongCache;

      const updated = await prisma.machine.update({
        where: { id: machineId },
        data: updateData,
        include: {
          venue: {
            select: { id: true, name: true, city: true, state: true },
          },
        },
      });

      res.json({
        success: true,
        data: { machine: updated },
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
// GET /machines/:id/public — Public machine info for TV player (no auth)
// ============================================
machineRouter.get(
  '/:id/public',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;

      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: {
          id: true,
          name: true,
          status: true,
          venue: {
            select: { id: true, name: true },
          },
        },
      });

      if (!machine) {
        throw new AppError('Machine not found', 404);
      }

      res.json({
        success: true,
        data: {
          machine,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// POST /machines/:id/heartbeat — TV player heartbeat
// Updates lastHeartbeat, ipAddress, status. Emits WebSocket event.
// ============================================
machineRouter.post(
  '/:id/heartbeat',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = req.params.id as string;
      const body = heartbeatSchema.parse(req.body);

      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: { id: true, status: true, venueId: true },
      });

      if (!machine) {
        throw new AppError('Machine not found', 404);
      }

      const previousStatus = machine.status;

      const updated = await prisma.machine.update({
        where: { id: machineId },
        data: {
          lastHeartbeat: new Date(),
          ipAddress: body.ipAddress || req.ip || null,
          status: 'ONLINE',
        },
        select: {
          id: true,
          name: true,
          status: true,
          lastHeartbeat: true,
          ipAddress: true,
          venueId: true,
        },
      });

      // Emit WebSocket event so dashboards update in real-time
      const io = getIO();
      const heartbeatPayload = {
        machineId: updated.id,
        name: updated.name,
        status: updated.status,
        previousStatus,
        lastHeartbeat: updated.lastHeartbeat,
        ipAddress: updated.ipAddress,
        venueId: updated.venueId,
        cameOnline: previousStatus === 'OFFLINE' || previousStatus === 'ERROR',
      };

      // Emit to the machine-specific room
      io.to(`machine:${updated.id}`).emit('machine:heartbeat', heartbeatPayload);

      // Also emit to a venue-level room so venue dashboards can listen
      io.to(`venue:${updated.venueId}`).emit('machine:heartbeat', heartbeatPayload);

      res.json({
        success: true,
        data: {
          machine: updated,
          cameOnline: previousStatus === 'OFFLINE' || previousStatus === 'ERROR',
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
