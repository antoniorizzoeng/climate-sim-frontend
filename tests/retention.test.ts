// @vitest-environment node
import { afterEach, beforeAll, afterAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';
import { api, checked, saveDrawing } from '@/lib/api';
import { makePlane, type RequestBody } from '@/lib/model';
import { fields, runs } from '@/mocks/store';
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  vi.useRealTimers();
  fields.clear();
  runs.clear();
});
it('archives the field, expires the outputs and reruns from the retained original', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const field = await saveDrawing(makePlane(8, 8));
  const body: RequestBody = {
    source: { kind: 'field', field_id: field.id },
    steps: 5,
    dt: 0.1,
  };
  const r = checked(await api.POST('/runs', { body }));
  const run = { params: { path: { runId: r.id } } },
    source = { params: { path: { fieldId: field.id } } };
  expect((await api.DELETE('/fields/{fieldId}', source)).response.status).toBe(409);
  vi.setSystemTime(now + 8 * 86400000);
  expect(checked(await api.GET('/runs/{runId}', run)).status).toBe('expired');
  expect(checked(await api.GET('/fields/{fieldId}', source)).state).toBe('archived');
  expect(
    (await api.GET('/fields/{fieldId}/values', { ...source, parseAs: 'arrayBuffer' }))
      .response.status,
  ).toBe(409);
  expect(
    checked(
      await api.GET('/fields/{fieldId}/original', {
        ...source,
        parseAs: 'arrayBuffer',
      }),
    ).byteLength,
  ).toBeGreaterThan(512);
  expect(checked(await api.POST('/runs/{runId}/rerun', run)).id).not.toBe(r.id);
  expect(checked(await api.GET('/fields/{fieldId}', source)).state).toBe('active');
});
it('reports queue position and advances the next run after cancellation', async () => {
  const body: RequestBody = {
    source: { kind: 'preset', preset: 'constant_zero', nx: 8, ny: 4 },
    steps: 4,
    dt: 1,
  };
  const first = checked(await api.POST('/runs', { body })),
    second = checked(await api.POST('/runs', { body }));
  expect(second.status).toBe('queued');
  expect(second.queue_position).toBe(1);
  checked(await api.DELETE('/runs/{runId}', { params: { path: { runId: first.id } } }));
  expect(
    checked(await api.GET('/runs/{runId}', { params: { path: { runId: second.id } } }))
      .status,
  ).toBe('running');
});
