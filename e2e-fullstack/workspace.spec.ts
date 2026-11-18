import { expect, test, type Page } from '@playwright/test';
import { decode } from 'fast-png';
import { readFile } from 'node:fs/promises';
import type { Field, Run } from '../src/lib/model';
import { classicNetCDF, missingCell, nx, ny } from './netcdf';

function frame(page: Page, number: number) {
  return page.getByRole('img', { name: 'Simulation frame ' + number, exact: true });
}

async function setRunLength(page: Page, steps: number, frames: number) {
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await page.getByLabel('Steps', { exact: true }).fill(String(steps));
  await page.getByLabel('Frames to keep').fill(String(frames));
  await page.getByText('Advanced conditions', { exact: true }).click();
  await page.getByLabel('MPI processes').fill('1');
}

async function startRun(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/runs',
    ),
    page.getByRole('button', { name: 'Run simulation' }).click(),
  ]);
  expect(response.status()).toBe(202);
  return (await response.json()) as Run;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Engine online', { exact: true })).toBeVisible();
});

test('the API accepts the client-clamped 2D diffusion step', async ({ page }) => {
  await page.getByRole('button', { name: /Twin hotspots/ }).click();
  await setRunLength(page, 2, 2);
  await page.getByLabel('Grid spacing dx').fill('0.1');
  await page.getByLabel('Grid spacing dy').fill('0.7');
  await page.getByLabel('Diffusion D').fill('0.01');
  await page.getByLabel('Velocity vx').fill('0');
  await page.getByLabel('Velocity vy').fill('0');
  await page.getByLabel('Time step dt').fill('1');
  const [response] = await Promise.all([
    page.waitForResponse('**/runs/validate'),
    page.getByRole('button', { name: 'Run simulation' }).click(),
  ]);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true, errors: [] });
});

test('a pending simulation launch keeps Sky selected and starts the run', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Twin hotspots/ }).click();
  await setRunLength(page, 12, 4);

  const gate = Promise.withResolvers<void>();
  await page.route('**/runs/validate', async (route) => {
    await gate.promise;
    await route.continue();
  });
  const validation = page.waitForRequest('**/runs/validate');
  const submission = startRun(page);
  await validation;
  const sky = page.getByRole('button', { name: 'Sky', exact: true });
  await sky.click();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('Observing sky');

  gate.resolve();
  const run = await submission;
  // Polling starts after the client has processed the launch response.
  await page.waitForRequest((req) => new URL(req.url()).pathname === `/runs/${run.id}`);
  await expect(heading).toHaveText('Observing sky');
  await expect(sky).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Run inspector' })).toBeVisible();
});

test('paints an example, sees live frames, scrubs and exports PNG and MP4', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /Crosswind plume/ }).click();
  await page.getByLabel('Draw initial field').click();
  // Keep the solver computing across UI status polls while bounding output size.
  await setRunLength(page, 1_500_000, 9);
  await page.getByLabel('Time step dt').fill('0.00008');
  const drawn = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && new URL(r.url()).pathname === '/fields/drawn',
  );
  const run = await startRun(page);
  const field = (await (await drawn).json()) as Field;
  expect(field.source).toBe('drawn');
  expect(run.request.source).toMatchObject({ kind: 'field', field_id: field.id });
  await expect(frame(page, 1)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel run' })).toBeVisible();
  await expect(page.getByText('done', { exact: true })).toBeVisible({
    timeout: 45_000,
  });

  const scrubber = page.getByLabel('Frame scrubber');
  await expect(scrubber).toHaveAttribute('max', '8');
  await scrubber.press('ArrowRight');
  await expect(frame(page, 2)).toBeVisible();
  await expect(scrubber).toHaveValue('1');

  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Frame PNG' }).click(),
  ]);
  expect(png.suggestedFilename()).toBe('frame-1.png');
  const pngPath = info.outputPath(png.suggestedFilename());
  await png.saveAs(pngPath);
  const pngBytes = await readFile(pngPath);
  expect(pngBytes.subarray(0, 8)).toEqual(Buffer.from('89504e470d0a1a0a', 'hex'));
  expect(pngBytes.length).toBeGreaterThan(100);
  const image = decode(pngBytes);
  expect([image.width, image.height]).toEqual([128, 64]);

  const [mp4] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download MP4' }).click(),
  ]);
  expect(mp4.suggestedFilename()).toBe('simulation.mp4');
  const mp4Path = info.outputPath(mp4.suggestedFilename());
  await mp4.saveAs(mp4Path);
  const video = await readFile(mp4Path);
  expect(video.toString('ascii', 4, 8)).toBe('ftyp');
  expect(video.length).toBeGreaterThan(1024);
  expect(video.includes('mdat')).toBe(true);
});

test('runs an uploaded NetCDF time plane with a custom missing-cell fill', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'temperature.nc',
    mimeType: 'application/x-netcdf',
    buffer: classicNetCDF(),
  });
  await page.getByLabel('time index').selectOption({ label: '1 · 6' });
  await expect(page.getByAltText('Selected NetCDF plane preview')).toBeVisible();
  await expect(page.getByText(/1 missing cells/)).toBeVisible();
  const fill = page.getByLabel('Missing-cell fill value');
  await expect(fill).toHaveValue('280');
  await fill.fill('275');
  await setRunLength(page, 12, 4);
  const initial = page.waitForResponse(
    (r) =>
      /^\/runs\/[^/]+\/frames\/0\/values$/.test(new URL(r.url()).pathname) && r.ok(),
  );
  const run = await startRun(page);
  expect(run.request.source).toMatchObject({
    kind: 'field',
    var: 'temperature',
    index: { time: 1 },
    fill_value: 275,
  });
  await expect(frame(page, 1)).toBeVisible();
  const values = await (await initial).body();
  expect(values.length).toBe(4 * nx * ny);
  expect(values.readFloatLE(missingCell * 4)).toBe(275);
  expect(values.readFloatLE((missingCell + 1) * 4)).toBe(280);
  await expect(page.getByText('done', { exact: true })).toBeVisible();
});

test('renders 3D slices, projections and the volume view', async ({ page }) => {
  await page.getByRole('button', { name: /Rising plume/ }).click();
  await setRunLength(page, 12, 4);
  const run = await startRun(page);
  expect(run.resolved).toMatchObject({ nx: 40, ny: 40, nz: 40 });
  await expect(
    page.getByRole('button', { name: 'Slice', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(frame(page, 1)).toBeVisible();

  const axis = page.getByRole('combobox', { name: 'Axis', exact: true });
  const slice = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname === `/runs/${run.id}/frames/0/values` &&
      url.searchParams.get('axis') === 'x' &&
      url.searchParams.get('slice') === '20'
    );
  });
  await axis.selectOption('x');
  expect((await slice).ok()).toBe(true);
  await expect(frame(page, 1)).toBeVisible();

  await page.getByRole('button', { name: 'Projection', exact: true }).click();
  const projection = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname === `/runs/${run.id}/frames/0/values` &&
      url.searchParams.get('axis') === 'x' &&
      url.searchParams.get('projection') === 'mean'
    );
  });
  await page.getByLabel('Projection method').selectOption('mean');
  expect((await projection).ok()).toBe(true);
  await expect(frame(page, 1)).toBeVisible();

  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  const rendered = page.getByText('Volume frame 1', { exact: true });
  const fallback = page
    .getByRole('status')
    .filter({ hasText: /WebGL2 is unavailable/ });
  await expect(rendered.or(fallback)).toBeVisible();
  if (await rendered.isVisible()) {
    await expect(
      page.getByRole('img', { name: 'Simulation volume' }).and(page.locator('canvas')),
    ).toBeVisible();
  }
  await expect(page.getByText('done', { exact: true })).toBeVisible();
});

test('reruns and deletes a saved simulation from history', async ({ page }) => {
  await page.getByRole('button', { name: /Twin hotspots/ }).click();
  await setRunLength(page, 12, 4);
  const original = await startRun(page);
  await expect(page.getByText('done', { exact: true })).toBeVisible();

  const history = page.getByRole('button', { name: 'History', exact: true });
  const row = (run: Run) =>
    page.locator('.history-row').filter({
      has: page.getByRole('button', { name: 'Delete ' + run.id, exact: true }),
    });
  await history.click();
  const rerunResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === `/runs/${original.id}/rerun`,
  );
  await row(original).getByRole('button', { name: 'Rerun', exact: true }).click();
  const response = await rerunResponse;
  expect(response.status()).toBe(202);
  const rerun = (await response.json()) as Run;
  expect(rerun.id).not.toBe(original.id);
  expect(rerun.request).toEqual(original.request);
  await expect(frame(page, 1)).toBeVisible();
  await expect(page.getByText('done', { exact: true })).toBeVisible();

  await history.click();
  const rerunRow = row(rerun);
  await rerunRow
    .getByRole('button', { name: 'Delete ' + rerun.id, exact: true })
    .click();
  const deletion = page.waitForResponse(
    (r) =>
      r.request().method() === 'DELETE' &&
      new URL(r.url()).pathname === `/runs/${rerun.id}`,
  );
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  expect((await deletion).status()).toBe(204);
  await expect(rerunRow).toHaveCount(0);
  await page.reload();
  await history.click();
  await expect(row(original)).toBeVisible();
  await expect(rerunRow).toHaveCount(0);
});
