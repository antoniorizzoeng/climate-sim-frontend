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
    { elevation_m: -501 },
    { elevation_m: 9001 },
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
      body: { ...observatory, blend_tau_hours: 1.25, elevation_m: 0 },
    }),
  );
  const params = { path: { id: item.id } };
  expect(item.status).toBe('fetching');
  expect(item.site).toBeNull();
  expect(item.site_elevation).toBeNull();
  expect(item.best_window).toBeNull();
  expect(item.params.blend_tau_hours).toBe(1.25);
  vi.setSystemTime(start + 1000);
  const queued = checked(await api.GET('/nowcasts/{id}', { params }));
  expect(queued.status).toBe('queued');
  expect(queued.layers.map((l) => l.pressure_hpa)).toEqual([850, 500, 300]);
  expect(queued.site_elevation).toEqual({
    elevation_m: 0,
    source: 'user',
    layer_weights: { low: 1, mid: 1, high: 1 },
  });
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

it.each([null, 4205])(
  'computes above-site totals and the blended observing window with elevation %s',
  async (elevation_m) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.parse('2026-11-17T21:00:00Z');
    vi.setSystemTime(start);
    const item = checked(
      await api.POST('/nowcasts', { body: { ...observatory, elevation_m } }),
    );
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
      const weights =
        elevation_m === null
          ? { low: 1, mid: 1, high: 1 }
          : { low: 0, mid: 0.51, high: 1 };
      expect(record.site_elevation).toEqual({
        elevation_m: elevation_m ?? 0,
        source: elevation_m === null ? 'open-meteo' : 'user',
        layer_weights: weights,
      });
      const site = record.site!;
      expect(site[0].blend).toEqual(site[0].nowcast);
      const aboveSite = ({ low, mid, high }: (typeof site)[number]['model']) =>
        1 -
        (1 - low * weights.low) * (1 - mid * weights.mid) * (1 - high * weights.high);
      expect(site[0].nowcast.total).toBeCloseTo(aboveSite(site[0].nowcast));
      expect(site[0].nowcast.clear).toBeCloseTo(1 - site[0].nowcast.total);
      expect(site[1].model.total).toBeCloseTo(
        elevation_m === null
          ? 0.37 + (0.12 + 0.125 * (1 + Math.cos(1.15)) - 0.37) / 6
          : aboveSite(site[1].model),
      );
      expect(site[1].model.clear).toBeCloseTo(1 - site[1].model.total);
      expect(site[0].nowcast.low).toBeGreaterThan(0);
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
        stretch.every(
          (sample) => sample.blend.clear >= 0.7 && sample.seeing !== 'poor',
        ),
      ).toBe(true);
      expect(window.mean_clear).toBeCloseTo(
        stretch.reduce((sum, sample) => sum + sample.blend.clear, 0) / stretch.length,
      );
    } finally {
      checked(await api.DELETE('/nowcasts/{id}', { params }));
    }
  },
);

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
