import { expect, type Page } from '@playwright/test';

// This worktree's shell currently forces dark. Exercise the component theme tokens
// in isolation until the shared light stylesheet is integrated.
export async function captureThemes(
  page: Page,
  view: 'history' | 'sky',
  width: number,
) {
  const selector = view === 'sky' ? '.sky-layout' : '.history';
  const panel = page.locator(selector);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({
    path: `artifacts/${view}-${width}-dark.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const needsPreview = await panel.evaluate(
    (el) => getComputedStyle(el).colorScheme === 'dark',
  );
  const fixture =
    needsPreview &&
    (await page.addStyleTag({
      content: `
    ${selector} {color-scheme:light; --bg:#f1f3f6; --panel:#fff; --raised:#edf0f3; --text:#232831; --muted:#505965; --line:#c5cbd2; --accent:#904822; color:var(--text);}
    ${selector} :is(label,summary) {color:var(--muted);}
    ${selector} :is(input:not([type=range]),select,.secondary,.segmented,.segmented button,.play-btn,kbd) {color:var(--text); background:var(--raised);border-color:var(--line);}
    ${selector} .primary {background:var(--accent);color:white;}
    ${selector} .segmented button[aria-pressed=true] {background:var(--panel);}
  `,
    }));
  try {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const issues = await page.evaluate(
      async (sel) =>
        (await window.axe.run(sel)).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => [n.target, n.failureSummary]),
        })),
      selector,
    );
    expect(issues).toEqual([]);
    await panel.screenshot({
      path: `artifacts/${view}-${width}-light${needsPreview ? '-preview' : ''}.png`,
    });
  } finally {
    if (fixture) await fixture.evaluate((el) => el.parentNode?.removeChild(el));
  }
}
