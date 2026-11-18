import { decode } from 'fast-png';
import { mkdir, readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('loads the wrap-around world and keeps opposite edges paired', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  const example = page.getByRole('button', { name: /Wrap-around world/ });
  await example.click();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  const edges = ['left', 'right', 'top', 'bottom'].map((edge) =>
    page.getByLabel(edge + ' edge'),
  );
  const [left, right, top, bottom] = edges;
  for (const edge of edges) await expect(edge).toHaveValue('periodic');
  await expect(left).toHaveAccessibleDescription(/both opposite edges/);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({
    path: 'artifacts/workspace-wrap-around.png',
    fullPage: true,
  });
  await left.selectOption('dirichlet');
  await expect(right).toHaveValue('dirichlet');
  await expect(top).toHaveValue('periodic');
  await expect(bottom).toHaveValue('periodic');
  await right.selectOption('periodic');
  await expect(left).toHaveValue('periodic');
  const validation = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      req.url().endsWith('/runs/validate') &&
      req.postDataJSON().source.kind === 'field',
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  expect((await validation).postDataJSON()).toMatchObject({
    bc: { left: 'periodic', right: 'periodic', top: 'periodic', bottom: 'periodic' },
    vx: 1,
    vy: 0.65,
  });
  await expect(page.getByRole('img', { name: 'Simulation frame 1' })).toBeVisible();
});

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
  await expect(video).toBeEnabled({ timeout: 12000 });
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

test('runs a 3D preset, reads a slice, exports its projection and opens the volume', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Rising plume/ }).click();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await expect(page.getByLabel('Layers nz')).toHaveValue('40');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/3d-conditions.png', fullPage: true });
  const submission = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/runs'),
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  expect((await submission).postDataJSON().source).toEqual({
    kind: 'preset',
    preset: 'gaussian_hotspot',
    nx: 40,
    ny: 40,
    nz: 40,
  });
  await expect(
    page.getByRole('button', { name: 'Slice', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Axis', exact: true }).selectOption('x');
  await page.getByLabel('Slice index').press('ArrowLeft');
  await page.getByLabel('Slice index').press('ArrowLeft');
  const frame = page.getByRole('img', { name: 'Simulation frame 1', exact: true });
  await frame.hover();
  await expect(page.locator('.viewport-foot')).toContainText(
    /y \d+ · z \d+ · x 18 · u/,
  );
  await page.screenshot({ path: 'artifacts/3d-slice.png', fullPage: true });
  const png = page.waitForRequest((req) => req.url().includes('/frames/0.png?'));
  await page.getByRole('button', { name: 'Frame PNG' }).click();
  expect(new URL((await png).url()).searchParams.get('slice')).toBe('18');
  await page.getByRole('button', { name: 'Projection', exact: true }).click();
  await page.getByLabel('Projection method').selectOption('mean');
  await expect(frame).toBeVisible();
  await page.getByLabel('Animation format').selectOption('gif');
  const animation = page.waitForRequest((req) => req.url().includes('/export.gif?'));
  await page.getByRole('button', { name: 'Download GIF' }).click();
  expect(
    Object.fromEntries(new URL((await animation).url()).searchParams),
  ).toMatchObject({ axis: 'x', projection: 'mean' });
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  const rendered = page.getByText('Volume frame 1', { exact: true });
  const fallback = page.getByText(/WebGL2 is unavailable/);
  await expect(rendered.or(fallback)).toBeVisible({ timeout: 30000 });
  if (await rendered.isVisible()) {
    await expect(page.getByRole('img', { name: 'Simulation volume' })).toBeVisible();
    await page.getByLabel('Opacity', { exact: true }).press('End');
    const canvas = page.getByRole('img', { name: 'Simulation volume' });
    const image = decode(await canvas.screenshot());
    // The neutral wireframe and background have no hot inferno pixels.
    let hot = 0;
    for (let i = 0; i < image.data.length; i += image.channels)
      if (image.data[i] > 100 && image.data[i] > 1.25 * image.data[i + 2]) hot++;
    expect(hot).toBeGreaterThan(30);
    await page.screenshot({ path: 'artifacts/3d-volume.png', fullPage: true });
  } else await page.screenshot({ path: 'artifacts/3d-fallback.png', fullPage: true });
});

test('opens the extruded smoke ring and preserves slice access without WebGL2', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...options: unknown[]
    ) {
      return kind === 'webgl2' ? null : Reflect.apply(get, this, [kind, ...options]);
    } as typeof get;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Smoke ring diffusion/ }).click();
  await expect(page.getByLabel('Extrude to N layers')).toHaveValue('12');
  const start = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/runs'),
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  expect((await start).postDataJSON().source).toMatchObject({
    kind: 'field',
    replicate_z: 12,
  });
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('WebGL2 is unavailable');
  await page.getByRole('button', { name: 'Slice', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Simulation frame 1', exact: true }),
  ).toBeVisible();
});

test('uses all uploaded levels, preserves time and sends a finite volume fill', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'layers.nc',
    mimeType: 'application/x-netcdf',
    buffer: Buffer.from('mock volume'),
  });
  await page.getByLabel('time index').selectOption('1');
  await page.getByRole('button', { name: /Use as volume/ }).click();
  await expect(page.getByLabel('level index')).toHaveCount(0);
  await page.getByLabel('Missing-cell fill value').fill('275');
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await expect(page.getByLabel('Layers nz')).toHaveValue('2');
  await page.getByLabel('Frames to keep').fill('3');
  const start = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/runs'),
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const source = (await start).postDataJSON().source;
  expect(source).toMatchObject({
    kind: 'field',
    volume: true,
    index: { time: 1 },
    fill_value: 275,
  });
  expect(source).not.toHaveProperty('replicate_z');
  await expect(page.getByLabel('Slice index')).toHaveAttribute('max', '1');
});

test('converts uploaded layers to one selected plane and keeps its coordinate indices', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'levels.nc',
    mimeType: 'application/x-netcdf',
    buffer: Buffer.from('mock levels'),
  });
  await page.getByLabel('time index').selectOption('2');
  await page.getByRole('button', { name: /Use as volume/ }).click();
  await page.getByRole('button', { name: '3D preview', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Simulation volume' })).toBeVisible();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  const two = page
    .getByRole('group', { name: 'Simulation dimensions' })
    .getByRole('button', { name: '2D' });
  await two.click();
  const dialog = page.getByRole('dialog', { name: 'Keep one slice in 2D' });
  await expect(dialog).toBeVisible();
  for (const value of ['top', 'middle', 'bottom', 'custom'])
    await dialog.getByLabel('Slice to keep').selectOption(value);
  await dialog.getByLabel('Layer z').fill('0');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(two).toBeVisible();
  await two.click();
  await dialog.getByLabel('Slice to keep').selectOption('bottom');
  await dialog.getByRole('button', { name: 'Keep slice' }).click();
  await page.getByRole('button', { name: 'Initial field', exact: true }).click();
  await expect(page.getByLabel('level index')).toHaveValue('1');
  await expect(page.getByLabel('time index')).toHaveValue('2');
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await expect(
    page.getByText('Uploaded coordinate spacing is approximate.'),
  ).toBeVisible();
  await expect(page.getByLabel('Grid spacing dx (km)')).toHaveValue('1.5');
  await expect(page.getByLabel('Grid spacing dy (km)')).toHaveValue('2');
  await page.getByLabel('Frames to keep').fill('3');
  const payload = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/runs'),
  );
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const body = (await payload).postDataJSON();
  expect(body).toMatchObject({
    units: { length: 'km', time: 'h' },
    source: { index: { level: 1, time: 2 } },
  });
  for (const k of ['name', 'processes']) expect(body).not.toHaveProperty(k);
  for (const k of ['volume', 'replicate_z']) expect(body.source).not.toHaveProperty(k);
});

for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    test(`initial field and shared sections at ${width}px in ${theme} mode`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.getByText('API v1.6.0')).toBeVisible();
      await page.getByRole('button', { name: /Smoke ring diffusion/ }).click();
      const columns = await page.getByLabel('Columns').boundingBox();
      const source = await page
        .getByText('Field source', { exact: true })
        .boundingBox();
      expect(columns!.y + columns!.height).toBeLessThan(source!.y);
      await expect(page.getByLabel('Value max')).toBeVisible();
      await page.getByRole('button', { name: '3D preview', exact: true }).click();
      await expect(page.getByLabel('Simulation volume')).toBeVisible();
      await expect(page.getByLabel('Draw initial field')).toHaveCount(0);
      await expect(page.getByLabel('Extrude to N layers')).toHaveValue('12');
      const summary = page.getByText('What am I looking at?', { exact: true });
      const chevron = () =>
        summary.evaluate((el) => getComputedStyle(el, '::before').transform);
      const closed = await chevron();
      await summary.click();
      await expect.poll(chevron).not.toEqual(closed);
      await expect(page.getByText(/Color shows the amount of tracer/)).toBeVisible();
      await expect(page.locator('.solver-tag')).toHaveCount(0);
      await page.getByRole('button', { name: 'Conditions', exact: true }).click();
      const dimensions = page.getByRole('group', { name: 'Simulation dimensions' });
      await dimensions.getByRole('button', { name: '2D' }).click();
      await expect(page.getByLabel('Layers nz')).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await dimensions.getByRole('button', { name: '3D' }).click();
      await expect(page.getByLabel('Layers nz')).toHaveValue('16');
      await page.getByRole('button', { name: 'Initial field', exact: true }).click();
      await page.getByLabel('Extrude to N layers').fill('12');
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBe(0);
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
      await mkdir('artifacts', { recursive: true });
      await page.screenshot({
        path: `artifacts/workspace-${width}-${theme}.png`,
        fullPage: true,
      });
      for (const name of ['History', 'Sky']) {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(
          page.getByRole('group', { name: 'Simulation dimensions' }),
        ).toHaveCount(0);
      }
    });
  }
