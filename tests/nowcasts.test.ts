// @vitest-environment node
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { api, checked } from '@/lib/api';
import { handlers } from '@/mocks/handlers';

const server = setupServer(...handlers);
const observatory = { lat: 28.76, lon: -17.89 };
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => vi.useRealTimers());

it('rejects footprints and parameters outside the contract', async () => {
  for (const override of [
    { lat: 89.9 },
    { lon: 181 },
    { hours: 1.5 },
    { resolution: 257 },
    { radius_km: 49 },
    { blend_tau_hours: 0 },
    { blend_tau_hours: -2 },
  ]) {
    const result = await api.POST('/nowcasts', {
      body: { ...observatory, ...override },
    });
    expect(result.response.status).toBe(422);
    expect(result.error?.detail[0].msg).toBeTruthy();
  }
});
it('refreshes to a separate record and deletes only its own layer runs', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const start = Date.now();
  const item = checked(
    await api.POST('/nowcasts', {
      body: { ...observatory, blend_tau_hours: 1.25 },
    }),
  );
  const params = { path: { id: item.id } };
  expect(item.status).toBe('fetching');
  expect(item.site).toBeNull();
  expect(item.best_window).toBeNull();
  expect(item.params.blend_tau_hours).toBe(1.25);
  vi.setSystemTime(start + 1000);
  const queued = checked(await api.GET('/nowcasts/{id}', { params }));
  expect(queued.status).toBe('queued');
  expect(queued.layers.map((l) => l.pressure_hpa)).toEqual([850, 500, 300]);
  const fresh = checked(await api.POST('/nowcasts/{id}/refresh', { params }));
  expect(fresh.id).not.toBe(item.id);
  expect(fresh.params).toEqual(item.params);
  const page = checked(await api.GET('/nowcasts', { params: { query: { limit: 1 } } }));
  expect(page.items[0].id).toBe(fresh.id);
  expect(
    checked(
      await api.GET('/nowcasts', { params: { query: { cursor: page.next_cursor! } } }),
    ).items[0].id,
  ).toBe(item.id);
  checked(await api.DELETE('/nowcasts/{id}', { params }));
  for (const layer of queued.layers)
    expect(
      (await api.GET('/runs/{runId}', { params: { path: { runId: layer.run_id } } }))
        .response.status,
    ).toBe(404);
  expect((await api.GET('/nowcasts/{id}', { params })).response.status).toBe(404);
  checked(await api.DELETE('/nowcasts/{id}', { params: { path: { id: fresh.id } } }));
});

it('returns the blended site samples and their best observing window', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const start = Date.parse('2026-11-17T21:00:00Z');
  vi.setSystemTime(start);
  const item = checked(await api.POST('/nowcasts', { body: observatory }));
  const params = { path: { id: item.id } };
  expect(item.params.blend_tau_hours).toBe(2);
  let record = item;
  try {
    for (const elapsed of [1000, 2000, 6000, 10000, 14000]) {
      vi.setSystemTime(start + elapsed);
      record = checked(await api.GET('/nowcasts/{id}', { params }));
    }
    expect(record.status).toBe('done');
    expect(record.site).toHaveLength(37);
    const site = record.site!;
    expect(site[0].blend).toEqual(site[0].nowcast);
    const { blend, model, nowcast } = site[12];
    for (const field of ['low', 'mid', 'high', 'total'] as const)
      expect(blend[field]).toBeCloseTo(
        model[field] + (nowcast[field] - model[field]) / Math.E,
      );
    expect(blend.clear).toBeCloseTo(1 - blend.total);
    expect(record.best_window).not.toBeNull();
    const window = record.best_window!;
    const stretch = site.filter(
      (sample) => sample.time >= window.start && sample.time <= window.end,
    );
    expect(stretch.length).toBeGreaterThan(0);
    expect(
      stretch.every((sample) => sample.blend.clear >= 0.7 && sample.seeing !== 'poor'),
    ).toBe(true);
    expect(window.mean_clear).toBeCloseTo(
      stretch.reduce((sum, sample) => sum + sample.blend.clear, 0) / stretch.length,
    );
  } finally {
    checked(await api.DELETE('/nowcasts/{id}', { params }));
  }
});

it('forecasts through dawn, bounds the best window to the night and rejects polar daylight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const start = Date.parse('2026-11-17T15:00:00Z');
  vi.setSystemTime(start);
  const record = checked(
    await api.POST('/nowcasts', {
      body: { ...observatory, window: 'tonight', hours: 1 },
    }),
  );
  const params = { path: { id: record.id } };
  try {
    for (const elapsed of [1000, 6000, 11000, 16000]) {
      vi.setSystemTime(start + elapsed);
      checked(await api.GET('/nowcasts/{id}', { params }));
    }
    const result = checked(await api.GET('/nowcasts/{id}', { params }));
    expect(result.status).toBe('done');
    expect(result.night!.moon.length).toBeGreaterThan(6);
    const end = Date.parse(result.site!.at(-1)!.time);
    expect(end).toBeGreaterThanOrEqual(Date.parse(result.night!.dawn));
    expect(end - Date.parse(result.night!.dawn)).toBeLessThan(600000);
    expect(Date.parse(result.best_window!.start)).toBeGreaterThanOrEqual(
      Date.parse(result.night!.dusk),
    );
    expect(Date.parse(result.best_window!.end)).toBeLessThanOrEqual(
      Date.parse(result.night!.dawn),
    );
  } finally {
    checked(await api.DELETE('/nowcasts/{id}', { params }));
  }
  vi.setSystemTime(Date.parse('2026-06-21T12:00:00Z'));
  const polar = await api.POST('/nowcasts', {
    body: { lat: 70, lon: 12, window: 'tonight' },
  });
  expect(polar.response.status).toBe(422);
  expect(polar.error?.detail[0].msg).toMatch(/no astronomical darkness/i);
});
