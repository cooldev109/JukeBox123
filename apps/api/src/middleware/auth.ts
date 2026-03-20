import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../lib/prisma.js';

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload & { name?: string; regionAccess?: string | null };
  }
}

/**
 * Require valid JWT access token
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
}

/**
 * Require access to a specific venue (bar owner can only access their own)
 * Employees can access venues in their assigned region.
 */
export function requireVenueAccess(paramName = 'id') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Admins can access any venue
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const venueId = req.params[paramName] as string;
    if (!venueId) {
      return next(new AppError('Venue ID required', 400));
    }

    try {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        select: { ownerId: true, state: true, city: true },
      });

      if (!venue) {
        return next(new AppError('Venue not found', 404));
      }

      // Bar owners can only access their own venues
      if (req.user.role === 'BAR_OWNER' && venue.ownerId !== req.user.userId) {
        return next(new AppError('Access denied to this venue', 403));
      }

      // Employees can access venues in their assigned region
      if (req.user.role === 'EMPLOYEE') {
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { regionAccess: true },
        });

        if (!user?.regionAccess) {
          return next(new AppError('No region assigned to this employee', 403));
        }

        // Region can match state or city
        const region = user.regionAccess;
        if (venue.state !== region && venue.city !== region) {
          return next(new AppError('Venue is outside your assigned region', 403));
        }
      }

      next();
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Error checking venue access', 500));
    }
  };
}

/**
 * Require employee to be in the correct region for the resource.
 * Used for employee-specific routes where region filtering applies.
 */
export function requireRegion() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Admins bypass region check
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role !== 'EMPLOYEE') {
      return next(new AppError('Region access is for employees only', 403));
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { regionAccess: true },
      });

      if (!user?.regionAccess) {
        return next(new AppError('No region assigned to this employee', 403));
      }

      // Store region on request for downstream use
      req.user.regionAccess = user.regionAccess;
      next();
    } catch {
      return next(new AppError('Error checking region access', 500));
    }
  };
}
