import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateTokenPair, verifyRefreshToken } from '../lib/jwt.js';
import { generateOTP, storeOTP, verifyOTP } from '../lib/otp.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

// ============================================
// Validation schemas
// ============================================
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(15).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['ADMIN', 'BAR_OWNER', 'CUSTOMER', 'EMPLOYEE', 'AFFILIATE']).default('CUSTOMER'),
  regionAccess: z.string().min(1).max(100).optional(), // For EMPLOYEE
  referralCode: z.string().min(3).max(50).optional(),  // For AFFILIATE
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

const loginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  venueCode: z.string().min(1).max(50).optional(),
});

const loginPhoneSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});

const requestOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const qrRegisterSchema = z.object({
  venueCode: z.string().min(1).max(50),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
});

// ============================================
// POST /auth/register
// ============================================
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check existing user
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError('Email already registered', 409);
    }
    if (data.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing) throw new AppError('Phone already registered', 409);
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

    // Generate unique referral code for affiliates if not provided
    let referralCode = data.referralCode;
    if (data.role === 'AFFILIATE' && !referralCode) {
      referralCode = `AFF-${data.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    }

    // Validate referral code uniqueness for affiliates
    if (referralCode) {
      const existingCode = await prisma.user.findUnique({ where: { referralCode } });
      if (existingCode) throw new AppError('Referral code already in use', 409);
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role,
        passwordHash,
        regionAccess: data.role === 'EMPLOYEE' ? (data.regionAccess || null) : null,
        referralCode: data.role === 'AFFILIATE' ? (referralCode || null) : null,
      },
      select: {
        id: true, email: true, phone: true, name: true, role: true, avatar: true,
        referralCode: true, regionAccess: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Create wallet for customers and affiliates (affiliates can also use jukebox)
    if (data.role === 'CUSTOMER' || data.role === 'AFFILIATE') {
      await prisma.wallet.create({ data: { userId: user.id } });
    }

    const tokens = generateTokenPair({ userId: user.id, role: user.role });

    res.status(201).json({ success: true, data: { user, tokens } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /auth/login (email+password or phone+otp)
// ============================================
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Email + password login
    if (req.body.email && req.body.password) {
      const data = loginEmailSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: data.email } });
      if (!user || !user.passwordHash) throw new AppError('Invalid credentials', 401);

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) throw new AppError('Invalid credentials', 401);

      const tokens = generateTokenPair({ userId: user.id, role: user.role });

      // If venueCode provided (customer login), resolve venue + machine
      let venue = null;
      let machine = null;
      if (data.venueCode) {
        const v = await prisma.venue.findUnique({
          where: { code: data.venueCode.toUpperCase() },
          include: { machines: { where: { status: 'ONLINE' }, take: 1 } },
        });
        if (!v) throw new AppError('Invalid venue code', 404);
        venue = { id: v.id, name: v.name };
        machine = v.machines[0] ? { id: v.machines[0].id, name: v.machines[0].name } : null;
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id, email: user.email, phone: user.phone, name: user.name,
            role: user.role, avatar: user.avatar, createdAt: user.createdAt, updatedAt: user.updatedAt,
          },
          tokens,
          ...(venue && { venue }),
          ...(machine && { machine }),
        },
      });
    }

    // Phone + OTP login
    if (req.body.phone && req.body.otp) {
      const data = loginPhoneSchema.parse(req.body);

      const validOtp = await verifyOTP(data.phone, data.otp);
      if (!validOtp) throw new AppError('Invalid or expired OTP', 401);

      let user = await prisma.user.findUnique({ where: { phone: data.phone } });

      // Auto-create customer if phone not found
      if (!user) {
        user = await prisma.user.create({
          data: { name: 'Customer', phone: data.phone, role: 'CUSTOMER' },
        });
        await prisma.wallet.create({ data: { userId: user.id } });
      }

      const tokens = generateTokenPair({ userId: user.id, role: user.role });

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id, email: user.email, phone: user.phone, name: user.name,
            role: user.role, avatar: user.avatar, createdAt: user.createdAt, updatedAt: user.updatedAt,
          },
          tokens,
        },
      });
    }

    throw new AppError('Provide email+password or phone+otp', 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /auth/request-otp
// ============================================
authRouter.post('/request-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = requestOtpSchema.parse(req.body);
    const otp = generateOTP();
    await storeOTP(data.phone, otp);

    // In development, return OTP in response for testing
    if (process.env.NODE_ENV === 'development') {
      return res.json({ success: true, message: 'OTP sent', data: { otp } });
    }

    // TODO: Send OTP via SMS gateway in production
    res.json({ success: true, message: 'OTP sent to your phone' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// POST /auth/refresh
// ============================================
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(data.refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError('User not found', 404);

    const tokens = generateTokenPair({ userId: user.id, role: user.role });

    res.json({ success: true, data: { tokens } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    if (error instanceof AppError) return next(error);
    return next(new AppError('Invalid refresh token', 401));
  }
});

// ============================================
// POST /auth/qr-register
// ============================================
authRouter.post('/qr-register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = qrRegisterSchema.parse(req.body);

    const venue = await prisma.venue.findUnique({
      where: { code: data.venueCode.toUpperCase() },
      include: { machines: { where: { status: 'ONLINE' }, take: 1 } },
    });
    if (!venue) throw new AppError('Invalid venue code', 404);

    let user;

    if (data.phone) {
      user = await prisma.user.findUnique({ where: { phone: data.phone } });
    }

    if (!user) {
      user = await prisma.user.create({
        data: { name: data.name || 'Customer', phone: data.phone || null, role: 'CUSTOMER' },
      });
      await prisma.wallet.create({ data: { userId: user.id } });
    }

    const tokens = generateTokenPair({ userId: user.id, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id, email: user.email, phone: user.phone, name: user.name,
          role: user.role, avatar: user.avatar, createdAt: user.createdAt, updatedAt: user.updatedAt,
        },
        tokens,
        venue: { id: venue.id, name: venue.name },
        machine: venue.machines[0] ? { id: venue.machines[0].id, name: venue.machines[0].name } : null,
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
// GET /auth/me
// ============================================
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, phone: true, name: true, role: true, avatar: true,
        referralCode: true, regionAccess: true,
        createdAt: true, updatedAt: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /auth/me
// ============================================
authRouter.put('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
      select: {
        id: true, email: true, phone: true, name: true, role: true, avatar: true,
        createdAt: true, updatedAt: true,
      },
    });

    res.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

// ============================================
// GET /auth/users — Admin: list all users
// ============================================
authRouter.get('/users', requireAuth, requireRole('ADMIN', 'EMPLOYEE'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        referralCode: true, regionAccess: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
});
