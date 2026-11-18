import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import Workspace from '@/app/page';
import { baseUrl } from '@/lib/api';
import type { RequestBody } from '@/lib/model';
import { config } from '@/mocks/store';
import { field, simulation, storage } from './fixtures/simulation';

const queued = simulation({ status: 'queued', frames: 0, step: 0, queue_position: 2 });
const running = {
  ...queued,
  status: 'running' as const,
  queue_position: null,
  step: 2,
};
const done = simulation({ frames: 1 });
const server = setupServer(
  http.get(baseUrl + '/health', () => HttpResponse.json({ api_version: '1.4.7' })),
  http.get(baseUrl + '/storage', () => HttpResponse.json(storage)),
  http.get(baseUrl + '/config', () => HttpResponse.json(config)),
  http.post(baseUrl + '/fields/drawn', () => HttpResponse.json(field)),
  http.post(baseUrl + '/runs/validate', () =>
    HttpResponse.json({
      ok: true,
      warnings: [],
      errors: [],
      resolved: queued.resolved,
    }),
  ),
  http.post(baseUrl + '/runs', () => HttpResponse.json(queued)),
  http.get(baseUrl + '/runs/:id/frames/:n/values', ({ request }) => {
    const axis = new URL(request.url).searchParams.get('axis');
    const nx = axis === 'x' ? 6 : 8;
    const ny = axis === 'z' ? 6 : 4;
    return new HttpResponse(new Float32Array(nx * ny).fill(0.5).buffer, {
      headers: { 'X-Nx': String(nx), 'X-Ny': String(ny) },
    });
  }),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('ImageData', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

async function launch() {
  fireEvent.click(screen.getByRole('button', { name: /Rising plume/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Run simulation' }));
  await screen.findByText('queued', { exact: true });
}

it('polls queued and running runs until completion', async () => {
  const status = vi
    .fn()
    .mockReturnValueOnce(queued)
    .mockReturnValueOnce(running)
    .mockReturnValue(done);
  server.use(http.get(baseUrl + '/runs/:id', () => HttpResponse.json(status())));
  render(<Workspace />);
  await screen.findByText('Engine online');
  await launch();
  expect(screen.getByText(/Queue position 2/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Download MP4' })).toBeDisabled();
  expect(status).not.toHaveBeenCalled();
  await screen.findByText('running', { exact: true }, { timeout: 6000 });
  expect(status).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('progressbar', { name: 'Run progress' })).toHaveValue(2);
  await screen.findByText('done', { exact: true });
  expect(screen.getByRole('button', { name: 'Download MP4' })).toBeEnabled();
  expect(status).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole('button', { name: 'Back to setup' }));
  expect(screen.getByRole('heading', { name: 'Configuration' })).toBeVisible();
}, 8000);

it('retries a failed status request and displays the engine diagnostic for a failed run', async () => {
  const status = vi
    .fn()
    .mockReturnValueOnce(
      HttpResponse.json({ detail: 'Status temporarily unavailable' }, { status: 503 }),
    )
    .mockReturnValueOnce(HttpResponse.json(running))
    .mockReturnValueOnce(
      HttpResponse.json({ ...running, status: 'error', message: 'Solver diverged' }),
    );
  server.use(http.get(baseUrl + '/runs/:id', () => status()));
  render(<Workspace />);
  await screen.findByText('Engine online');
  await launch();
  expect(
    await screen.findByText(/Status temporarily unavailable/, {}, { timeout: 4000 }),
  ).toBeVisible();
  expect(status).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry status' }));
  await screen.findByText('running', { exact: true }, { timeout: 4000 });
  expect(await screen.findByRole('alert')).toHaveTextContent('Solver diverged');
  expect(screen.getByRole('button', { name: 'Back to setup' })).toBeEnabled();
}, 8000);

it('cancels the active run, aborting its pending poll and ignoring the delayed response', async () => {
  const pending = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<AbortSignal>();
  const cancel = vi.fn();
  server.use(
    http.get(baseUrl + '/runs/:id', async ({ request }) => {
      requested.resolve(request.signal);
      await pending.promise;
      return HttpResponse.json(done);
    }),
    http.delete(baseUrl + '/runs/:id', ({ params }) => {
      cancel(params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  render(<Workspace />);
  try {
    await screen.findByText('Engine online');
    await launch();
    const signal = await requested.promise;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }));
    await screen.findByRole('heading', { name: 'Configuration' });
    expect(cancel).toHaveBeenCalledWith(queued.id);
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve());
    expect(
      screen.queryByRole('heading', { name: 'Run inspector' }),
    ).not.toBeInTheDocument();
  } finally {
    pending.resolve();
  }
});

it('reviews warnings before submission and switches a completed 3D run between views', async () => {
  const submit = vi.fn();
  const requests: string[] = [];
  server.use(
    http.post(baseUrl + '/runs/validate', () =>
      HttpResponse.json({
        ok: true,
        warnings: ['Large output'],
        errors: [],
        resolved: done.resolved,
      }),
    ),
    http.post(baseUrl + '/runs', async ({ request }) => {
      submit(await request.json());
      return HttpResponse.json(done);
    }),
    http.get(baseUrl + '/runs/:id/frames/:n/values', ({ request }) => {
      requests.push(new URL(request.url).search);
      return new HttpResponse(new Float32Array(4).buffer, {
        headers: { 'X-Nx': '2', 'X-Ny': '2' },
      });
    }),
  );
  render(<Workspace />);
  await screen.findByText('Engine online');
  fireEvent.click(screen.getByRole('button', { name: /Rising plume/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
  expect(screen.getByLabelText('Layers nz')).toHaveValue(40);
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  expect(await screen.findByText('Large output')).toBeVisible();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Run with warnings' }));
  await screen.findByRole('img', { name: 'Simulation frame 1' });
  expect(submit).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining<Partial<RequestBody>>({
      source: { kind: 'preset', preset: 'gaussian_hotspot', nx: 40, ny: 40, nz: 40 },
    }),
  );
  fireEvent.change(screen.getByLabelText('Axis'), { target: { value: 'x' } });
  await screen.findByRole('img', { name: 'Simulation frame 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Projection' }));
  await screen.findByRole('img', { name: 'Simulation frame 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
  expect(await screen.findByText(/WebGL2 is unavailable/)).toBeVisible();
  expect(screen.getByText(/Use graphics acceleration when available/)).toBeVisible();
  expect(screen.getByText(/X max projection for PNG/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Slice' }));
  await screen.findByRole('img', { name: 'Simulation frame 1' });
  expect(requests).toEqual([
    '?stride=1&axis=z&slice=2',
    '?stride=1&axis=x&slice=4',
    '?stride=1&axis=x&projection=max',
    '?stride=1&axis=x&slice=4',
  ]);
});

it('keeps the newer history run selected when an older cancellation finishes', async () => {
  const cancellation = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const other = simulation({ id: 'simulation-b', frames: 0, step: 7 });
  server.use(
    http.get(baseUrl + '/runs', () =>
      HttpResponse.json({
        items: [other],
        total: 1,
        total_bytes: 1024,
        next_cursor: null,
      }),
    ),
    http.delete(baseUrl + '/runs/:id', async () => {
      started.resolve();
      await cancellation.promise;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  // Hold the DELETE response without mocking the workspace state.
  const fetch = globalThis.fetch;
  const finished = Promise.withResolvers<void>();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
    const response = await fetch(...args);
    if (args[0] instanceof Request && args[0].method === 'DELETE') finished.resolve();
    return response;
  });
  render(<Workspace />);
  try {
    await screen.findByText('Engine online');
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }));
    await started.promise;
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View' }));
    expect(screen.getByRole('progressbar', { name: 'Run progress' })).toHaveValue(7);
    await act(async () => {
      cancellation.resolve();
      await finished.promise;
    });
    expect(screen.getByRole('progressbar', { name: 'Run progress' })).toHaveValue(7);
  } finally {
    cancellation.resolve();
  }
});

it('reconnects and validates a drawing before starting, reusing an unchanged saved field', async () => {
  const connection = vi
    .fn()
    .mockReturnValueOnce(HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }))
    .mockImplementation(() => HttpResponse.json(config));
  const validate = vi
    .fn()
    .mockReturnValueOnce(
      HttpResponse.json({
        ok: false,
        warnings: [],
        errors: [{ loc: ['body', 'dt'], msg: 'Time step exceeds limit' }],
        resolved: null,
      }),
    )
    .mockImplementation(() =>
      HttpResponse.json({
        ok: true,
        warnings: [],
        errors: [],
        resolved: done.resolved,
      }),
    );
  const save = vi.fn(() => HttpResponse.json(field));
  server.use(
    http.get(baseUrl + '/config', connection),
    http.post(baseUrl + '/fields/drawn', save),
    http.post(baseUrl + '/runs/validate', validate),
    http.post(baseUrl + '/runs', () => HttpResponse.json(done)),
  );
  render(<Workspace />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
  await screen.findByText('Engine online');
  fireEvent.click(screen.getByRole('button', { name: 'Switch to 3D solver' }));
  fireEvent.change(screen.getByLabelText('Extrude to N layers'), {
    target: { value: '4' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'body.dt — Time step exceeds limit',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  await screen.findByRole('heading', { name: 'Run inspector' });
  expect(save).toHaveBeenCalledTimes(1);
  expect(validate).toHaveBeenCalledTimes(2);
});

it('uploads and previews a field, configures its volume, then loads a filled plane into the drawing canvas', async () => {
  const revoke = vi.fn();
  let previews = 0;
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:plane-' + ++previews;
      static revokeObjectURL = revoke;
    },
  );
  const statsRequests: URLSearchParams[] = [];
  server.use(
    http.post(baseUrl + '/fields', () => HttpResponse.json(field)),
    http.get(baseUrl + '/fields/:id/stats', ({ request }) => {
      statsRequests.push(new URL(request.url).searchParams);
      return HttpResponse.json(field.default_stats);
    }),
    http.get(baseUrl + '/fields/:id/preview.png', () => new HttpResponse('image')),
    http.get(
      baseUrl + '/fields/:id/values',
      () =>
        new HttpResponse(new Float32Array([2, NaN, 4, 3]).buffer, {
          headers: { 'X-Nx': '2', 'X-Ny': '2' },
        }),
    ),
  );
  render(<Workspace />);
  await screen.findByText('Engine online');
  fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));
  const launch = screen.getByRole('button', { name: 'Run simulation' });
  expect(launch).toBeDisabled();
  fireEvent.drop(screen.getByLabelText('Upload NetCDF file').closest('label')!, {
    dataTransfer: { files: [new File(['input'], 'measurements.nc')] },
  });
  expect(
    await screen.findByRole('img', { name: 'Selected NetCDF plane preview' }),
  ).toHaveAttribute('src', 'blob:plane-1');
  expect(screen.getByLabelText('Missing-cell fill value')).toHaveValue(3);
  fireEvent.change(screen.getByLabelText('level index'), { target: { value: '1' } });
  await screen.findByText('1 missing cells · mean 3');
  expect(statsRequests.at(-1)?.get('index[level]')).toBe('1');
  fireEvent.change(screen.getByLabelText(/time index/), { target: { value: '1' } });
  await screen.findByText('1 missing cells · mean 3');
  expect(statsRequests.at(-1)?.get('index[time]')).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: /Use as volume/ }));
  await screen.findByText('Preview plane · 1 missing cells · mean 3');
  expect(statsRequests.at(-1)?.has('index[level]')).toBe(false);
  expect(screen.queryByLabelText('level index')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
  expect(screen.getByLabelText('Layers nz')).toHaveValue(2);
  expect(screen.getByLabelText('Layers nz')).toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button', { name: 'Initial field' }));
  fireEvent.click(screen.getByRole('button', { name: /Use as volume/ }));
  await screen.findByText('1 missing cells · mean 3');
  fireEvent.change(screen.getByLabelText('Missing-cell fill value'), {
    target: { value: '' },
  });
  expect(launch).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Load into canvas' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Missing-cell fill value'), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load into canvas' }));
  expect(
    await screen.findByRole('button', { name: 'Draw field', pressed: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Columns')).toHaveValue(4);
  expect(screen.getByLabelText('Rows')).toHaveValue(4);
  expect(revoke).toHaveBeenCalledWith('blob:plane-1');
});

it('uses retained default statistics to launch an archived field without requesting a preview', async () => {
  const archived = { ...field, state: 'archived' };
  const submit = vi.fn();
  server.use(
    http.get(baseUrl + '/runs', () =>
      HttpResponse.json({ items: [], total: 0, total_bytes: 0, next_cursor: null }),
    ),
    http.get(baseUrl + '/fields', () =>
      HttpResponse.json({
        items: [archived],
        total: 1,
        total_bytes: 1024,
        next_cursor: null,
      }),
    ),
    http.get(baseUrl + '/fields/:id/stats', () =>
      HttpResponse.json({ detail: 'Archived' }, { status: 409 }),
    ),
    http.post(baseUrl + '/runs', async ({ request }) => {
      submit(await request.json());
      return HttpResponse.json(done);
    }),
  );
  render(<Workspace />);
  await screen.findByText('Engine online');
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fields' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Use field' }));
  expect(screen.getByText('Archived · preview unavailable')).toBeVisible();
  await screen.findByText('1 missing cells · mean 3');
  expect(
    screen.queryByRole('button', { name: 'Load into canvas' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  await screen.findByRole('heading', { name: 'Run inspector' });
  expect(submit).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      source: { kind: 'field', field_id: field.id, var: 'u', index: {}, fill_value: 3 },
    }),
  );
});

it('reads health independently and sends the same named request with units and automatic ranks to both endpoints', async () => {
  const bodies: RequestBody[] = [];
  server.use(
    http.post(baseUrl + '/runs/validate', async ({ request }) => {
      bodies.push((await request.json()) as RequestBody);
      return HttpResponse.json({
        ok: true,
        warnings: ['Review size'],
        errors: [],
        resolved: { ...done.resolved, processes: 3 },
      });
    }),
    http.post(baseUrl + '/runs', async ({ request }) => {
      bodies.push((await request.json()) as RequestBody);
      return HttpResponse.json({
        ...done,
        name: 'Morning wind',
        resolved: { ...done.resolved, processes: 3 },
      });
    }),
  );
  render(<Workspace />);
  await screen.findByText('API v1.4.7');
  expect(screen.getByLabelText('Columns')).toBeVisible();
  expect(screen.getByLabelText('Rows')).toBeVisible();
  expect(screen.queryByLabelText('Extrude to N layers')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to 3D solver' }));
  expect(screen.getByLabelText('Extrude to N layers')).toHaveValue(16);
  fireEvent.click(screen.getByRole('button', { name: 'Switch to 2D solver' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByLabelText('Extrude to N layers')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
  fireEvent.change(screen.getByLabelText('Unit system'), { target: { value: 'm' } });
  expect(screen.getByText(/200 s simulated/)).toBeVisible();
  expect(screen.queryByLabelText(/MPI processes/)).toBeNull();
  fireEvent.change(screen.getByLabelText('Run name (optional)'), {
    target: { value: '  Morning wind  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  await screen.findByText('Server selected 3 MPI processes.');
  fireEvent.click(screen.getByRole('button', { name: 'Run with warnings' }));
  await screen.findByRole('heading', { name: 'Run inspector' });
  expect(screen.getByText('Morning wind')).toBeVisible();
  expect(screen.getByText(/· 3 MPI processes/)).toBeVisible();
  expect(bodies).toHaveLength(3);
  for (const body of bodies) {
    expect(body).toEqual(bodies[0]);
    expect(body).toMatchObject({
      name: 'Morning wind',
      units: { length: 'm', time: 's' },
    });
    expect(body).not.toHaveProperty('processes');
  }
});

it('hides an unavailable API version while configuration stays usable', async () => {
  server.use(
    http.get(baseUrl + '/health', () => new HttpResponse(null, { status: 503 })),
  );
  render(<Workspace />);
  await screen.findByText('Engine online');
  expect(screen.queryByText(/API v/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Run simulation' })).toBeEnabled();
});
