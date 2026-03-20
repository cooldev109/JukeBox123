import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      create: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../lib/otp.js', () => ({
  generateOTP: vi.fn().mockReturnValue('123456'),
  storeOTP: vi.fn().mockResolvedValue(undefined),
  verifyOTP: vi.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const app = createApp();
const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth Routes', () => {
  // -----------------------------------------------
  // POST /auth/register
  // -----------------------------------------------
  describe('POST /api/v1/auth/register', () => {
    const validPayload = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      role: 'CUSTOMER',
    };

    it('returns 201 with user and tokens on valid registration', async () => {
      // No existing user
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: 'john@example.com',
        phone: null,
        name: 'John Doe',
        role: 'CUSTOMER',
        avatar: null,
        referralCode: null,
        regionAccess: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.wallet.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('john@example.com');
      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('returns 400 when both email and phone are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'John Doe', password: 'secret123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/email.*phone/i);
    });

    it('returns 409 when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'john@example.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('returns 400 when name is too short', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'J', email: 'j@test.com', password: 'secret123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // POST /auth/login
  // -----------------------------------------------
  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with user and tokens for valid email+password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        phone: null,
        name: 'John Doe',
        role: 'CUSTOMER',
        avatar: null,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // bcrypt.compare is already mocked to return true

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@example.com', password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('john@example.com');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('returns 401 when password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
      });
      (bcrypt.compare as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@example.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('returns 401 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'secret123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('returns 400 when neither email+password nor phone+otp is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ foo: 'bar' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /auth/me
  // -----------------------------------------------
  describe('GET /api/v1/auth/me', () => {
    it('returns user profile with a valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        phone: null,
        name: 'John Doe',
        role: 'CUSTOMER',
        avatar: null,
        referralCode: null,
        regionAccess: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = generateAccessToken({ userId: 'user-1', role: 'CUSTOMER' });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('user-1');
      expect(res.body.data.user.name).toBe('John Doe');
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when user is not found in DB', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = generateAccessToken({ userId: 'deleted-user', role: 'CUSTOMER' });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // GET /auth/users
  // -----------------------------------------------
  describe('GET /api/v1/auth/users', () => {
    it('admin can list all users', async () => {
      const users = [
        { id: 'u1', name: 'Admin', email: 'admin@test.com', phone: null, role: 'ADMIN', referralCode: null, regionAccess: null, createdAt: new Date() },
        { id: 'u2', name: 'Owner', email: 'owner@test.com', phone: null, role: 'BAR_OWNER', referralCode: null, regionAccess: null, createdAt: new Date() },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const token = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });

      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(2);
    });

    it('employee can list users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const token = generateAccessToken({ userId: 'employee-1', role: 'EMPLOYEE' });

      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('customer cannot list users (403)', async () => {
      const token = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it('bar owner cannot list users (403)', async () => {
      const token = generateAccessToken({ userId: 'owner-1', role: 'BAR_OWNER' });

      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
