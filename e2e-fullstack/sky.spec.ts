import { expect, test } from '@playwright/test';

test('runs a Sky nowcast and renders the three cloud layers', async ({ page }) => {
  test.skip(
    process.env.E2E_NETWORK !== '1',
    'The backend calls Open-Meteo over the network.',
  );
  await page.goto('/');
  await expect(page.getByText('Engine online', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await page.getByLabel('Latitude (°)').fill('28.76');
  await page.getByLabel('Longitude (°)').fill('-17.89');
  await page.getByLabel('Hours', { exact: true }).fill('1');
  await page.getByLabel('Cells per side').fill('16');
  await page.getByRole('button', { name: 'Run nowcast' }).click();

  const chart = page.getByRole('region', { name: 'Tonight at a glance' });
  await expect(chart.getByText('Model forecast (Open-Meteo)')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('img', { name: /cloud cover · frame 1$/ })).toHaveCount(
    3,
    {
      timeout: 60_000,
    },
  );
});
