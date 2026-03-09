// In-memory store — replaces Redis for MVP
// For production, swap this back to Redis or use PostgreSQL

const store = new Map<string, { value: string; expiresAt: number }>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);

export const memoryStore = {
  async get(key: string): Promise<string | null> {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  async setex(key: string, seconds: number, value: string): Promise<void> {
    store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },

  async ping(): Promise<string> {
    return 'PONG';
  },

  disconnect(): void {
    store.clear();
  },
};

// Export as "redis" for backward compatibility
export const redis = memoryStore;
