import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test('draw → run → watch → export', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Stripes', exact: true }).click();
  await page.getByLabel('Draw initial field').click();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await page.getByLabel('Steps', { exact: true }).fill('16');
  await page.getByLabel('Frames to keep').fill('5');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByRole('img', { name: 'Simulation frame 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Frame scrubber')).not.toHaveValue('0');
  const video = page.getByRole('button', { name: 'Download MP4' });
  await expect(video).toBeEnabled();
  const movie = page.waitForEvent('download');
  await video.click();
  await expect(page.getByText(/Rendering MP4/)).toBeVisible();
  const mp4 = await movie;
  expect(mp4.suggestedFilename()).toBe('simulation.mp4');
  await mp4.saveAs(info.outputPath('simulation.mp4'));
  const videoBytes = await readFile(info.outputPath('simulation.mp4'));
  expect(videoBytes.toString('ascii', 4, 8)).toBe('ftyp');
  const png = page.waitForEvent('download');
  const nativeRequest = page.waitForRequest(
    (req) =>
      /\/frames\/\d+\.png$/.test(new URL(req.url()).pathname) &&
      !new URL(req.url()).searchParams.has('max_side'),
  );
  await page.getByRole('button', { name: 'Frame PNG' }).click();
  await nativeRequest;
  const image = await png;
  expect(image.suggestedFilename()).toMatch(/^frame-\d+\.png$/);
  const imageBytes = await readFile((await image.path())!);
  expect([imageBytes.readUInt32BE(16), imageBytes.readUInt32BE(20)]).toEqual([
    320, 160,
  ]);
  await page.getByLabel('Animation format').selectOption('gif');
  const gif = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download GIF' }).click();
  await (await gif).saveAs(info.outputPath('simulation.gif'));
  const data = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Result.nc' }).click();
  await (await data).saveAs(info.outputPath('result.nc'));
  expect((await readFile(info.outputPath('result.nc'))).subarray(0, 4)).toEqual(
    Buffer.from([67, 68, 70, 5]),
  );
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rerun' })).toBeVisible();
});
test('upload → choose coordinates → preview missing cells → edit sampled plane', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'weather.nc',
    mimeType: 'application/x-netcdf',
    buffer: Buffer.from('mock upload'),
  });
  await page.getByLabel('time index').selectOption({ label: '1 · 06:00' });
  await expect(page.getByAltText('Selected NetCDF plane preview')).toBeVisible();
  await expect(page.getByLabel('Missing-cell fill value')).not.toHaveValue('');
  await page.getByLabel('Missing-cell fill value').fill('275');
  await page.getByRole('button', { name: 'Load into canvas' }).click();
  await expect(page.getByLabel('Draw initial field')).toHaveAttribute('width', '320');
});
test('validates the selected upload, shows disk warnings, and cancels the accepted run', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'levels.nc',
    mimeType: 'application/x-netcdf',
    buffer: Buffer.from('retained original'),
  });
  await page.getByLabel('level index').selectOption({ label: '1 · 500' });
  await expect(page.getByLabel('Missing-cell fill value')).not.toHaveValue('');
  await page.getByLabel('Missing-cell fill value').fill('270');
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await page.getByLabel('Frames to keep').fill('241');
  const validation = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/runs/validate'),
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  expect((await validation).postDataJSON().source).toMatchObject({
    kind: 'field',
    var: 'temperature',
    index: { level: 1 },
    fill_value: 270,
  });
  await expect(
    page.getByText('Estimated output exceeds available disk space.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run with warnings' }).click();
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('No saved runs yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Fields', exact: true }).click();
  const original = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  expect(await readFile((await (await original).path())!, 'utf8')).toBe(
    'retained original',
  );
});
