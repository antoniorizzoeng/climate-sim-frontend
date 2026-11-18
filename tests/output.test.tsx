import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Output } from '@/components/Output';
import { baseUrl } from '@/lib/api';
import { config } from '@/mocks/store';
import { simulation } from './fixtures/simulation';

const run = simulation();
const server = setupServer();
const createUrl = vi.fn(() => 'blob:export');
const revokeUrl = vi.fn();
const downloads: string[] = [];
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  downloads.length = 0;
  createUrl.mockClear();
  revokeUrl.mockClear();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  server.resetHandlers();
});
afterAll(() => server.close());

function output(status = run.status) {
  const change = vi.fn();
  const view = render(
    <Output
      run={{ ...run, status }}
      n={2}
      colors={{ colormap: 'inferno' }}
      change={change}
      config={config}
      view={{ axis: 'y', projection: 'mean' }}
      volume
    />,
  );
  return { ...view, change };
}

it('polls a queued GIF export after Retry-After and downloads only the finished file', async () => {
  const queries: URLSearchParams[] = [];
  const times: number[] = [];
  server.use(
    http.get(baseUrl + '/runs/:id/export.gif', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      times.push(performance.now());
      return queries.length === 1
        ? HttpResponse.json(
            { progress: 0.416 },
            { status: 202, headers: { 'Retry-After': '1' } },
          )
        : new HttpResponse('GIF89a', { headers: { 'Content-Type': 'image/gif' } });
    }),
  );
  output();
  fireEvent.change(screen.getByRole('combobox', { name: 'Animation format' }), {
    target: { value: 'gif' },
  });
  const fps = screen.getByLabelText('Frames per second');
  const button = screen.getByRole('button', { name: 'Download GIF' });
  fireEvent.change(fps, { target: { value: '12.5' } });
  expect(button).toBeDisabled();
  fireEvent.change(fps, { target: { value: '15' } });
  fireEvent.click(button);
  expect(await screen.findByText('Rendering GIF · 42%')).toBeVisible();
  expect(button).toBeDisabled();
  expect(downloads).toEqual([]);
  expect(queries).toHaveLength(1);
  await waitFor(() => expect(downloads).toEqual(['simulation.gif']), { timeout: 6000 });
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(950);
  await waitFor(() => expect(button).toBeEnabled());
  expect(queries.map((query) => Object.fromEntries(query))).toEqual(
    Array.from({ length: 2 }, () => ({
      colormap: 'inferno',
      axis: 'y',
      projection: 'mean',
      fps: '15',
    })),
  );
  await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:export'), {
    timeout: 2000,
  });
});

it('stops pending export polls on unmount', async () => {
  const queued = vi.fn(() =>
    HttpResponse.json(
      { progress: 0 },
      { status: 202, headers: { 'Retry-After': '1' } },
    ),
  );
  server.use(http.get(baseUrl + '/runs/:id/export.mp4', queued));
  const view = output();
  fireEvent.click(screen.getByRole('button', { name: 'Download MP4' }));
  await screen.findByText('Rendering MP4 · 0%');
  view.unmount();
  await delay(1100);
  expect(queued).toHaveBeenCalledTimes(1);
  expect(downloads).toEqual([]);
});

it('shows export failure, then allows downloading the native frame and NetCDF result', async () => {
  const query = vi.fn();
  server.use(
    http.get(baseUrl + '/runs/:id/export.mp4', () =>
      HttpResponse.json({ detail: 'Encoder unavailable' }, { status: 503 }),
    ),
    http.get(baseUrl + '/runs/:id/frames/2.png', ({ request }) => {
      query(Object.fromEntries(new URL(request.url).searchParams));
      return new HttpResponse('image');
    }),
    http.get(baseUrl + '/runs/:id/result.nc', () => new HttpResponse('CDF')),
  );
  output();
  fireEvent.click(screen.getByRole('button', { name: 'Download MP4' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Encoder unavailable');
  expect(screen.getByRole('button', { name: 'Download MP4' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Frame PNG' }));
  await waitFor(() => expect(downloads).toEqual(['frame-2.png']));
  expect(query).toHaveBeenCalledExactlyOnceWith({
    colormap: 'inferno',
    axis: 'y',
    projection: 'mean',
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  const result = screen.getByRole('button', { name: 'Result.nc' });
  await waitFor(() => expect(result).toBeEnabled());
  fireEvent.click(result);
  await waitFor(() => expect(downloads).toEqual(['frame-2.png', 'result.nc']));
  await waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(2), { timeout: 2000 });
});

it('disables expired downloads and keeps invalid color ranges out of requests', () => {
  const { change } = output('expired');
  for (const name of ['Download MP4', 'Frame PNG', 'Result.nc'])
    expect(screen.getByRole('button', { name })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Range minimum'), { target: { value: '2' } });
  expect(screen.getByText('Enter a minimum below the maximum.')).toBeVisible();
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reset to run range' }));
  expect(screen.getByLabelText('Range minimum')).toHaveValue(0);
  fireEvent.change(screen.getByLabelText('Colormap'), { target: { value: 'viridis' } });
  expect(change).toHaveBeenLastCalledWith({ colormap: 'viridis' });
});
