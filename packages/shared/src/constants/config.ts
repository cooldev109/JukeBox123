// Default pricing (BRL)
export const DEFAULT_SONG_PRICE = 2.0;
export const DEFAULT_PRIORITY_PRICE = 5.0;
export const DEFAULT_CREDIT_TOP_UP_AMOUNTS = [10, 20, 50, 100];
export const DEFAULT_BAR_OWNER_COMMISSION_PERCENT = 30;
export const DEFAULT_CURRENCY = 'BRL';
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// Auth
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_LENGTH = 6;
export const BCRYPT_ROUNDS = 10;

// Queue
export const QUEUE_MAX_SIZE = 100;
export const PROGRESS_UPDATE_INTERVAL_MS = 5000;
export const DEFAULT_PLAYLIST_CACHE_SIZE = 20;

// Machine
export const HEARTBEAT_INTERVAL_MS = 30000;
export const OFFLINE_THRESHOLD_MS = 120000; // 2 minutes

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Search
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;
export const MAX_SEARCH_RESULTS = 50;
