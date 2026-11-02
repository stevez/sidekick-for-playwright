import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/panel'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
