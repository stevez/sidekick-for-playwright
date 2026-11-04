import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

export { expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../dist');
const PAGES_DIR = path.join(__dirname, 'pages');

type Fixtures = {
  /** Chromium with the built extension loaded (fresh profile per test, so panel state never leaks). */
  context: BrowserContext;
  sw: Worker;
  /** The page under test, opened at e2e/pages/demo.html. */
  target: Page;
  /** The side panel UI, opened as a tab and attached to `target`. */
  panel: Page;
};

type WorkerFixtures = {
  /** Base URL of a static server for e2e/pages. */
  siteURL: string;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  siteURL: [async ({}, use) => {
    const server = http.createServer((req, res) => {
      const file = path.join(PAGES_DIR, path.basename(new URL(req.url ?? '/', 'http://x').pathname) || 'demo.html');
      if (!fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
      res.setHeader('content-type', 'text/html');
      res.end(fs.readFileSync(file));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    server.close();
  }, { scope: 'worker' }],

  context: async ({}, use) => {
    if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) throw new Error('dist/ not found — run `npm run build` first');
    const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'sidekick-e2e-')), {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-first-run', '--no-default-browser-check'],
    });
    await use(context);
    await context.close();
  },

  sw: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker'));
  },

  target: async ({ context, siteURL }, use) => {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(siteURL + 'demo.html');
    await use(page);
  },

  panel: async ({ context, sw, target }, use) => {
    const extensionId = sw.url().split('/')[2];
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/panel/panel.html`);
    // Attach to the target tab through the tab switcher, as a user would
    const tabId = await sw.evaluate(async url => (await chrome.tabs.query({ url }))[0]?.id, target.url());
    await panel.locator('#toolbar-right select').selectOption(String(tabId));
    await base.expect(panel.getByTestId('attach-btn')).toHaveAttribute('title', /^Detach/, { timeout: 15_000 });
    await use(panel);
  },
});

// ─── Helpers ───

export function editorText(panel: Page): Promise<string> {
  return panel.getByTestId('editor').locator('.cm-content').innerText();
}

/** Record the steps in `actions` on the target page, then stop recording. */
export async function record(panel: Page, target: Page, actions: () => Promise<void>): Promise<void> {
  await panel.getByTestId('record-btn').click();
  await base.expect(panel.getByTestId('record-btn')).toHaveAttribute('title', 'Stop recording', { timeout: 15_000 }); // injecting the recorder can be slow under load
  await target.waitForTimeout(500); // let the recorder content script come up
  await actions();
  await target.waitForTimeout(800); // let the last recorded action reach the panel
  await panel.getByTestId('record-btn').click();
  await base.expect(panel.getByTestId('record-btn')).toHaveAttribute('title', 'Start Recording');
}

/** Click the given pick button in the panel, then run `click` on the target page. */
export async function pick(panel: Page, target: Page, pickButton: string, click: () => Promise<void>): Promise<void> {
  await panel.getByTestId(pickButton).click();
  await target.locator('x-pw-glass').waitFor({ state: 'attached' }); // Playwright's pick overlay is up
  await click();
}
