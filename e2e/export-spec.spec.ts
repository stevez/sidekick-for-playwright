import { test, expect, record } from './fixtures';

declare global {
  interface Window {
    __saved?: { name: string; data: string };
  }
}

test('exports the script as a Playwright Test spec', async ({ panel, target }) => {
  // Stub the native save picker and capture what is written
  await panel.evaluate(() => {
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async (opts: { suggestedName: string }) => {
      window.__saved = { name: opts.suggestedName, data: '' };
      return {
        name: opts.suggestedName,
        createWritable: async () => ({ write: async (d: string) => { window.__saved!.data += d; }, close: async () => {} }),
      };
    };
  });

  await record(panel, target, () => target.getByRole('button', { name: 'Greet' }).click());

  await panel.getByTestId('export-spec-btn').click();
  const name = panel.getByTestId('export-spec-name');
  await expect(name).toHaveValue('Greeting form'); // from the page title
  await name.press('Enter'); // Save .spec.ts
  await expect(panel.getByTestId('export-spec-dialog')).toBeHidden();

  const saved = await panel.evaluate(() => window.__saved);
  expect(saved?.name).toMatch(/\.spec\.ts$/);
  expect(saved?.data).toContain("import { test, expect } from '@playwright/test';");
  expect(saved?.data).toContain("test('Greeting form', async ({ page }) => {");
  expect(saved?.data).toContain("getByRole('button', { name: 'Greet' }).click()");
});
