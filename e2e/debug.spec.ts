import { test, expect } from './fixtures';

const script = (url: string) => [
  `await page.goto('${url}');`,
  `const input = page.locator('#name');`,
  `await input.fill('Ada');`,
  `await page.getByRole('button', { name: 'Greet' }).click();`,
].join('\n') + '\n';

test('keeps an expanded scope open while stepping', async ({ panel, target }) => {
  await panel.locator('input[type=file]').setInputFiles({ name: 'a.js', mimeType: 'text/javascript', buffer: Buffer.from(script(target.url())) });
  await panel.getByTestId('debug-btn').click();
  await expect(panel.locator('.cm-run-line')).toContainText('page.goto', { timeout: 15_000 });

  await panel.getByTestId('tab-variables').click();
  const scriptScope = panel.getByTestId('bottom-pane').locator('.ot-toggle', { hasText: 'Script' });
  await scriptScope.click();
  await expect(scriptScope).toContainText('▼');

  await panel.getByTestId('debug-step-over').click();
  await expect(panel.locator('.cm-run-line')).toContainText("const input", { timeout: 15_000 });
  await panel.getByTestId('debug-step-over').click();
  await expect(panel.locator('.cm-run-line')).toContainText("fill('Ada')", { timeout: 15_000 });

  await expect(scriptScope).toContainText('▼'); // still expanded after two steps
  await expect(panel.getByTestId('bottom-pane')).toContainText('input:');

  await panel.getByTestId('debug-stop').click();
  await expect(panel.getByTestId('debug-bar')).toBeHidden({ timeout: 15_000 });
});

test('finishes the script when Step Over is clicked rapidly', async ({ panel, target }) => {
  await panel.locator('input[type=file]').setInputFiles({ name: 'a.js', mimeType: 'text/javascript', buffer: Buffer.from(script(target.url())) });
  await panel.getByTestId('debug-btn').click();
  await expect(panel.locator('.cm-run-line')).toContainText('page.goto', { timeout: 15_000 });
  const stepOver = panel.getByTestId('debug-step-over');
  // Click faster than each step completes; extra clicks after the end are ignored
  for (let i = 0; i < 8; i++) {
    if (!(await stepOver.isVisible())) break;
    await stepOver.click({ timeout: 2000 }).catch(() => {});
  }
  await expect(panel.getByTestId('debug-bar')).toBeHidden({ timeout: 20_000 });
  await expect(target.locator('#out')).toHaveText('Hello Ada');
  await expect(panel.getByTestId('run-btn')).toBeEnabled();
});
