import { test, expect } from './fixtures';

test('reconnects when the page is closed under a run', async ({ panel, target, sw }) => {
  const script = `await page.goto('${target.url()}');\nawait page.locator('#name').fill('Ada');\nawait page.getByRole('button', { name: 'Greet' }).click();\n`;
  await panel.locator('input[type=file]').setInputFiles({ name: 'a.js', mimeType: 'text/javascript', buffer: Buffer.from(script) });

  // Lose the page behind the panel's back, as when Chrome drops the debugger connection
  await sw.evaluate(async () => {
    const g = globalThis as unknown as { crxApp: { detach(tabId: number): Promise<void> }; activeTabId: number };
    await g.crxApp.detach(g.activeTabId);
  });

  await panel.getByTestId('run-btn').click();
  const output = panel.getByTestId('output');
  await expect(output).toContainText('Target page, context or browser has been closed', { timeout: 20_000 });
  await expect(output).toContainText('Reconnected. Run the script again.', { timeout: 20_000 });
  await expect(panel.getByTestId('attach-btn')).toHaveAttribute('title', /^Detach/);

  await panel.getByTestId('run-btn').click();
  await expect(target.locator('#out')).toHaveText('Hello Ada', { timeout: 20_000 });
});
