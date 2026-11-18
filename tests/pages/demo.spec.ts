import { expect, test } from '@playwright/test';

test('the Pages export runs simulations and nowcasts in the browser', async ({
  page,
  context,
  baseURL,
}, info) => {
  if (!baseURL) throw new Error('The Pages test requires a base URL');
  const errors: string[] = [];
  const escapedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL) && !url.startsWith(baseURL + 'mock-api/'))
      return route.continue();
    escapedRequests.push(url);
    return route.abort();
  });

  const config = page.waitForResponse('**/mock-api/config');
  await page.goto('./');
  await expect(
    page.getByRole('complementary', { name: 'Demo information' }),
  ).toBeVisible();
  await expect(page.getByText('Mock engine', { exact: true })).toBeVisible();
  await expect(page.getByText(/not a physics simulation/)).toBeVisible();
  expect((await config).fromServiceWorker()).toBe(true);
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      script: navigator.serviceWorker.controller?.scriptURL,
    };
  });
  expect(worker).toEqual({ scope: baseURL, script: baseURL + 'mockServiceWorker.js' });

  await expect(page.getByText(/^Memory ≈ .* of 6.8 GB$/)).toBeVisible();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  await page.getByLabel('Steps', { exact: true }).fill('16');
  await page.getByLabel('Frames to keep').fill('5');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByRole('button', { name: 'Result.nc' })).toBeEnabled({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Next frame' }).click();
  await expect(page.getByRole('img', { name: 'Simulation frame 2' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('workspace.png'), fullPage: true });

  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Simulation history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rerun' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('history.png'), fullPage: true });

  await page.goto('./?history_tab=fields&q=demo&sort=size_desc');
  await expect(page.getByRole('heading', { name: 'Simulation history' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Fields', pressed: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Search by name')).toHaveValue('demo');
  await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveValue(
    'size_desc',
  );
  await expect(page.getByText('No matching fields.')).toBeVisible();

  await page.goto('./?view=sky');
  await page.clock.setSystemTime(new Date('2026-11-17T21:00:00Z'));
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(baseURL + '?view=settings&section=maps');
  await expect(page.getByLabel('MapTiler API key')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('MapTiler API key')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Observing sky' })).toBeVisible();
  await page.getByLabel('Latitude (°)').fill('19.82');
  await page.getByLabel('Longitude (°)').fill('-155.47');
  await expect(page.getByLabel('Elevation (m)')).toHaveValue('');
  const nowcast = page.waitForResponse(
    (response) =>
      response.url().endsWith('/mock-api/nowcasts') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Run nowcast' }).click();
  expect((await nowcast).fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Blended cloud cover' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText('Model forecast (simulated)')).toBeVisible();
  await expect(
    page.getByText(/Nowcast used 4,205 m · from Open-Meteo terrain/),
  ).toBeVisible();
  await expect(
    page.getByText(/Counting cloud above 4,205 m · low cloud below the site ignored/),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /cloud cover · frame 1$/ })).toHaveCount(
    3,
  );
  await page.screenshot({ path: info.outputPath('sky.png'), fullPage: true });
  expect(escapedRequests).toEqual([]);
  expect(errors).toEqual([]);
});
