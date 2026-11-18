import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Sky } from '@/components/sky/Sky';
import { baseUrl } from '@/lib/api';
import { simulation } from './fixtures/simulation';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyChart } from '@/components/sky/SkyChart';
import { SitePicker } from '@/components/sky/SitePicker';
import {
  bestWindow,
  clockTime,
  seeingHours,
  type Nowcast,
  type SiteSample,
} from '@/lib/sky';
import { createNowcast } from '@/mocks/nowcasts';

const start = Date.parse('2026-01-01T23:30:00Z');
function sample(
  minutes: number,
  clear = 0.7,
  seeing: SiteSample['seeing'] = 'fair',
): SiteSample {
  return {
    time: new Date(start + minutes * 60_000).toISOString(),
    nowcast: { clear, total: 1 - clear, low: 0.25, mid: 0.5, high: 0.75 },
    blend: { clear: 0.75, total: 0.25, low: 0.5, mid: 0.25, high: 0.125 },
    model: { clear: 0.5, total: 0.5, low: 0.5, mid: 0.5, high: 0.5 },
    seeing,
    jet_ms: 25.05,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it('chooses the earliest longest qualifying window, breaking at gaps and poor seeing', () => {
  const timeline = [
    sample(0),
    sample(10),
    sample(20, 0.9, 'poor'),
    sample(30, 0.69),
    sample(40),
    sample(60),
    sample(70),
    sample(80, 0.8, 'good'),
    sample(100),
    sample(110),
    sample(120),
  ];
  expect(bestWindow(timeline)).toEqual({ start: 5, end: 7 });
  expect(bestWindow([sample(0), sample(20)])).toBeUndefined();
  expect(bestWindow([])).toBeUndefined();
  expect(seeingHours(timeline).map(({ time }) => time)).toEqual(
    [timeline[0], timeline[3], timeline[8]].map(({ time }) => time),
  );
  expect(clockTime(timeline[0].time, 'UTC')).toBe('23:30');
});

it('plots explicit server windows using matching instants and presents blended table values', () => {
  const record = createNowcast({ lat: 42, lon: 12 });
  const site = [sample(0, 1), sample(10, 0.5), sample(20, 0)];
  render(
    <SkyChart
      record={{
        ...record,
        site,
        best_window: {
          start: '2026-01-02T00:40:00+01:00',
          end: site[2].time,
          mean_clear: 0.75,
          seeing: 'fair',
        },
      }}
    />,
  );
  const chart = screen.getByRole('img', { name: /Clear-sky percentage/ });
  expect(chart.querySelector('.nowcast-line')).toHaveAttribute(
    'points',
    '0,0 500,50 1000,100',
  );
  expect(chart.querySelector('.blend-line')).toHaveAttribute(
    'points',
    '0,25 500,25 1000,25',
  );
  expect(chart.querySelector('rect')).toHaveAttribute('x', '500');
  expect(chart.querySelector('rect')).toHaveAttribute('width', '500');
  fireEvent.click(screen.getByText(/Ten-minute site samples ·/));
  const table = screen.getByRole('table');
  expect(
    within(table).getByRole('columnheader', { name: 'Blend clear' }),
  ).toBeVisible();
  expect(
    within(within(table).getAllByRole('row')[1])
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['75%', '100%', '50%', '50%', '25%', '13%', 'fair', (25.05).toFixed(1)]);
  expect(
    within(screen.getByRole('group', { name: 'Hourly seeing' })).getAllByRole('img'),
  ).toHaveLength(1);
});

it('uses nowcast cover consistently for legacy samples and respects an explicit null best window', () => {
  const record = createNowcast({ lat: 42, lon: 12 });
  const first = sample(0, 1);
  const { blend, ...legacy } = sample(10);
  expect(blend.low).toBe(0.5);
  const site = [first, legacy];
  const view = render(
    <SkyChart record={{ ...record, site, best_window: undefined }} />,
  );
  const chart = screen.getByRole('img', { name: /Clear-sky percentage/ });
  expect(chart.querySelector('rect')).toHaveAttribute('width', '1000');
  expect(chart.querySelector('.blend-line')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Nowcast cloud cover' })).toBeVisible();
  fireEvent.click(screen.getByText(/Ten-minute site samples ·/));
  const table = within(screen.getByRole('table'));
  expect(
    table.queryByRole('columnheader', { name: 'Blend clear' }),
  ).not.toBeInTheDocument();
  expect(
    within(table.getAllByRole('row')[1]).getAllByRole('cell')[2],
  ).toHaveTextContent('25%');
  view.rerender(<SkyChart record={{ ...record, site, best_window: null }} />);
  expect(screen.getByText('No qualifying stretch')).toBeVisible();
  expect(chart.querySelector('rect')).toBeNull();
});

it('keeps nowcasting available when saved sites cannot be read or written', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  const run = vi.fn();
  render(<SitePicker busy={false} run={run} />);
  expect(screen.queryByLabelText('Saved sites')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Latitude (°)'), { target: { value: '42' } });
  fireEvent.change(screen.getByLabelText('Longitude (°)'), { target: { value: '12' } });
  fireEvent.click(screen.getByText('Save this site'));
  fireEvent.change(screen.getByLabelText('Site name'), {
    target: { value: 'Observatory' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'This browser could not save the site.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Run nowcast' }));
  expect(run).toHaveBeenCalledExactlyOnceWith({
    lat: 42,
    lon: 12,
    radius_km: 300,
    hours: 6,
    resolution: 96,
  });
});

it('persists a named site and restores its coordinates on a fresh visit', () => {
  const run = vi.fn();
  const view = render(<SitePicker busy={false} run={run} />);
  fireEvent.change(screen.getByLabelText('Latitude (°)'), { target: { value: '-23' } });
  fireEvent.change(screen.getByLabelText('Longitude (°)'), { target: { value: '15' } });
  fireEvent.click(screen.getByText('Save this site'));
  fireEvent.change(screen.getByLabelText('Site name'), {
    target: { value: '  Dark site  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('status')).toHaveTextContent('Site saved');
  view.unmount();
  render(<SitePicker busy={false} run={run} />);
  fireEvent.change(screen.getByLabelText('Saved sites'), {
    target: { value: 'Dark site' },
  });
  expect(screen.getByLabelText('Latitude (°)')).toHaveValue(-23);
  expect(screen.getByLabelText('Longitude (°)')).toHaveValue(15);
});

it('recovers a missing layer and plays the three cloud movies on the same clock', async () => {
  const initial = createNowcast({ lat: 42, lon: 12 });
  const site = [sample(0), sample(10), sample(20)];
  const record: Nowcast = {
    ...initial,
    status: 'done',
    data_time: site[0].time,
    site,
    layers: [
      { layer: 'low', pressure_hpa: 850, run_id: 'low-run' },
      { layer: 'mid', pressure_hpa: 500, run_id: 'mid-run' },
      { layer: 'high', pressure_hpa: 300, run_id: 'high-run' },
    ],
  };
  let available = true;
  const high = vi
    .fn()
    .mockReturnValueOnce(
      HttpResponse.json({ detail: 'High layer unavailable' }, { status: 503 }),
    )
    .mockImplementation(() =>
      HttpResponse.json(simulation({ id: 'high-run', frames: 2 })),
    );
  const submit = vi.fn();
  const refresh = vi.fn();
  const server = setupServer(
    http.post(baseUrl + '/nowcasts', async ({ request }) => {
      submit(await request.json());
      return HttpResponse.json(initial, { status: 202 });
    }),
    http.get(baseUrl + '/nowcasts', () =>
      HttpResponse.json({ items: available ? [record] : [], next_cursor: null }),
    ),
    http.get(baseUrl + '/nowcasts/' + record.id, () => HttpResponse.json(record)),
    http.post(baseUrl + '/nowcasts/' + record.id + '/refresh', () => {
      refresh();
      return HttpResponse.json(
        { detail: 'Forecast service unavailable' },
        { status: 503 },
      );
    }),
    http.delete(baseUrl + '/nowcasts/' + record.id, () => {
      available = false;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(baseUrl + '/runs/:id', ({ params }) =>
      params.id === 'high-run'
        ? high()
        : HttpResponse.json(simulation({ id: String(params.id), frames: 3 })),
    ),
    http.get(
      baseUrl + '/runs/:id/frames/:n/values',
      () =>
        new HttpResponse(new Float32Array(4).buffer, {
          headers: { 'X-Nx': '2', 'X-Ny': '2' },
        }),
    ),
  );
  server.listen({ onUnhandledFrame: 'error' });
  vi.stubGlobal('ImageData', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  try {
    render(<Sky online />);
    fireEvent.change(screen.getByLabelText('Latitude (°)'), {
      target: { value: '42' },
    });
    fireEvent.change(screen.getByLabelText('Longitude (°)'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run nowcast' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'High layer unavailable',
    );
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ lat: 42, lon: 12 }));
    expect(
      screen.queryByRole('heading', { name: 'Layer movies' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry status' }));
    await screen.findByRole('img', { name: 'high cloud cover · frame 1' });
    for (const layer of ['low', 'mid'])
      await screen.findByRole('img', { name: layer + ' cloud cover · frame 1' });
    const clock = screen.getByLabelText('Frame scrubber');
    expect(clock).toHaveAttribute('aria-valuetext', clockTime(site[0].time));
    expect(clock).toHaveAttribute('max', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    for (const layer of ['low', 'mid', 'high'])
      await screen.findByRole('img', { name: layer + ' cloud cover · frame 2' });
    expect(clock).toHaveAttribute('aria-valuetext', clockTime(site[1].time));
    expect(screen.getByRole('button', { name: 'Next frame' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh nowcast' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Forecast service unavailable',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep nowcast' }));
    expect(
      screen.queryByRole('button', { name: 'Confirm delete' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await screen.findByText('No recent nowcasts.');
    expect(
      screen.queryByRole('heading', { name: 'Layer movies' }),
    ).not.toBeInTheDocument();
  } finally {
    server.close();
    vi.unstubAllGlobals();
  }
});
