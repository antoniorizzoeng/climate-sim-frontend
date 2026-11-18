import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { simulation } from '../fixtures/simulation';

const reason = 'The engine ran out of memory and was stopped by the system.';
const raw =
  '--------------------------------------------------------------------------\nPer user-direction, the job has been aborted.\n--------------------------------------------------------------------------';

for (const [width, theme] of [
  [1440, 'dark'],
  [375, 'light'],
] as const) {
  test.describe(`${width}px ${theme}`, () => {
    test.use({
      viewport: { width, height: width === 375 ? 812 : 1000 },
      colorScheme: theme,
      reducedMotion: 'reduce',
    });

    test('estimates a drawn 3D grid and blocks an oversized extrusion', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByText('Mock engine')).toBeVisible();
      await page.getByRole('button', { name: 'Conditions', exact: true }).click();
      await page
        .getByRole('group', { name: 'Simulation dimensions' })
        .getByRole('button', { name: '3D' })
        .click();
      await page.getByRole('button', { name: 'Initial field', exact: true }).click();
      for (const label of ['Columns', 'Rows']) {
        const field = page.getByLabel(label, { exact: true });
        await field.fill('1024');
        await field.blur();
      }
      const layers = page.getByLabel('Extrude to N layers');
      await layers.fill('105');
      await expect(page.getByText('Memory ≈ 3.3 GB of 6.8 GB')).toBeVisible();
      await expect(page.getByText(/^Output ≈/)).toBeVisible();
      const run = page.getByRole('button', { name: 'Run simulation' });
      await expect(run).toBeEnabled();

      await mkdir('artifacts/memory-guard', { recursive: true });
      await page.screenshot({
        path: `artifacts/memory-guard/setup-fitting-${width}-${theme}.png`,
        fullPage: true,
      });

      const validation = page.waitForResponse((response) => {
        const req = response.request();
        return (
          req.method() === 'POST' &&
          req.url().endsWith('/runs/validate') &&
          req.postDataJSON().source.nz === 1024
        );
      });
      await layers.fill('1024');
      const response = await validation;
      const message =
        'Needs about 30.3 GB of memory; this server can give the engine 6.8 GB. Use fewer layers or a smaller grid.';
      await expect(page.getByRole('complementary').getByRole('alert')).toHaveText(
        message,
      );
      await expect(page.getByText('Memory ≈ 30.3 GB of 6.8 GB')).toHaveClass('error');
      await expect(run).toBeDisabled();
      expect(await response.json()).toMatchObject({
        ok: false,
        errors: [{ loc: ['body', 'source'], msg: message }],
        resolved: { nx: 1024, ny: 1024, nz: 1024, memory_capacity_bytes: 6.8e9 },
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
        width,
      );
      await page.screenshot({
        path: `artifacts/memory-guard/setup-too-large-${width}-${theme}.png`,
        fullPage: true,
      });

      const rejection = await page.evaluate(
        async ({ url, body }) => {
          const response = await fetch(url.replace(/\/validate$/, ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          return { status: response.status, detail: (await response.json()).detail };
        },
        { url: response.url(), body: response.request().postData() },
      );
      expect(rejection).toMatchObject({
        status: 422,
        detail: [{ loc: ['body', 'source'], msg: message }],
      });
    });

    test('reports a failed run at step zero and keeps engine output collapsed', async ({
      page,
    }) => {
      const { resolved } = simulation();
      const failed = simulation({
        resolved: { ...resolved, nx: 1024, ny: 1024, nz: 1024, processes: 8 },
        name: 'Extruded hotspot',
        status: 'error',
        step: 0,
        frames: 0,
        time: 0,
        size_bytes: 0,
        message: `${reason}\n${raw}`,
      });
      await page.addInitScript((run) => {
        const fetch = window.fetch;
        window.fetch = (input, init) =>
          input instanceof Request &&
          input.method === 'POST' &&
          new URL(input.url).pathname.endsWith('/mock-api/runs')
            ? Promise.resolve(Response.json(run, { status: 202 }))
            : fetch(input, init);
      }, failed);
      await page.goto('/');
      await expect(page.getByText('Mock engine')).toBeVisible();
      await page.getByRole('button', { name: 'Run simulation' }).click();
      await expect(page.getByRole('region', { name: 'Field viewport' })).toContainText(
        'No frames were written',
      );
      await expect(
        page.getByText('No frames were written', { exact: true }),
      ).toHaveCount(2);
      await expect(page.getByRole('complementary').getByRole('alert')).toHaveText(
        reason,
      );
      await expect(page.getByText('Frame appearance')).toHaveCount(0);
      await expect(page.getByText('Export simulation')).toHaveCount(0);
      const back = page.getByRole('button', { name: 'Back to setup' });
      await expect(back).toBeEnabled();
      const output = page.getByText('Engine output', { exact: true });
      const pre = page.locator('.engine-output pre');
      await expect(output).toBeVisible();
      await expect(pre).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
        width,
      );
      await mkdir('artifacts/memory-guard', { recursive: true });
      await page.screenshot({
        path: `artifacts/memory-guard/failed-inspector-${width}-${theme}.png`,
        fullPage: true,
      });
      await output.click();
      await expect(pre).toBeVisible();
      expect(await pre.textContent()).toBe(raw);
      await back.click();
      await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();
    });
  });
}
