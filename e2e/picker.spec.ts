import { test, expect, pick, captureClipboard } from './fixtures';

const locator = "page.getByRole('button', { name: 'Greet' })";

test.describe('toolbar picker', () => {
  test.beforeEach(async ({ panel, target }) => {
    await pick(panel, target, 'pick-btn', () => target.getByRole('button', { name: 'Greet' }).click());
    await expect(panel.getByTestId('pick-result')).toBeVisible({ timeout: 10_000 });
  });

  test('shows the picked element and its locator', async ({ panel }) => {
    const result = panel.getByTestId('pick-result');
    await expect(result).toContainText('element: button "Greet"');
    await expect(panel.getByTestId('pick-locator')).toHaveText(locator);
    await expect(result).not.toContainText('toContainText'); // assertions are built in the Assert tab
  });

  test('copies the locator', async ({ panel }) => {
    const copied = await captureClipboard(panel);
    await panel.getByTestId('pick-copy').click();
    await expect(panel.getByTestId('pick-copy')).toHaveText('Copied');
    expect(await copied()).toBe(locator);
  });

  test('highlights the element while hovering the locator', async ({ panel, target }) => {
    // Playwright draws highlights in a closed shadow root: count its overlays instead
    const overlays = target.locator('x-pw-glass');
    const before = await overlays.count();
    await panel.getByTestId('pick-locator').hover();
    await expect(overlays).toHaveCount(before + 1, { timeout: 10_000 });
    await panel.getByTestId('pick-result').getByText('element').hover();
    await expect(overlays).toHaveCount(before, { timeout: 10_000 });
  });

  test('opens the element in the Assert tab', async ({ panel }) => {
    await panel.getByTestId('pick-open-assert').click();
    await expect(panel.getByTestId('assert-pane')).toBeVisible();
    await expect(panel.getByTestId('assert-locator')).toHaveValue(locator);
    await expect(panel.getByTestId('assert-assertion')).toHaveValue(`await expect(${locator}).toContainText('Greet');`);
    await expect(panel.getByTestId('assert-aria')).toHaveValue(/button "Greet"/);
  });
});
