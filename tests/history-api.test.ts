// @vitest-environment node
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { handlers } from '@/mocks/handlers';
import { api, checked, saveDrawing } from '@/lib/api';
import { makePlane } from '@/lib/model';
import { fields, runs } from '@/mocks/store';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  vi.useRealTimers();
  fields.clear();
  runs.clear();
});

it('filters before paginating, implements all six orders, and binds cursors to the filters', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  const a = await saveDrawing(makePlane(4, 4), 'Snow Z');
  vi.setSystemTime(Date.now() + 1000);
  const b = await saveDrawing(makePlane(6, 6), 'Snow A');
  await saveDrawing(makePlane(4, 4), 'Sun');
  for (const [sort, first] of [
    ['created_desc', b],
    ['created_asc', a],
    ['size_desc', b],
    ['size_asc', a],
    ['name_asc', b],
    ['name_desc', a],
  ] as const) {
    const query = { q: 'sNoW', sort, limit: 1 };
    const page = checked(await api.GET('/fields', { params: { query } }));
    expect(page).toMatchObject({
      items: [{ id: first.id }],
      total: 2,
      total_bytes: a.size_bytes + b.size_bytes,
    });
    expect(
      checked(
        await api.GET('/fields', {
          params: { query: { ...query, cursor: page.next_cursor! } },
        }),
      ).next_cursor,
    ).toBeNull();
    expect(
      (
        await api.GET('/fields', {
          params: { query: { ...query, q: 'sun', cursor: page.next_cursor! } },
        })
      ).response.status,
    ).toBe(422);
  }
  expect(
    checked(
      await api.GET('/fields', {
        params: { query: { created_from: a.created_at, created_to: b.created_at } },
      }),
    ).items,
  ).toEqual([a]);
  expect(
    checked(await api.GET('/fields', { params: { query: { q: b.id.slice(0, 8) } } }))
      .items,
  ).toEqual([b]);
  const renamed = checked(
    await api.PATCH('/fields/{fieldId}', {
      params: { path: { fieldId: b.id } },
      body: { name: ' Frost ' },
    }),
  );
  expect(renamed.name).toBe('Frost');
});
it('excludes cloud runs from history and counts their storage with the parent', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const user = checked(
    await api.POST('/runs', {
      body: {
        name: 'User run',
        source: { kind: 'preset', preset: 'constant_zero', nx: 8, ny: 8 },
        steps: 2,
        dt: 1,
      },
    }),
  );
  const record = checked(await api.POST('/nowcasts', { body: { lat: 48, lon: 12 } }));
  try {
    vi.setSystemTime(Date.now() + 5000);
    checked(await api.GET('/nowcasts/{id}', { params: { path: { id: record.id } } }));
    const page = checked(await api.GET('/runs'));
    expect(page.items.map((r) => r.id)).toEqual([user.id]);
    const storage = checked(await api.GET('/storage'));
    expect(storage.runs_bytes).toBe(page.total_bytes);
    expect(storage.nowcasts_bytes).toBeGreaterThan(3 * 96 * 96 * 4);
    expect(storage.used_bytes).toBe(storage.nowcasts_bytes + storage.runs_bytes);
    expect(
      checked(
        await api.PATCH('/runs/{runId}', {
          params: { path: { runId: user.id } },
          body: { name: 'New run' },
        }),
      ).name,
    ).toBe('New run');
  } finally {
    checked(
      await api.DELETE('/nowcasts/{id}', { params: { path: { id: record.id } } }),
    );
  }
});
