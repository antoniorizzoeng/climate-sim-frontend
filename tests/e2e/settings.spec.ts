import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('opens Settings from the header and restores views and sections through reload and history', async ({
  page,
}) => {
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Settings', exact: true });
  await gear.click();
  await expect(page).toHaveURL(/\?view=settings$/);
  await expect(
    page.getByRole('heading', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await expect(gear).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByText(/sign-in and per-user storage quotas/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Maps' })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Simulation workspace' }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Maps' })).toBeVisible();
  await gear.click();
  await expect(
    page.getByRole('heading', { name: 'Simulation workspace' }),
  ).toBeVisible();
});

test('tests individual keys with MapTiler and enables Sky search only while a key is saved', async ({
  page,
  context,
}) => {
  const requests: URL[] = [];
  await context.route('https://api.maptiler.com/**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    return route.fulfill({
      status: url.searchParams.get('key') === 'valid-key' ? 200 : 403,
      json: { features: [] },
    });
  });
  await page.goto('/?view=sky');
  const hint = page.getByText(
    'Add a MapTiler key in Settings to enable maps and place search',
  );
  await expect(hint).toHaveCount(1);
  await expect(page.getByLabel('Address or place')).toHaveCount(0);
  await hint.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\?view=settings&section=maps$/);
  const testKey = page.getByRole('button', { name: 'Test key' });
  await expect(testKey).toBeDisabled();
  expect(requests).toHaveLength(0);
  const key = page.getByLabel('MapTiler API key');
  await key.fill('invalid-key');
  await testKey.click();
  await expect(page.getByText('Invalid or restricted MapTiler key.')).toBeVisible();
  await key.fill('  valid-key  ');
  await expect(key).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show', exact: true }).click();
  await expect(key).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(key).toHaveAttribute('type', 'password');
  await testKey.click();
  await expect(page.getByText('Valid MapTiler key.')).toBeVisible();
  expect(
    requests.map((url) => [
      url.hostname,
      url.pathname,
      url.searchParams.get('limit'),
      url.searchParams.get('key'),
    ]),
  ).toEqual([
    ['api.maptiler.com', '/geocoding/Zurich.json', '1', 'invalid-key'],
    ['api.maptiler.com', '/geocoding/Zurich.json', '1', 'valid-key'],
  ]);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Key saved in this browser.')).toBeVisible();
  await page.reload();
  await expect(key).toHaveValue('valid-key');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\?view=sky$/);
  await expect(page.getByLabel('Address or place')).toBeVisible();
  await expect(hint).toHaveCount(0);

  const settings = await context.newPage();
  await settings.goto('/?view=settings');
  await settings.getByRole('button', { name: 'Remove' }).click();
  await expect(settings.getByText('Key removed.')).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Test key' })).toBeDisabled();
  await expect(hint).toHaveCount(1);
  await expect(page.getByLabel('Address or place')).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

test('defaults new workspaces to the saved units and clears local app data after confirmation', async ({
  page,
}) => {
  await page.goto('/?view=settings&section=units');
  const defaultUnits = page.getByLabel('Default unit system');
  await expect(defaultUnits).toHaveValue('km');
  await defaultUnits.selectOption('m');

  await page.goto('/');
  await expect(page.getByText('Mock engine')).toBeVisible();
  await page.getByRole('button', { name: 'Conditions', exact: true }).click();
  const workspaceUnits = page.getByRole('combobox', {
    name: 'Unit system',
    exact: true,
  });
  await expect(workspaceUnits).toHaveValue('m');
  await workspaceUnits.selectOption('cell');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Units', exact: true }).click();
  await expect(defaultUnits).toHaveValue('m');
  await defaultUnits.selectOption('km');
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(workspaceUnits).toHaveValue('cell');

  await page.evaluate(() => {
    localStorage.setItem('climatesim.sky.mapKey', 'stored-key');
    localStorage.setItem('climatesim.settings.units', 'cell');
    localStorage.setItem(
      'climatesim.sky.sites',
      JSON.stringify([{ name: 'Teide', lat: 28.3, lon: -16.5 }]),
    );
    localStorage.setItem('unrelated', 'keep');
  });
  await page.goto('/?view=settings&section=data');
  const clear = page.getByRole('button', { name: 'Clear local data' });
  page.once('dialog', (dialog) => dialog.dismiss());
  await clear.click();
  expect(await page.evaluate(() => localStorage.length)).toBe(4);
  page.once('dialog', (dialog) => dialog.accept());
  await clear.click();
  await expect(page.getByText('Local data cleared.')).toBeVisible();
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual([
    ['unrelated', 'keep'],
  ]);
  await page.getByRole('button', { name: 'Units', exact: true }).click();
  await expect(defaultUnits).toHaveValue('km');
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Saved sites' })).toHaveCount(0);
});

for (const width of [1440, 375]) {
  for (const colorScheme of ['dark', 'light'] as const) {
    test(`Settings at ${width} px in ${colorScheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/?view=settings');
      await expect(page.getByText('Mock engine')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Maps' })).toBeVisible();
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const result = await page.evaluate(async () => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        violations: (await window.axe.run(document)).violations.map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => node.target),
        })),
      }));
      expect(result).toEqual({ overflow: 0, colorScheme, violations: [] });
      await mkdir('artifacts/settings', { recursive: true });
      await page.screenshot({
        path: `artifacts/settings/settings-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      if (width === 1440 && colorScheme === 'dark') {
        await page.getByRole('button', { name: 'Sky', exact: true }).click();
        await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
        await page.screenshot({
          path: 'artifacts/settings/sky-without-key.png',
          fullPage: true,
        });
      }
    });
  }
}
