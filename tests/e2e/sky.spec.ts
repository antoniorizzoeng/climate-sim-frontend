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
  await page.getByLabel('Latitude (°)').fill('19.82');
  await page.getByLabel('Longitude (°)').fill('-155.47');
  const elevation = page.getByLabel('Elevation (m)');
  await expect(elevation).toHaveValue('');
  await elevation.fill('4205');
  await page.getByLabel('Site name').fill('Mauna Kea');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await elevation.clear();
  await page.getByRole('button', { name: 'Mauna Kea' }).click();
  await expect(elevation).toHaveValue('4205');
  await page.getByRole('button', { name: 'Run nowcast' }).click();
  const chart = page.getByRole('region', { name: 'Tonight at a glance' });
  await expect(chart.getByText('Blend (recommended)')).toBeVisible({
    timeout: 30000,
  });
  await expect(chart.getByText(/Blend = wind transport.*τ = 2 h/)).toBeVisible();
  await expect(chart.getByText('Nowcast (wind transport)')).toBeVisible();
  await expect(chart.getByText('Model forecast (Open-Meteo)')).toBeVisible();
  await expect(page.getByText(/Nowcast used 4,205 m · entered/)).toBeVisible();
  await expect(
    chart.getByText(/Counting cloud above 4,205 m · low cloud below the site ignored/),
  ).toBeVisible();
  await expect(chart.getByText('51% counted')).toBeVisible();
  await expect(chart.locator('.cover-bands .below-site svg')).toHaveCSS(
    'opacity',
    '0.45',
  );
  await expect(page.locator('.sky-movies').getByText('below site')).toBeVisible();
  await expect(page.locator('.sky-movies').getByText('51% counted')).toBeVisible();
  await expect(page.locator('.sky-movie.below-site .sky-frame')).toHaveCSS(
    'opacity',
    '0.45',
  );
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
