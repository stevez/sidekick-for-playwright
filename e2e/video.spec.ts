import fs from 'node:fs';
import { test, expect } from './fixtures';

test('records a video of the attached tab from the toolbar', async ({ panel, target }, testInfo) => {
  const videoBtn = panel.getByTestId('video-btn');
  await videoBtn.click();
  await expect(videoBtn).toHaveAttribute('title', /^Stop video/);

  // Screencast frames only arrive while the tab paints, so keep it in front (as it is beside a real side panel)
  await target.bringToFront();
  await target.locator('#name').fill('Ada');
  await target.getByRole('button', { name: 'Greet' }).click();
  await expect(target.locator('#out')).toHaveText('Hello Ada');
  await target.waitForTimeout(1000);

  await videoBtn.click();
  const entry = panel.locator('[data-type="video"]');
  await expect(entry).toContainText('Video recorded', { timeout: 10_000 });
  await expect(entry.getByRole('button', { name: 'Save Video' })).toBeVisible();

  // The blob is a playable WebM
  const video = await panel.evaluate(async () => {
    const blobUrl = document.querySelector<HTMLElement>('[data-type="video"]')!.dataset.blobUrl!;
    const blob = await (await fetch(blobUrl)).blob();
    const el = document.createElement('video');
    el.src = blobUrl;
    await new Promise((resolve, reject) => { el.onloadeddata = resolve; el.onerror = () => reject(new Error('video does not decode')); });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return { type: blob.type, size: blob.size, width: el.videoWidth, height: el.videoHeight, base64: btoa(bin) };
  });
  fs.writeFileSync(testInfo.outputPath('recording.webm'), Buffer.from(video.base64, 'base64'));
  expect(video.type).toBe('video/webm');
  expect(video.size).toBeGreaterThan(1000);
  expect(video.width).toBeGreaterThan(0);
  expect(video.width).toBeLessThanOrEqual(1280);
  expect(video.width % 2).toBe(0); // encoders want even dimensions
  expect(video.height % 2).toBe(0);
});

test('records a video while the script runs (action highlights come from the panel run)', async ({ panel, target }, testInfo) => {
  await panel.getByTestId('editor').locator('.cm-content').click();
  await panel.keyboard.insertText("await page.getByLabel('Name').fill('Ada');\nawait page.getByRole('button', { name: 'Greet' }).click();");

  await panel.getByTestId('video-btn').click();
  await expect(panel.getByTestId('video-btn')).toHaveAttribute('title', /^Stop video/);
  await panel.getByTestId('run-btn').click();
  await target.bringToFront();
  await expect(target.locator('#out')).toHaveText('Hello Ada', { timeout: 20_000 });
  await target.waitForTimeout(1000);
  await panel.getByTestId('video-btn').click();
  await expect(panel.locator('[data-type="video"]')).toContainText('Video recorded', { timeout: 10_000 });

  const b64 = await panel.evaluate(async () => {
    const blob = await (await fetch(document.querySelector<HTMLElement>('[data-type="video"]')!.dataset.blobUrl!)).blob();
    let bin = '';
    for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
    return btoa(bin);
  });
  fs.writeFileSync(testInfo.outputPath('run.webm'), Buffer.from(b64, 'base64'));
});
