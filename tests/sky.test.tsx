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
import { SeeingStrip } from '@/components/sky/SkyChart';
import { SitePicker } from '@/components/sky/SitePicker';

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
    JSON.stringify([null, {}, { ...observatory, lat: 91 }, observatory]),
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
    hours: 6,
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
