import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, afterAll, beforeAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Timeline } from '@/components/Timeline';
import { Player } from '@/components/Player';
import { baseUrl } from '@/lib/api';
import { handlers } from '@/mocks/handlers';
import { start, validate } from '@/mocks/store';
import type { RequestBody, Run } from '@/lib/model';
const body: RequestBody = {
  source: { kind: 'preset', preset: 'gaussian_hotspot', nx: 8, ny: 6 },
  steps: 10,
  frames: 4,
  dt: 0.5,
};
const run: Run = {
  ...start(body, validate(body).resolved!),
  status: 'running',
  frames: 2,
};
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
function Transport({ r }: { r: Run }) {
  const [n, set] = useState(0);
  return <Timeline run={r} n={n} setN={set} />;
}
it('limits seeking to written frames and labels the final partial interval', () => {
  const view = render(<Transport r={run} />);
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(screen.getByLabelText('Frame scrubber')).toHaveValue('1');
  view.rerender(<Transport r={{ ...run, status: 'done', frames: 4 }} />);
  fireEvent.change(screen.getByLabelText('Frame scrubber'), { target: { value: '3' } });
  expect(screen.getByLabelText('Frame scrubber')).toHaveAttribute(
    'aria-valuetext',
    'Step 10, time 5',
  );
});
it('plays and pauses with space and ignores arrow shortcuts in controls', async () => {
  render(<Transport r={{ ...run, status: 'running', frames: 4 }} />);
  fireEvent.keyDown(document.body, { code: 'Space' });
  await waitFor(() => expect(screen.getByLabelText('Frame scrubber')).toHaveValue('1'));
  fireEvent.keyDown(document.body, { code: 'Space' });
  expect(screen.getByLabelText('Play')).toBeVisible();
  fireEvent.keyDown(screen.getByLabelText('Playback speed'), { key: 'ArrowRight' });
  expect(screen.getByLabelText('Frame scrubber')).toHaveValue('1');
});
function mockPlanes() {
  const requests: string[] = [];
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(public data: Uint8ClampedArray) {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  server.use(
    http.get(baseUrl + '/runs/:id/frames/:n/values', ({ request, params }) => {
      requests.push(new URL(request.url).search);
      return new HttpResponse(
        new Float32Array(48).fill(12.5 + Number(params.n)).buffer,
        { headers: { 'X-Nx': '8', 'X-Ny': '6' } },
      );
    }),
  );
  return requests;
}

it('decodes written grids ahead and reuses the hovered bottom-left cell and mean', async () => {
  const requests = mockPlanes();
  const read = vi.fn();
  render(
    <Player
      run={run}
      n={0}
      colors={{ colormap: 'inferno' }}
      range={[0, 20]}
      onRead={read}
      readout=""
      onPresent={vi.fn()}
    />,
  );
  const img = await screen.findByRole('img', { name: 'Simulation frame 1' });
  await screen.findByRole('img', { name: 'Field mean over time for 2 loaded frames' });
  vi.spyOn(img, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 80, 60));
  fireEvent.pointerMove(img, { clientX: 2, clientY: 59 });
  expect(read).toHaveBeenCalledWith('x 0 · y 0 · u 12.5');
  expect(requests).toEqual(['?stride=1', '?stride=1']);
  expect(screen.getByText('12.5')).toBeVisible();
});

it('compares frame one with the current frame using the same range and smoothing', async () => {
  const requests = mockPlanes();
  const props = {
    run,
    colors: { colormap: 'inferno' as const },
    range: [0, 20],
    onRead: vi.fn(),
    readout: '',
    onPresent: vi.fn(),
  };
  const view = render(<Player {...props} n={0} />);
  await screen.findByRole('img', { name: 'Field mean over time for 2 loaded frames' });
  fireEvent.click(screen.getByRole('button', { name: 'Compare frames' }));
  view.rerender(<Player {...props} n={1} />);
  const current = await screen.findByRole('img', { name: 'Simulation frame 2' });
  const first = screen.getByRole('img', { name: 'First frame reference' });
  expect(screen.getByText('13.5')).toBeVisible();
  expect(current).toHaveStyle({ imageRendering: 'pixelated' });
  fireEvent.click(screen.getByRole('button', { name: 'Smooth pixels' }));
  for (const canvas of [first, current])
    expect(canvas).toHaveStyle({ imageRendering: 'auto' });
  expect(requests).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Compare frames' }));
  expect(screen.queryByLabelText('First frame reference')).toBeNull();
});

it('holds the last decoded frame during a slow seek and never refetches the pending frame', async () => {
  mockPlanes();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delayed = vi.fn();
  server.use(
    http.get(baseUrl + '/runs/:id/frames/1/values', async () => {
      delayed();
      await pending;
      return new HttpResponse(new Float32Array(48).fill(0.25).buffer, {
        headers: { 'X-Nx': '8', 'X-Ny': '6' },
      });
    }),
  );
  const props = {
    run,
    colors: { colormap: 'inferno' as const },
    range: [0, 1],
    onRead: vi.fn(),
    readout: '',
    onPresent: vi.fn(),
  };
  const view = render(<Player {...props} n={0} />);
  const current = await screen.findByRole('img', { name: 'Simulation frame 1' });
  await waitFor(() => expect(delayed).toHaveBeenCalledTimes(1));
  view.rerender(<Player {...props} n={1} />);
  expect(current).toBeVisible();
  expect(screen.queryByText('Loading frame…')).toBeNull();
  release();
  expect(await screen.findByRole('img', { name: 'Simulation frame 2' })).toBe(current);
  expect(delayed).toHaveBeenCalledTimes(1);
});
