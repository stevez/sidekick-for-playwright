import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, record, pick } from '../e2e/fixtures';

// Web Store screenshots (1280×800): the page on the left, the panel on the right.
// Run with `npm run store:screenshots` (build first). Uses the live TodoMVC demo, so it's kept out of e2e/.
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots') + path.sep;
const TODO = 'https://demo.playwright.dev/todomvc/';
const PAGE_W = 680, PANEL_W = 600, H = 800;

async function setup(panel: Page, target: Page) {
  await target.setViewportSize({ width: PAGE_W, height: H });
  await panel.setViewportSize({ width: PANEL_W, height: H });
  await target.goto(TODO);
  await target.waitForTimeout(800);
}

async function setScript(panel: Page, text: string) {
  await panel.locator('input[type=file]').setInputFiles({ name: 'todo.js', mimeType: 'text/javascript', buffer: Buffer.from(text) });
  await expect(panel.locator('.cm-line').nth(3)).toBeVisible();
}

async function addTodos(target: Page, items: string[]) {
  const input = target.getByPlaceholder('What needs to be done?');
  for (const item of items) { await input.fill(item); await input.press('Enter'); }
}

async function shot(name: string, target: Page, panel: Page) {
  const left = (await target.screenshot()).toString('base64');
  const right = (await panel.screenshot()).toString('base64');
  const c = await target.context().newPage();
  await c.setViewportSize({ width: PAGE_W + PANEL_W, height: H });
  await c.setContent(`<body style="margin:0;display:flex;background:#fff">
    <img src="data:image/png;base64,${left}" style="width:${PAGE_W}px;height:${H}px;display:block">
    <img src="data:image/png;base64,${right}" style="width:${PANEL_W - 1}px;height:${H}px;display:block;border-left:1px solid #d0d0d0">
  </body>`);
  await c.screenshot({ path: `${OUT}${name}.png`, scale: 'css' });
  await c.close();
}

const SCRIPT = `await page.goto('${TODO}');
const input = page.getByPlaceholder('What needs to be done?');
for (const item of ['Buy groceries', 'Write tests', 'Ship it']) {
  await input.fill(item);
  await input.press('Enter');
}
await page.getByTestId('todo-item').filter({ hasText: 'Write tests' }).getByRole('checkbox').check();
const left = await page.getByTestId('todo-count').innerText();
await expect(page.getByTestId('todo-count')).toHaveText('2 items left');
`;

test('1 record and run', async ({ panel, target }) => {
  await setup(panel, target);
  await record(panel, target, async () => {
    await addTodos(target, ['Buy groceries', 'Write tests', 'Ship it']);
    await target.getByTestId('todo-item').filter({ hasText: 'Write tests' }).getByRole('checkbox').check();
    await target.getByRole('link', { name: 'Active' }).click();
  });
  await target.evaluate(() => localStorage.clear());
  await target.goto(TODO);
  await panel.getByTestId('run-btn').click();
  await expect(panel.getByTestId('run-btn')).toBeEnabled({ timeout: 30_000 });
  await panel.waitForTimeout(1500);
  await shot('1-record-run', target, panel);
});

test('2 pick locator', async ({ panel, target }) => {
  await setup(panel, target);
  await setScript(panel, SCRIPT);
  await addTodos(target, ['Buy groceries', 'Write tests', 'Ship it']);
  await pick(panel, target, 'pick-btn', () => target.getByRole('link', { name: 'Active' }).click());
  await expect(panel.getByTestId('pick-result')).toBeVisible({ timeout: 15_000 });
  await panel.getByTestId('pick-locator').hover();
  await expect(target.locator('x-pw-glass')).toHaveCount(1, { timeout: 5000 });
  await target.waitForTimeout(500);
  await shot('2-pick-locator', target, panel);
});

test('3 assert', async ({ panel, target }) => {
  await setup(panel, target);
  await setScript(panel, SCRIPT);
  await addTodos(target, ['Buy groceries', 'Write tests', 'Ship it']);
  await target.getByTestId('todo-item').filter({ hasText: 'Write tests' }).getByRole('checkbox').check();
  await panel.getByTestId('tab-assert').click();
  const sp = (await panel.locator('#splitter').boundingBox())!;
  await panel.mouse.move(sp.x + sp.width / 2, sp.y + sp.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(sp.x + sp.width / 2, 240, { steps: 5 });
  await panel.mouse.up();
  await pick(panel, target, 'assert-pick-btn', async () => { const b = (await target.getByTestId('todo-item').filter({ hasText: 'Write tests' }).getByRole('checkbox').boundingBox())!; await target.mouse.click(b.x + b.width / 2, b.y + b.height / 2); });
  await expect(panel.getByTestId('assert-locator')).not.toHaveValue('', { timeout: 15_000 });
  await panel.getByTestId('assert-type').selectOption('toBeChecked');
  await panel.getByTestId('assert-verify').click();
  await expect(panel.getByTestId('assert-result')).toHaveAttribute('data-status', 'passed', { timeout: 20_000 });
  await shot('3-assert', target, panel);
});

test('4 debugger', async ({ panel, target }) => {
  await setup(panel, target);
  await setScript(panel, SCRIPT);
  // Breakpoint on the expect line (line 9): click the breakpoint gutter level with it
  const line = await panel.locator('.cm-line').nth(8).boundingBox();
  const gutter = await panel.locator('.cm-breakpoint-gutter').boundingBox();
  await panel.mouse.click(gutter!.x + gutter!.width / 2, line!.y + line!.height / 2);
  await expect(panel.getByTestId('breakpoint-marker')).toHaveCount(1);
  await panel.getByTestId('debug-btn').click();
  await expect(panel.getByTestId('debug-bar')).toBeVisible({ timeout: 15_000 });
  await panel.waitForTimeout(3000);
  await panel.getByTestId('debug-continue').click(); // the debugger stops on line 1 first
  await panel.waitForTimeout(6000);
  await panel.getByTestId('tab-variables').click();
  await panel.getByTestId('bottom-pane').locator('.ot-toggle', { hasText: 'Script' }).click();
  await panel.waitForTimeout(1000);
  await shot('4-debugger', target, panel);
});

test('5 export spec', async ({ panel, target }) => {
  await setup(panel, target);
  await setScript(panel, SCRIPT);
  await addTodos(target, ['Buy groceries', 'Write tests', 'Ship it']);
  await target.getByTestId('todo-item').filter({ hasText: 'Write tests' }).getByRole('checkbox').check();
  await panel.getByTestId('export-spec-btn').click();
  await expect(panel.getByTestId('export-spec-dialog')).toBeVisible();
  await panel.waitForTimeout(500);
  await shot('5-export-spec', target, panel);
});
