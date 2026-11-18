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
  const item = checked(await api.POST('/nowcasts', { body: observatory }));
  const params = { path: { id: item.id } };
  expect(item.status).toBe('fetching');
  expect(item.site).toBeNull();
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
