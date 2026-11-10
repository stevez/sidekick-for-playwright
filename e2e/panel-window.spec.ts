import { test, expect, editorText } from './fixtures';

test('shows the version in the About dialog', async ({ panel, sw }) => {
  const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
  await panel.getByTestId('about-btn').click();
  await expect(panel.getByTestId('about-version')).toHaveText(`Version ${version}`);
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel.getByTestId('about-dialog')).toBeHidden();
});

test('opens the panel in a separate window that keeps the script and the tab', async ({ context, panel, target }) => {
  await panel.locator('input[type=file]').setInputFiles({ name: 'a.js', mimeType: 'text/javascript', buffer: Buffer.from("await page.getByRole('button', { name: 'Greet' }).click();") });
  await expect.poll(() => editorText(panel)).toContain('Greet');

  const popupPromise = context.waitForEvent('page', p => p.url().includes('panel.html?tabId='));
  await panel.getByTestId('mode-switch-btn').click();
  const popup = await popupPromise;

  await expect(popup.getByTestId('attach-btn')).toHaveAttribute('title', `Detach from ${target.url()}`, { timeout: 15_000 });
  await expect.poll(() => editorText(popup)).toContain('Greet');
  await expect(popup.getByTestId('mode-switch-btn')).toHaveAttribute('title', 'Dock to side panel');

  await popup.getByTestId('run-btn').click();
  await expect(target.locator('#out')).toHaveText(/^Hello/, { timeout: 15_000 });
});
