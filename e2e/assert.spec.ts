import type { Page } from '@playwright/test';
import { test, expect, editorText, pick } from './fixtures';

async function verify(panel: Page) {
  await panel.getByTestId('assert-verify').click();
  const result = panel.getByTestId('assert-result');
  await expect(result).toBeVisible({ timeout: 20_000 });
  return result;
}

test.describe('Assert tab', () => {
  test.beforeEach(async ({ panel, target }) => {
    await panel.getByTestId('tab-assert').click();
    await pick(panel, target, 'assert-pick-btn', () => target.getByRole('button', { name: 'Greet' }).click());
    await expect(panel.getByTestId('assert-locator')).toHaveValue("page.getByRole('button', { name: 'Greet' })", { timeout: 10_000 });
  });

  test('starts from the suggested assertion and verifies it', async ({ panel }) => {
    await expect(panel.getByTestId('assert-assertion')).toHaveValue("await expect(page.getByRole('button', { name: 'Greet' })).toContainText('Greet');");
    await expect(panel.getByTestId('assert-aria')).toHaveValue(/button "Greet"/);
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');
  });

  test('shows expected vs received when the assertion fails', async ({ panel }) => {
    await panel.getByTestId('assert-type').selectOption('toHaveText');
    await panel.getByTestId('assert-arg').fill('Nope');
    const result = await verify(panel);
    await expect(result).toHaveAttribute('data-status', 'failed');
    await expect(result).toContainText('expected: "Nope", received: "Greet"');
  });

  test('builds negated, attribute and snapshot assertions', async ({ panel }) => {
    const assertion = panel.getByTestId('assert-assertion');

    // Not on a matcher with an opposite uses the opposite
    await panel.getByTestId('assert-type').selectOption('toBeHidden');
    await panel.getByTestId('assert-negate').check();
    await expect(assertion).toHaveValue(/\)\.toBeVisible\(\);$/);
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');

    // Not on a matcher without one uses .not.
    await panel.getByTestId('assert-type').selectOption('toContainText');
    await panel.getByTestId('assert-arg').fill('Nope');
    await expect(assertion).toHaveValue(/\.not\.toContainText\('Nope'\);$/);
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');
    await panel.getByTestId('assert-negate').uncheck();

    await panel.getByTestId('assert-type').selectOption('toHaveAttribute');
    await panel.getByTestId('assert-arg').fill('type, submit');
    await expect(assertion).toHaveValue(/\.toHaveAttribute\('type', 'submit'\);$/);
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');

    await panel.getByTestId('assert-mode-snapshot').check();
    await expect(assertion).toHaveValue(/\.toMatchAriaSnapshot\(`/);
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');
  });

  test('inserts the assertion into the editor', async ({ panel }) => {
    await panel.getByTestId('assert-type').selectOption('toBeVisible');
    const line = await panel.getByTestId('assert-assertion').inputValue();
    await panel.getByTestId('assert-insert').click();
    expect(await editorText(panel)).toContain(line);
  });

  test('offers form matchers for inputs', async ({ panel, target }) => {
    await target.locator('#name').fill('Ada');
    await pick(panel, target, 'assert-pick-btn', () => target.locator('#name').click());
    await expect(panel.getByTestId('assert-assertion')).toHaveValue(/toHaveValue\('Ada'\)/, { timeout: 10_000 });
    await expect(await verify(panel)).toHaveAttribute('data-status', 'passed');

    await pick(panel, target, 'assert-pick-btn', () => target.locator('#agree').click());
    await expect(panel.getByTestId('assert-type').locator('option[value="toBeChecked"]')).toHaveCount(1, { timeout: 10_000 });
    await expect(panel.getByTestId('assert-type').locator('option[value="toHaveValue"]')).toHaveCount(0);
  });
});
