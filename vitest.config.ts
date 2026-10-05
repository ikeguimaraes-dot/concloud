import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
  resolve: {
    alias: {
      '@domain': new URL('./packages/domain/src', import.meta.url).pathname,
      '@database': new URL('./packages/database', import.meta.url).pathname,
      '@integrations': new URL('./packages/integrations/src', import.meta.url).pathname,
      'server-only': new URL('./tests/server-only.ts', import.meta.url).pathname,
    },
  },
});
