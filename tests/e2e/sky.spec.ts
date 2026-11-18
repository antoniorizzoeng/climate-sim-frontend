import { captureThemes } from './theme-preview';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('observing site → nowcast timeline → three synchronised layer movies', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const external: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host === 'maptiler.com' || host.endsWith('.maptiler.com'))
      external.push(req.url());
  });
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-11-17T21:00:00Z'));
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await expect(page.getByLabel('Latitude (°)')).toHaveValue('');
  await page.getByLabel('Latitude (°)').fill('28.76');
  await page.getByLabel('Longitude (°)').fill('-17.89');
  await page.getByLabel('Site name').fill('Roque de los Muchachos');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Roque de los Muchachos' }).click();
  await page.getByRole('button', { name: 'Run nowcast' }).click();
  const chart = page.getByRole('region', { name: 'Tonight at a glance' });
  await expect(chart.getByText('Blend (recommended)')).toBeVisible({
    timeout: 30000,
  });
  await expect(chart.getByText(/Blend = wind transport.*τ = 2 h/)).toBeVisible();
  await expect(chart.getByText('Nowcast (wind transport)')).toBeVisible();
  await expect(chart.getByText('Model forecast (Open-Meteo)')).toBeVisible();
  await expect(
    chart.getByRole('heading', { name: 'Blended cloud cover' }),
  ).toBeVisible();
  await expect(chart.locator('polyline.blend-line')).toHaveCSS('stroke-width', '3px');
  for (const series of ['nowcast', 'model'])
    await expect(chart.locator('polyline.' + series + '-line')).toHaveCSS(
      'stroke-width',
      '1.5px',
    );
  await expect(chart.getByText('No qualifying stretch')).toHaveCount(0);
  for (const layer of ['low', 'mid', 'high'])
    await expect(
      page.getByRole('img', { name: layer + ' cloud cover · frame 1', exact: true }),
    ).toBeVisible();
  await page.getByRole('button', { name: 'Next frame' }).click();
  await expect(page.getByRole('img', { name: /cloud cover · frame 2$/ })).toHaveCount(
    3,
  );
  await expect(page.getByLabel('Frame scrubber')).toHaveAttribute(
    'aria-valuetext',
    /\d{2}:10/,
  );
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  await mkdir('artifacts', { recursive: true });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const issues = await page.evaluate(async () =>
      (await window.axe.run(document)).violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    );
    expect(issues).toEqual([]);
    await captureThemes(page, 'sky', width);
  }
  await page.getByRole('button', { name: 'Refresh nowcast' }).click();
  await expect(page.locator('.sky-recent li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.locator('.sky-recent li')).toHaveCount(1);
  await page.locator('.sky-recent button').click();
  await expect(chart).toBeVisible();
  expect(external).toEqual([]);
});
