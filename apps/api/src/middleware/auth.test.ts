import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    venue: { findUnique: vi.fn() },
  },
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    it('passes with a valid token and reaches a protected route', async () => {
      // GET /auth/me is behind requireAuth — we just need prisma.user.findUnique to return something
      const { prisma } = await import('../lib/prisma.js');
      const mockPrisma = prisma as any;
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        phone: null,
        name: 'Test',
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
    });

    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('rejects requests with an invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('rejects requests with a malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Token something');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('passes when user has the required role', async () => {
      const { prisma } = await import('../lib/prisma.js');
      const mockPrisma = prisma as any;
      mockPrisma.user.findMany.mockResolvedValue([]);

      const token = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });

      // GET /auth/users requires ADMIN or EMPLOYEE
      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects when user has the wrong role', async () => {
      const token = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });

      const res = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });
  });
});
