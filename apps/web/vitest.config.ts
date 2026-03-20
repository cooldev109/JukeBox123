import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@jukebox/ui': path.resolve(__dirname, '../..', 'packages/ui/src'),
    },
  },
});
