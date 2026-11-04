import { test, expect, editorText, record } from './fixtures';

test('records a fill and click as Playwright JS, then replays it', async ({ panel, target }) => {
  await record(panel, target, async () => {
    await target.locator('#name').click();
    await target.locator('#name').pressSequentially('Ada');
    await target.locator('#name').press('Tab');
    await target.getByRole('button', { name: 'Greet' }).click();
  });

  const script = await editorText(panel);
  expect(script).toContain("fill('Ada')");
  expect(script).toContain("getByRole('button', { name: 'Greet' })");
  expect(script).not.toMatch(/^\s*(click|fill|goto) /m); // JS only, no .pw keyword lines

  await target.reload();
  await expect(target.locator('#out')).toHaveText('');
  await panel.getByTestId('run-btn').click();
  await expect(panel.getByTestId('run-btn')).toBeVisible({ timeout: 30_000 }); // run finished
  await expect(target.locator('#out')).toHaveText('Hello Ada');
});
