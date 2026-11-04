import { test, expect, pick } from './fixtures';

test('toolbar picker shows the locator and a suggested assertion in the console', async ({ panel, target }) => {
  await pick(panel, target, 'pick-btn', () => target.getByRole('button', { name: 'Greet' }).click());

  const result = panel.locator('[data-type="pick-result"]');
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toContainText("getByRole('button', { name: 'Greet' })");
  await expect(result).toContainText("toContainText('Greet')");
});
