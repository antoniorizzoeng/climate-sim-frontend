import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, afterAll, beforeAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Timeline } from '@/components/Timeline';
import { PlayerImage } from '@/components/Player';
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
it('prefetches written frames and requests just the hovered bottom-left cell', async () => {
  const frames: number[] = [],
    queries: URLSearchParams[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:frame');
  URL.revokeObjectURL = vi.fn();
  server.use(
    http.get(baseUrl + '/runs/:id/frames/:n.png', ({ params }) => {
      frames.push(Number(params.n));
      return new HttpResponse(new Uint8Array([0]));
    }),
    http.get(baseUrl + '/runs/:id/frames/:n/values', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return new HttpResponse(new Float32Array([12.5]).buffer, {
        headers: { 'X-Nx': '1', 'X-Ny': '1', 'X-I0': '0', 'X-J0': '0' },
      });
    }),
  );
  const read = vi.fn();
  render(
    <PlayerImage run={run} n={0} colors={{ colormap: 'inferno' }} onRead={read} />,
  );
  const img = await screen.findByAltText('Simulation frame 1');
  await waitFor(() => expect(frames).toEqual([0, 1]));
  vi.spyOn(img, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 80, 60));
  fireEvent.pointerMove(img, { clientX: 2, clientY: 59 });
  await waitFor(() => expect(queries).toHaveLength(1));
  expect(Object.fromEntries(queries[0])).toEqual({ i0: '0', j0: '0', w: '1', h: '1' });
  await waitFor(() => expect(read).toHaveBeenCalledWith('x 0 · y 0 · u 12.50'));
});
