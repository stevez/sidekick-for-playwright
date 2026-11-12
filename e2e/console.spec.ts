import { test, expect } from './fixtures';

test('the console runs only JavaScript', async ({ panel }) => {
  const input = panel.getByTestId('command-input').locator('.cm-content');
  await input.click();
  await panel.keyboard.type('video-start');
  await panel.keyboard.press('Enter');
  await expect(panel.getByTestId('output')).toContainText(/video is not defined|ReferenceError/, { timeout: 10_000 });
});
