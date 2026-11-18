import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { it, expect, vi, afterEach, afterAll, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SliceChoice } from '@/components/SliceChoice';
import InitialVolume from '@/components/InitialVolume';
import { createVolumeScene } from '@/lib/volumeScene';
import { baseUrl } from '@/lib/api';
import { defaults, makePlane, type PlaneSelection, type Volume } from '@/lib/model';
import { drawingVolume, gaussianSlice, uploadedVolume } from '@/lib/initialVolume';
import { field } from './fixtures/simulation';

vi.mock('@/lib/volumeScene', () => ({ createVolumeScene: vi.fn() }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.resetAllMocks();
});
afterAll(() => server.close());
const props = {
  selection: null,
  model: { ...defaults, nz: 3 },
  gaussian: false,
  map: 'inferno' as const,
  range: [0, 1],
  controls: null,
};
function mockScene() {
  const scene = { frame: vi.fn(), appearance: vi.fn(), dispose: vi.fn() };
  vi.mocked(createVolumeScene).mockReturnValue(scene);
  return scene;
}

it('reuses the orbitable scene while edits update every layer without painting on the preview', () => {
  const scene = mockScene();
  const p = makePlane(4, 4, 'Clear');
  const view = render(<InitialVolume {...props} plane={p} />);
  expect(scene.frame.mock.lastCall?.[0]).toEqual({
    nx: 4,
    ny: 4,
    nz: 3,
    data: new Float32Array(48),
  });
  const changed = { ...p, data: p.data.slice() };
  changed.data[3] = 8;
  view.rerender(<InitialVolume {...props} plane={changed} />);
  const shown = scene.frame.mock.lastCall?.[0] as Volume;
  for (const k of [3, 19, 35]) expect(shown.data[k]).toBe(8);
  expect(createVolumeScene).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Draw initial field')).toBeNull();
  view.unmount();
  expect(scene.dispose).toHaveBeenCalledOnce();
});

it('samples real Gaussian layers and caps large extrusions before allocating', () => {
  const p = makePlane(8, 8, 'Clear'),
    m = { ...defaults, nz: 5 };
  const v = drawingVolume(p, m, true);
  expect(v.data.slice(128, 192)).toEqual(gaussianSlice(8, 8, m, 2).data);
  expect(v.data.slice(0, 64)).not.toEqual(v.data.slice(128, 192));
  expect(
    drawingVolume(makePlane(320, 160), { ...defaults, nz: 1000000 }),
  ).toMatchObject({ nx: 80, ny: 40, nz: 48 });
});

it('strides uploaded planes, samples both end layers in ascending z and preserves nonvertical indices', async () => {
  const variable = {
    ...field.variables[0],
    nx: 192,
    ny: 4,
    nz: 65,
    extra_dims: [
      {
        name: 'level',
        size: 65,
        values: Array.from({ length: 65 }, (_, i) => 100 - i),
      },
    ],
  };
  const selection: PlaneSelection = {
    field: { ...field, variables: [variable] },
    variable: variable.name,
    volume: true,
    index: { time: 2 },
  };
  const levels: number[] = [];
  server.use(
    http.get(baseUrl + '/fields/:id/values', ({ request }) => {
      const q = new URL(request.url).searchParams;
      expect(q.get('stride')).toBe('2');
      expect(q.get('index[time]')).toBe('2');
      const z = Number(q.get('index[level]'));
      levels.push(z);
      return new HttpResponse(new Float32Array(96 * 2).fill(z).buffer, {
        headers: { 'X-Nx': '96', 'X-Ny': '2' },
      });
    }),
  );
  const v = await uploadedVolume(selection, variable, 65, new AbortController().signal);
  expect(v).toMatchObject({ nx: 96, ny: 2, nz: 48 });
  expect(levels).toHaveLength(48);
  expect(v.data[0]).toBe(64);
  expect(v.data.at(-1)).toBe(0);
});

it('aborts an obsolete upload and presents only the new field values and fill', async () => {
  const scene = mockScene(),
    pending = Promise.withResolvers<void>(),
    started = Promise.withResolvers<AbortSignal>();
  const selection = { field, variable: 'u', volume: true, index: {} };
  server.use(
    http.get(baseUrl + '/fields/:id/values', async ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (!q.has('index[time]')) {
        started.resolve(request.signal);
        await pending.promise;
      }
      const z = Number(q.get('index[level]'));
      return new HttpResponse(Float32Array.of(NaN, 5, 6, z).buffer, {
        headers: { 'X-Nx': '2', 'X-Ny': '2' },
      });
    }),
  );
  const view = render(
    <InitialVolume
      {...props}
      model={{ ...defaults, nz: 2 }}
      selection={selection}
      fill={9}
    />,
  );
  try {
    const signal = await started.promise;
    view.rerender(
      <InitialVolume
        {...props}
        model={{ ...defaults, nz: 2 }}
        selection={{ ...selection, index: { time: 1 } }}
        fill={9}
      />,
    );
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(scene.frame).toHaveBeenCalled());
    expect(scene.frame.mock.lastCall?.[0].data).toEqual(
      Float32Array.of(9, 5, 6, 0, 9, 5, 6, 1),
    );
    expect(scene.appearance).toHaveBeenCalledWith('inferno', 0, 9, 0.65, 0.025);
  } finally {
    pending.resolve();
  }
});

it.each([
  ['top', 8],
  ['middle', 4],
  ['bottom', 0],
  ['custom', 6],
] as const)('keeps the requested %s layer', (choice, z) => {
  // jsdom has no native dialog lifecycle. Playwright covers the modal and focus.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const keep = vi.fn();
  render(<SliceChoice layers={9} keep={keep} cancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Slice to keep'), {
    target: { value: choice },
  });
  if (choice === 'custom')
    fireEvent.change(screen.getByLabelText('Layer z'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Keep slice' }));
  expect(keep).toHaveBeenCalledExactlyOnceWith(z);
});
