import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { encode } from 'fast-png';

test.use({
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
});
test('uses the bundled MapLibre renderer with a local fixture for MapTiler', async ({
  page,
  context,
}) => {
  test.setTimeout(100000);
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': '#819b89' } },
    ],
  };
  const dem = new Uint8Array(256 * 256 * 3);
  for (let i = 0; i < 256 * 256; i++) {
    const value =
      100000 +
      Math.round(
        8000 * (1 + Math.sin((i % 256) / 20) * Math.cos(Math.floor(i / 256) / 21)),
      );
    dem.set([value >> 16, (value >> 8) & 255, value & 255], i * 3);
  }
  const png = Buffer.from(encode({ width: 256, height: 256, channels: 3, data: dem }));
  const seen: string[] = [];
  await context.route('https://api.maptiler.com/**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('key')).toBe('browser-fixture');
    seen.push(url.pathname);
    if (url.pathname.startsWith('/geocoding/'))
      return route.fulfill({
        json: {
          features: [
            { id: '1', place_name: 'Teide Observatory', center: [-16.51, 28.31] },
          ],
        },
      });
    if (url.pathname.endsWith('/style.json')) return route.fulfill({ json: style });
    if (url.pathname.endsWith('/tiles.json'))
      return route.fulfill({
        json: {
          tilejson: '2.2.0',
          tiles: ['https://api.maptiler.com/dem/{z}/{x}/{y}.png?key=browser-fixture'],
          minzoom: 0,
          maxzoom: 4,
        },
      });
    return route.fulfill({ body: png, contentType: 'image/png' });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('MapTiler API key').fill('browser-fixture');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const elevation = page.getByLabel('Elevation (m)');
  await elevation.fill('4205');
  await page.getByLabel('Address or place').fill('Teide');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Teide Observatory' }).click();
  await expect(page.getByLabel('Latitude (°)')).toHaveValue('28.31');
  await expect(elevation).toHaveValue('');
  await page.getByRole('button', { name: 'Choose on map' }).click();
  await expect(page.locator('.sky-site-map .maplibregl-marker')).toBeVisible();
  await page.getByRole('button', { name: 'Close map' }).click();
  await page.getByLabel('Cells per side').fill('24');
  const post = page.waitForRequest(
    (r) => r.url().endsWith('/nowcasts') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Run nowcast' }).click();
  expect((await post).postDataJSON()).toEqual({
    lat: 28.31,
    lon: -16.51,
    elevation_m: null,
    window: 'tonight',
    radius_km: 300,
    resolution: 24,
  });
  await expect(page.locator('.cloud-map canvas')).toHaveCount(3, { timeout: 35000 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Frame scrubber')).not.toHaveValue('0', {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  expect(seen.some((p) => p.startsWith('/dem/'))).toBe(true);
  await mkdir('artifacts', { recursive: true });
  await page
    .locator('section.panel')
    .filter({ has: page.getByRole('heading', { name: 'Layer movies' }) })
    .first()
    .screenshot({ path: 'artifacts/terrain-mock.png' });
  await page.getByRole('button', { name: 'Show cloud frames' }).click();
  await expect(page.getByRole('img', { name: /cloud cover · frame/ })).toHaveCount(3);
});
