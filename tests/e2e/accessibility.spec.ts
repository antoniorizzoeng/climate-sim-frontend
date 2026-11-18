import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import type axe from 'axe-core';

declare global {
  interface Window {
    axe: typeof axe;
  }
}

async function audit(page: Page, screen: string) {
  await test.step(screen, async () => {
    const result = await page.evaluate(async () => {
      const { violations } = await window.axe.run(document);
      return {
        violations: violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(result, screen).toEqual({ violations: [], overflow: 0 });
  });
}

for (const width of [375, 768, 1440]) {
  test('workspace accessibility at ' + width + ' px', async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByText('Mock engine')).toBeVisible();
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    await expect(page.getByLabel('Columns')).toBeVisible();
    await expect(page.getByLabel('Value min')).toBeVisible();
    await page.getByText('What am I looking at?').click();
    await audit(page, 'Draw and explainer');
    await page.getByRole('button', { name: 'Expand viewport' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page, 'Expanded viewport');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Expand viewport' })).toBeFocused();
    await page.getByRole('button', { name: 'Conditions', exact: true }).click();
    await page.getByText('Advanced conditions').click();
    await audit(page, 'Conditions');
    await page.getByRole('button', { name: 'Initial field', exact: true }).click();
    await page.getByRole('button', { name: 'Upload file' }).click();
    await page.getByLabel('Upload NetCDF file').setInputFiles({
      name: 'regional-weather-observations.nc',
      mimeType: 'application/x-netcdf',
      buffer: Buffer.from('mock'),
    });
    await expect(page.getByLabel('Missing-cell fill value')).toBeVisible();
    await audit(page, 'Upload and selected coordinates');
    await page.getByRole('button', { name: /Crosswind plume/ }).click();
    await expect(page.getByLabel('Draw initial field')).toHaveAttribute('width', '128');
    await mkdir('artifacts', { recursive: true });
    if (width !== 1440)
      await page.screenshot({
        path: 'artifacts/workspace-' + width + '.png',
        fullPage: true,
      });
    await page.getByRole('button', { name: 'Run simulation' }).click();
    await expect(
      page.getByRole('img', { name: 'Simulation frame 1', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Compare frames' }).click();
    await page.getByRole('button', { name: 'Smooth pixels' }).click();
    await page.getByRole('button', { name: 'Next frame' }).click();
    await expect(
      page.getByRole('img', { name: 'Simulation frame 2', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download MP4' })).toBeEnabled();
    await audit(page, 'Run inspector, player, comparison and export');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: /Delete / })
      .first()
      .click();
    await audit(page, 'Run history and confirmation');
    await page.getByRole('button', { name: 'Fields', exact: true }).click();
    await expect(page.getByText('regional-weather-observations.nc')).toBeVisible();
    await audit(page, 'Field history');
  });
}
test('explains missing service workers and offers reconnection', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined }),
  );
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Browser demo unavailable',
  );
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'localhost or HTTPS',
  );
  await page.getByRole('button', { name: 'Reconnect' }).click();
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await audit(page, 'Unavailable demo at ' + width + ' px');
  }
});
