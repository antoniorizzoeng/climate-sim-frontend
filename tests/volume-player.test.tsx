import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import VolumePlayer from '@/components/VolumePlayer';
import { baseUrl, decodeVolume } from '@/lib/api';
import { encodePlane, type Volume } from '@/lib/model';
import { createVolumeScene } from '@/lib/volumeScene';
import { simulation } from './fixtures/simulation';

vi.mock('@/lib/volumeScene', () => ({ createVolumeScene: vi.fn() }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.resetAllMocks();
});
afterAll(() => server.close());

it('rejects fractional or out-of-bounds volume dimensions even with a matching byte count', () => {
  for (const nx of ['0.5', '129']) {
    const buffer = new ArrayBuffer(Number(nx) * 2 * 4);
    const headers = new Headers({ 'X-Nx': nx, 'X-Ny': '2', 'X-Nz': '1' });
    expect(() => decodeVolume(buffer, headers)).toThrow(
      'Invalid float32 volume dimensions',
    );
  }
});

it('decodes and prefetches one volume frame, retries failed loads, and disposes the scene', async () => {
  const scene = { appearance: vi.fn(), frame: vi.fn(), dispose: vi.fn() };
  vi.mocked(createVolumeScene).mockReturnValue(scene);
  const requests: [number, string | null][] = [];
  let failed = false;
  server.use(
    http.get(baseUrl + '/runs/:id/frames/:n/volume', ({ request, params }) => {
      const index = Number(params.n);
      requests.push([index, new URL(request.url).searchParams.get('max_side')]);
      if (index === 0 && !failed) {
        failed = true;
        return new HttpResponse(new ArrayBuffer(4), {
          headers: { 'X-Nx': '2', 'X-Ny': '1', 'X-Nz': '2' },
        });
      }
      return new HttpResponse(encodePlane(Float32Array.of(-1.25, 0.5, index, 3.5)), {
        headers: { 'X-Nx': '2', 'X-Ny': '1', 'X-Nz': '2' },
      });
    }),
  );
  const onPresent = vi.fn();
  const run = simulation({ frames: 3 });
  const props = {
    run,
    colors: { colormap: 'gray' as const },
    range: [-2, 4],
    onPresent,
  };
  const view = render(<VolumePlayer n={0} {...props} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading volume');
  expect(await screen.findByText(/Invalid float32 volume dimensions/)).toBeVisible();
  expect(scene.frame).not.toHaveBeenCalled();
  expect(requests).toEqual([
    [0, '96'],
    [1, '96'],
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Retry frame' }));
  await screen.findByText('Volume frame 1');
  expect(scene.frame).toHaveBeenCalledExactlyOnceWith<[Volume]>({
    nx: 2,
    ny: 1,
    nz: 2,
    data: Float32Array.of(-1.25, 0.5, 0, 3.5),
  });
  fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '0.5' } });
  fireEvent.change(screen.getByLabelText('Threshold'), { target: { value: '0.1' } });
  expect(scene.appearance).toHaveBeenLastCalledWith('gray', -2, 4, 0.5, 0.1);
  view.rerender(<VolumePlayer n={1} {...props} />);
  await screen.findByText('Volume frame 2');
  expect(requests).toEqual([
    [0, '96'],
    [1, '96'],
    [0, '96'],
    [2, '96'],
  ]);
  expect(onPresent.mock.calls.map(([n]) => n)).toEqual([0, 1]);
  const host = vi.mocked(createVolumeScene).mock.calls[0][0];
  const lost = new Event('webglcontextlost', { cancelable: true });
  fireEvent(host, lost);
  expect(lost.defaultPrevented).toBe(true);
  expect(screen.getByRole('status')).toHaveTextContent('WebGL2 context lost');
  expect(screen.queryByLabelText('Opacity')).not.toBeInTheDocument();
  view.unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});
