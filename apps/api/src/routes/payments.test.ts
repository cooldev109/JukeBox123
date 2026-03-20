import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    machine: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../lib/stripe.js', () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' }),
  createCustomer: vi.fn().mockResolvedValue({ id: 'cus_test' }),
  attachPaymentMethod: vi.fn().mockResolvedValue({ id: 'pm_test', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } }),
  listPaymentMethods: vi.fn().mockResolvedValue([]),
  constructWebhookEvent: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../app.js';
import { generateAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const app = createApp();
const mockPrisma = prisma as any;

const customerToken = generateAccessToken({ userId: 'customer-1', role: 'CUSTOMER' });
const adminToken = generateAccessToken({ userId: 'admin-1', role: 'ADMIN' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Payments Routes', () => {
  // -----------------------------------------------
  // GET /payments/wallet
  // -----------------------------------------------
  describe('GET /api/v1/payments/wallet', () => {
    it('returns wallet balance for authenticated user', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'w1',
        userId: 'customer-1',
        balance: 25.50,
        currency: 'BRL',
      });

      const res = await request(app)
        .get('/api/v1/payments/wallet')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBe(25.50);
      expect(res.body.data.currency).toBe('BRL');
    });

    it('returns zero balance when wallet does not exist', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/payments/wallet')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBe(0);
      expect(res.body.data.currency).toBe('BRL');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/payments/wallet');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -----------------------------------------------
  // POST /payments/wallet/topup
  // -----------------------------------------------
  describe('POST /api/v1/payments/wallet/topup', () => {
    it('creates a Pix topup transaction and returns QR code', async () => {
      // No existing idempotency key
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-topup-1',
        userId: 'customer-1',
        type: 'CREDIT_PURCHASE',
        amount: 50.00,
        paymentMethod: 'PIX',
        status: 'PENDING',
        currency: 'BRL',
        idempotencyKey: 'key-123',
      });

      const res = await request(app)
        .post('/api/v1/payments/wallet/topup')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 50.00, paymentMethod: 'PIX' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactionId).toBe('tx-topup-1');
      expect(res.body.data.qrCode).toBeDefined();
      expect(res.body.data.amount).toBe(50.00);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.expiresIn).toBe(300);
    });

    it('returns 400 with zero or negative amount', async () => {
      const res = await request(app)
        .post('/api/v1/payments/wallet/topup')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with negative amount', async () => {
      const res = await request(app)
        .post('/api/v1/payments/wallet/topup')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/v1/payments/wallet/topup')
        .send({ amount: 50.00 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 409 for duplicate idempotency key', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'existing-tx',
        idempotencyKey: 'dup-key',
      });

      const res = await request(app)
        .post('/api/v1/payments/wallet/topup')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 50.00, paymentMethod: 'PIX', idempotencyKey: 'dup-key' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/idempotency/i);
    });
  });

  // -----------------------------------------------
  // GET /payments/history
  // -----------------------------------------------
  describe('GET /api/v1/payments/history', () => {
    it('returns paginated transaction history', async () => {
      const transactions = [
        { id: 'tx1', type: 'SONG_PAYMENT', amount: 5.00, currency: 'BRL', paymentMethod: 'WALLET', status: 'COMPLETED', pixTransactionId: null, stripePaymentId: null, metadata: {}, createdAt: new Date(), machine: { id: 'm1', name: 'Machine 1' } },
        { id: 'tx2', type: 'CREDIT_PURCHASE', amount: 20.00, currency: 'BRL', paymentMethod: 'PIX', status: 'COMPLETED', pixTransactionId: 'pix123', stripePaymentId: null, metadata: {}, createdAt: new Date(), machine: null },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(transactions);
      mockPrisma.transaction.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(2);
    });

    it('supports filtering by type', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/payments/history?type=SONG_PAYMENT')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toHaveLength(0);
    });

    it('supports filtering by status', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/payments/history?status=PENDING')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('supports pagination parameters', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(100);

      const res = await request(app)
        .get('/api/v1/payments/history?page=2&limit=10')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(10);
      expect(res.body.data.pagination.totalPages).toBe(10);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/payments/history');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
