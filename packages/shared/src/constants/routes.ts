// API route constants
export const API_PREFIX = '/api/v1';

export const AUTH_ROUTES = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  QR_REGISTER: '/auth/qr-register',
  ME: '/auth/me',
} as const;

export const SONG_ROUTES = {
  LIST: '/songs',
  DETAIL: '/songs/:id',
  GENRES: '/songs/genres',
  ARTISTS: '/songs/artists',
  REQUEST: '/songs/request',
} as const;

export const QUEUE_ROUTES = {
  LIST: '/machines/:id/queue',
  ADD: '/machines/:id/queue',
  REMOVE: '/machines/:id/queue/:queueId',
  REORDER: '/machines/:id/queue/reorder',
  SKIP: '/machines/:id/queue/skip',
  NOW_PLAYING: '/machines/:id/now-playing',
} as const;

export const PAYMENT_ROUTES = {
  PIX: '/payments/pix',
  PIX_WEBHOOK: '/payments/pix/webhook',
  WALLET_TOPUP: '/payments/wallet/topup',
  WALLET_SPEND: '/payments/wallet/spend',
  HISTORY: '/payments/history',
} as const;

export const VENUE_ROUTES = {
  LIST: '/venues',
  DETAIL: '/venues/:id',
  PRICING: '/venues/:id/pricing',
} as const;

export const MACHINE_ROUTES = {
  LIST: '/machines',
  DETAIL: '/machines/:id',
  HEARTBEAT: '/machines/:id/heartbeat',
} as const;

export const CONFIG_ROUTES = {
  GLOBAL: '/config/global',
} as const;

export const PLAYLIST_ROUTES = {
  LIST: '/playlists',
  DETAIL: '/playlists/:id',
} as const;
