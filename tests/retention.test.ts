// @vitest-environment node
import { decode as decodePng } from 'fast-png';
import { afterEach, beforeAll, afterAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';
import { api, checked, decodeGrid, loadVolume, saveDrawing } from '@/lib/api';
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

it('serves a projected PNG, sampled volume, and NetCDF result from the same completed demo run', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const run = checked(
    await api.POST('/runs', {
      body: {
        source: { kind: 'preset', preset: 'gaussian_hotspot', nx: 20, ny: 20, nz: 4 },
        steps: 3,
        dt: 0.2,
        frames: 4,
      },
    }),
  );
  const path = { runId: run.id };
  expect(
    (await api.GET('/runs/{runId}/result.nc', { params: { path } })).response.status,
  ).toBe(409);
  vi.setSystemTime(now + 5000);
  const signal = new AbortController().signal;
  const volume = await loadVolume(run.id, 0, signal);
  expect([volume.nx, volume.ny, volume.nz]).toEqual([20, 20, 4]);
  const result = checked(
    await api.GET('/runs/{runId}/result.nc', {
      params: { path },
      parseAs: 'arrayBuffer',
    }),
  );
  expect([...new Uint8Array(result, 0, 4)]).toEqual([67, 68, 70, 5]);
  expect(result.byteLength).toBeGreaterThan(volume.data.byteLength * 4);

  const png = checked(
    await api.GET('/runs/{runId}/frames/{n}.png', {
      params: {
        path: { ...path, n: 0 },
        query: { axis: 'z', projection: 'max', max_side: 16 },
      },
      parseAs: 'arrayBuffer',
    }),
  );
  expect(decodePng(new Uint8Array(png))).toMatchObject({
    width: 16,
    height: 16,
    channels: 4,
  });
  const sample = await api.GET('/runs/{runId}/frames/{n}/values', {
    params: {
      path: { ...path, n: 0 },
      query: { axis: 'z', projection: 'max', i0: 9, j0: 9, w: 1, h: 1 },
    },
    parseAs: 'arrayBuffer',
  });
  expect(decodeGrid(checked(sample), sample.response.headers).data[0]).toBe(
    Math.max(...Array.from({ length: 4 }, (_, z) => volume.data[z * 400 + 189])),
  );
});

it('renders and caches a multi-frame GIF using the demo export endpoint', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const run = checked(
    await api.POST('/runs', {
      body: {
        source: { kind: 'preset', preset: 'constant_zero', nx: 8, ny: 6 },
        steps: 2,
        dt: 0.25,
        frames: 3,
      },
    }),
  );
  const options = {
    params: { path: { runId: run.id, format: 'gif' as const }, query: { fps: 10 } },
    parseAs: 'blob' as const,
  };
  vi.setSystemTime(now + 5000);
  const first = await api.GET('/runs/{runId}/export.{format}', options);
  expect(first.response.status).toBe(202);
  expect(first.response.headers.get('Retry-After')).toBe('1');
  expect(JSON.parse(await checked(first).text())).toEqual({ progress: 0 });
  let gif: Blob | undefined;
  await vi.waitFor(async () => {
    const result = await api.GET('/runs/{runId}/export.{format}', options);
    expect(result.response.status, JSON.stringify(result.error?.detail)).toBe(200);
    gif = checked(result);
  });
  expect(gif?.type).toBe('image/gif');
  const bytes = new Uint8Array(await gif!.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  expect([...bytes.slice(6, 10)]).toEqual([8, 0, 6, 0]);
  expect(bytes.at(-1)).toBe(0x3b);
  const cached = await api.GET('/runs/{runId}/export.{format}', options);
  expect(cached.response.status).toBe(200);
  expect(new Uint8Array(await checked(cached).arrayBuffer())).toEqual(bytes);
});
