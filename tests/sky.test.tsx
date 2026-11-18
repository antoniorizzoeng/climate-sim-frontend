import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  bestWindow,
  clockTime,
  loadSites,
  storeSites,
  tenMinutes,
  type SiteSample,
} from '@/lib/sky';
import { SeeingStrip, SkyChart } from '@/components/sky/SkyChart';
import { SitePicker } from '@/components/sky/SitePicker';
import { createNowcast } from '@/mocks/nowcasts';

const observatory = { name: 'Roque de los Muchachos', lat: 28.76, lon: -17.89 };
const initial = Date.parse('2026-11-17T23:00:00Z');
function sample(
  index: number,
  clear = 0.7,
  seeing: SiteSample['seeing'] = 'fair',
  jet_ms = 20,
): SiteSample {
  const cover = { low: 1 - clear, mid: 0, high: 0, total: 1 - clear, clear };
  return {
    time: new Date(initial + index * tenMinutes).toISOString(),
    nowcast: cover,
    model: cover,
    blend: cover,
    seeing,
    jet_ms,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('finds the longest contiguous qualifying stretch across midnight, including the final sample', () => {
  const points = Array.from({ length: 11 }, (_, i) => sample(i));
  points[2] = sample(2, 0.69);
  points[5] = sample(5, 0.95, 'poor', 36);
  expect(bestWindow(points)).toEqual({ start: 6, end: 10 });
  expect(bestWindow(points.slice(0, 6))).toEqual({ start: 0, end: 1 });
});
it('requires two adjacent qualifying samples and does not bridge gaps', () => {
  expect(bestWindow([])).toBeUndefined();
  expect(bestWindow([sample(0, 0.8), sample(2, 0.9)])).toBeUndefined();
  expect(
    bestWindow([sample(0, 0.69), sample(1), sample(2, 0.98, 'poor')]),
  ).toBeUndefined();
});

function forecast() {
  const record = createNowcast({
    lat: observatory.lat,
    lon: observatory.lon,
    blend_tau_hours: 3,
  });
  const site = [0, 1, 2, 3].map((i) => ({
    ...sample(i, 0.8),
    blend: sample(i, i === 1 || i === 2 ? 0.75 : 0.5).blend,
  }));
  return {
    ...record,
    status: 'done' as const,
    site,
    best_window: {
      start: site[1].time,
      end: site[2].time,
      mean_clear: 0.75,
      seeing: 'fair' as const,
    },
  };
}

it('plots the blend and uses blended layers in the bands and sample table', () => {
  const { container } = render(<SkyChart record={forecast()} />);
  expect(screen.getByText('Blend (recommended)')).toBeVisible();
  expect(
    screen.getByText('Blend = wind transport at short range, model later (τ = 3 h)'),
  ).toBeVisible();
  const blendLine = container.querySelector('polyline.blend-line');
  expect(
    blendLine
      ?.getAttribute('points')
      ?.split(' ')
      .map((p) => p.split(',')[1]),
  ).toEqual(['50', '25', '25', '50']);
  expect(
    container.querySelector('.cover-bands polygon')?.getAttribute('points'),
  ).toContain('0,50');
  fireEvent.click(screen.getByText(/Ten-minute site samples/));
  expect(screen.getByRole('columnheader', { name: 'Blend clear' })).toBeVisible();
  const secondSample = screen.getAllByRole('row')[2];
  const cells = within(secondSample).getAllByRole('cell');
  expect(cells[0]).toHaveTextContent('75%');
  expect(cells[1]).toHaveTextContent('80%');
  expect(cells[3]).toHaveTextContent('25%');
});

it('explains ignored and partial layers, dims their raw cover, and hides elevation annotations for legacy results', () => {
  const record = forecast();
  const mountain = {
    elevation_m: 4205,
    source: 'user' as const,
    layer_weights: { low: 0, mid: 0.25, high: 1 },
  };
  const { container, rerender } = render(
    <SkyChart record={{ ...record, site_elevation: mountain }} />,
  );
  expect(
    screen.getByText(
      /Counting cloud above.*low cloud below the site ignored.*25% of mid cloud counted.*high cloud fully counted/,
    ),
  ).toBeVisible();
  expect(screen.getByText('below site')).toBeVisible();
  expect(screen.getByText('below site · 25% counted')).toBeVisible();
  expect(container.querySelectorAll('.cover-bands .below-site')).toHaveLength(2);
  const rawLow = container
    .querySelector('.cover-bands polygon')
    ?.getAttribute('points');

  rerender(
    <SkyChart
      record={{
        ...record,
        site_elevation: {
          ...mountain,
          elevation_m: 0,
          layer_weights: { low: 1, mid: 1, high: 1 },
        },
      }}
    />,
  );
  expect(
    screen.getByText('Counting cloud above 0 m · all layers counted'),
  ).toBeVisible();
  expect(container.querySelector('.cover-bands .layer-weight')).toBeNull();

  rerender(<SkyChart record={{ ...record, site_elevation: null }} />);
  expect(screen.queryByText(/Counting cloud above/)).toBeNull();
  expect(container.querySelector('.cover-bands .layer-weight')).toBeNull();
  expect(container.querySelector('.cover-bands polygon')).toHaveAttribute(
    'points',
    rawLow,
  );
});

it('uses the server window for the label and highlight, including an explicit null', () => {
  const data = forecast();
  const record = {
    ...data,
    night: { dusk: data.site[0].time, dawn: data.site.at(-1)!.time, moon: [] },
  };
  const { container, rerender } = render(<SkyChart record={record} />);
  const { start, end } = record.best_window;
  expect(screen.getByText(clockTime(start) + ' – ' + clockTime(end))).toBeVisible();
  const highlight = container.querySelector('.window-highlight');
  expect(Number(highlight?.getAttribute('x'))).toBeCloseTo(1000 / 3);
  expect(Number(highlight?.getAttribute('width'))).toBeCloseTo(1000 / 3);
  rerender(<SkyChart record={{ ...record, best_window: null }} />);
  expect(screen.getByText('No qualifying stretch')).toBeVisible();
  expect(container.querySelector('.window-highlight')).toBeNull();
});

it('falls back to transport data and the client window for an older response', () => {
  const record = createNowcast({ lat: observatory.lat, lon: observatory.lon });
  const site = [0, 1].map((i) => {
    const { time, nowcast, model, seeing, jet_ms } = sample(i, 0.8);
    return { time, nowcast, model, seeing, jet_ms };
  });
  const { id, created_at, params, grid, expires_at, message, layers } = record;
  render(
    <SkyChart
      record={{
        id,
        created_at,
        params,
        grid,
        expires_at,
        message,
        layers,
        data_time: site[0].time,
        status: 'done',
        site,
      }}
    />,
  );
  expect(screen.queryByText('Blend (recommended)')).toBeNull();
  expect(screen.getByText('Nowcast cloud cover')).toBeVisible();
  expect(
    screen.getByText(clockTime(site[0].time) + ' – ' + clockTime(site[1].time)),
  ).toBeVisible();
});
it('renders an hourly seeing chip with words and wind speed, including the final hour', () => {
  const rows = [
    sample(0, 0.7, 'good', 19.9),
    sample(1, 0.85, 'good', 19.9),
    sample(6, 0.7, 'fair', 20),
    sample(12, 0.5, 'fair', 35),
    sample(18, 0.5, 'poor', 35.1),
  ];
  render(<SeeingStrip site={rows} />);
  const strip = within(screen.getByLabelText('Hourly seeing'));
  expect(strip.getAllByText('good')).toHaveLength(1);
  expect(strip.getAllByText('fair')).toHaveLength(2);
  expect(strip.getByText('poor')).toBeVisible();
  expect(strip.getByLabelText(/poor.*35.1 m\/s/)).toHaveAttribute('tabindex', '0');
});
it('shows browser-local clock times, including fractional UTC offsets and daylight saving', () => {
  const iso = '2026-07-17T23:10:00Z';
  expect(clockTime(iso, 'Atlantic/Canary')).toBe('00:10');
  expect(clockTime(iso, 'Asia/Kathmandu')).toBe('04:55');
  expect(clockTime(iso)).toBe(
    clockTime(iso, Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
});
it('round-trips saved sites and skips malformed entries', () => {
  expect(storeSites([observatory])).toBe(true);
  expect(loadSites()).toEqual([observatory]);
  const key = localStorage.key(0)!;
  localStorage.setItem(
    key,
    JSON.stringify([
      null,
      {},
      { ...observatory, lat: 91 },
      { ...observatory, elevation_m: '1200' },
      observatory,
    ]),
  );
  expect(loadSites()).toEqual([observatory]);
  localStorage.setItem(key, '{');
  expect(loadSites()).toEqual([]);
});
it('keeps the picker usable when access to localStorage throws', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('Storage disabled');
  });
  expect(loadSites()).toEqual([]);
  expect(storeSites([observatory])).toBe(false);
});
it('handles quota errors during writes', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(storeSites([observatory])).toBe(false);
});
it('only requests geolocation on click and sends coordinates only on Run', () => {
  const getCurrentPosition = vi.fn((done: PositionCallback) =>
    done({
      coords: { latitude: observatory.lat, longitude: observatory.lon },
    } as GeolocationPosition),
  );
  vi.stubGlobal(
    'navigator',
    Object.assign(Object.create(navigator), { geolocation: { getCurrentPosition } }),
  );
  const run = vi.fn();
  render(<SitePicker busy={false} run={run} />);
  expect(screen.getByLabelText('Latitude (°)')).toHaveValue(null);
  expect(screen.getByLabelText('Longitude (°)')).toHaveValue(null);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  expect(
    screen.getByText(/coordinates to Open-Meteo through the backend/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Latitude (°)')).toHaveValue(observatory.lat);
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Run nowcast' }));
  expect(run).toHaveBeenCalledWith({
    lat: observatory.lat,
    lon: observatory.lon,
    elevation_m: null,
    window: 'tonight',
    radius_km: 300,
    resolution: 96,
  });
});
it('prevents running a grid that crosses a pole', () => {
  render(<SitePicker busy={false} run={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Latitude (°)'), {
    target: { value: '89.9' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('poles');
  expect(screen.getByRole('button', { name: 'Run nowcast' })).toBeDisabled();
});

it('shades dusk to dawn, marks twilight, plots the Moon and clips the best window to dark samples', () => {
  const record = forecast();
  const site = record.site;
  const night = {
    dusk: site[1].time,
    dawn: site[2].time,
    moon: [
      { time: site[1].time, altitude_deg: -45, illumination: 0.32 },
      { time: site[2].time, altitude_deg: 45, illumination: 0.32 },
    ],
  };
  const { container, rerender } = render(
    <SkyChart
      record={{
        ...record,
        night,
        best_window: { ...record.best_window, start: site[0].time, end: site[3].time },
      }}
    />,
  );
  expect(
    screen.getByText(clockTime(night.dusk) + ' – ' + clockTime(night.dawn)),
  ).toBeVisible();
  expect(
    Number(container.querySelector('.night-band')?.getAttribute('width')),
  ).toBeCloseTo(1000 / 3);
  expect(
    screen
      .getByRole('img', { name: /Clear-sky percentage/ })
      .querySelectorAll('.twilight-marker'),
  ).toHaveLength(2);
  expect(screen.getByText(/32% illuminated/)).toBeVisible();
  expect(
    container.querySelector('.moon-plot polyline')?.getAttribute('points'),
  ).toMatch(/,75 .*?,25$/);
  rerender(
    <SkyChart
      record={{
        ...record,
        night,
        best_window: { ...record.best_window, start: site[0].time, end: site[0].time },
      }}
    />,
  );
  expect(screen.getByText('No qualifying stretch')).toBeVisible();
  rerender(<SkyChart record={{ ...record, night: null }} />);
  expect(screen.queryByText('Moon altitude')).toBeNull();
  expect(
    screen.getByText(clockTime(site[1].time) + ' – ' + clockTime(site[2].time)),
  ).toBeVisible();
});

it('flips seeing help below a chip at the viewport top and moves it above when space permits', () => {
  render(<SeeingStrip site={[sample(0)]} />);
  const chip = screen.getByRole('img');
  const rect = vi
    .spyOn(chip, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(8, 1, 65, 32));
  fireEvent.focus(chip);
  expect(screen.getByRole('tooltip')).toHaveStyle({ top: '37px' });
  rect.mockReturnValue(new DOMRect(8, 100, 65, 32));
  vi.spyOn(screen.getByRole('tooltip'), 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 150, 25),
  );
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole('tooltip')).toHaveStyle({ top: '71px' });
  fireEvent.keyDown(chip, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('offers the hours control and submits its horizon for Next hours', () => {
  const run = vi.fn();
  render(<SitePicker busy={false} run={run} />);
  expect(screen.getByLabelText('Forecast window')).toHaveValue('tonight');
  expect(screen.queryByLabelText('Hours')).toBeNull();
  fireEvent.change(screen.getByLabelText('Forecast window'), {
    target: { value: 'now' },
  });
  fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Latitude (°)'), { target: { value: '48' } });
  fireEvent.change(screen.getByLabelText('Longitude (°)'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run nowcast' }));
  expect(run).toHaveBeenCalledWith(
    expect.objectContaining({ window: 'now', hours: 4 }),
  );
});
