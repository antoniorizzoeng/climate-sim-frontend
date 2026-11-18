import { captureThemes } from './theme-preview';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('renames and filters history, then restores the same search on reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.getByLabel('Upload NetCDF file').setInputFiles({
    name: 'observations.nc',
    mimeType: 'application/x-netcdf',
    buffer: Buffer.from('mock'),
  });
  await expect(page.getByLabel('Missing-cell fill value')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Fields', exact: true }).click();
  await page.getByRole('button', { name: 'Rename observations.nc' }).click();
  await page.getByLabel('New name').fill('Alpine observations');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Alpine observations', { exact: true })).toBeVisible();
  await page.getByLabel('Search by name').fill('Alpine');
  await page
    .getByRole('combobox', { name: 'Sort', exact: true })
    .selectOption('size_desc');
  await expect(page).toHaveURL(/q=Alpine/);
  await expect(page.getByText(/1 matching field/)).toBeVisible();
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  await mkdir('artifacts', { recursive: true });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 960 });
    await captureThemes(page, 'history', width);
  }
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Fields', pressed: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Search by name')).toHaveValue('Alpine');
  await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveValue(
    'size_desc',
  );
});
