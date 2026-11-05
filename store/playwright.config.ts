import { defineConfig } from '@playwright/test';

// Store screenshots run headed, one at a time, against the built dist/.
process.env.HEADED = '1';

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
});
