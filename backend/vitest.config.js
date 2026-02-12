import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'build/', '.cache/', 'public/'],
    },
    // Strapi 4 compatibility (CommonJS)
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
