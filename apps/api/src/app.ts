import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { songRouter } from './routes/songs.js';
import { queueRouter } from './routes/queue.js';
import { paymentRouter } from './routes/payments.js';
import { venueRouter } from './routes/venues.js';
import { machineRouter } from './routes/machines.js';
import { configRouter } from './routes/config.js';
import { playlistRouter } from './routes/playlists.js';
import { affiliateRouter } from './routes/affiliates.js';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const origins = corsOrigin.includes(',')
    ? corsOrigin.split(',').map((o) => o.trim())
    : corsOrigin;
  app.use(
    cors({
      origin: origins,
      credentials: true,
    }),
  );

  // Rate limiting (relaxed in development)
  const isDev = process.env.NODE_ENV !== 'production';
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 5000 : 1000, // 5000/15min in dev, 1000/15min in production
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  const apiPrefix = '/api/v1';
  app.use(`${apiPrefix}/auth`, authRouter);
  app.use(`${apiPrefix}/songs`, songRouter);
  app.use(`${apiPrefix}/machines`, queueRouter);
  app.use(`${apiPrefix}/machines`, machineRouter);
  app.use(`${apiPrefix}/payments`, paymentRouter);
  app.use(`${apiPrefix}/venues`, venueRouter);
  app.use(`${apiPrefix}/config`, configRouter);
  app.use(`${apiPrefix}/playlists`, playlistRouter);
  app.use(`${apiPrefix}/affiliates`, affiliateRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
