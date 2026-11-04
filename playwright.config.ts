import { defineConfig } from '@playwright/test';

// E2E tests load the built extension from dist/ — run `npm run build` first.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
});
