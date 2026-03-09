import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../lib/prisma.js';

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload & { name?: string };
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
        select: { ownerId: true },
      });

      if (!venue) {
        return next(new AppError('Venue not found', 404));
      }

      if (req.user.role === 'BAR_OWNER' && venue.ownerId !== req.user.userId) {
        return next(new AppError('Access denied to this venue', 403));
      }

      next();
    } catch {
      return next(new AppError('Error checking venue access', 500));
    }
  };
}
