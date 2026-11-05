import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { completionsPlugin } from './scripts/completions';

export default defineConfig({
  plugins: [completionsPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/panel'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
