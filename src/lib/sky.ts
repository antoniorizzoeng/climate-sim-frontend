import type { components } from './schema';

export type Nowcast = components['schemas']['Nowcast'];
export type NowcastParams = Nowcast['params'];
export type SiteSample = NonNullable<Nowcast['site']>[number];
export type SavedSite = Pick<NowcastParams, 'lat' | 'lon' | 'elevation_m'> & {
  name: string;
};
export const skyDefaults = { radius_km: 300, hours: 6, resolution: 96 };
export const elevationLimits = { min: -500, max: 9000 };
export const defaultBlendTauHours = 2;
export const layerNames = ['low', 'mid', 'high'] as const;
export const tenMinutes = 600_000;

export function validCoordinates(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180
  );
}

export function reachesPole(lat: number, radiusKm: number) {
  return Math.abs(lat) + (radiusKm / 6371) * (180 / Math.PI) >= 90;
}

export function validElevation(elevation: number | null | undefined) {
  return (
    elevation == null ||
    (Number.isFinite(elevation) &&
      elevation >= elevationLimits.min &&
      elevation <= elevationLimits.max)
  );
}

const clockOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const clock = new Intl.DateTimeFormat(undefined, clockOptions);
const stamp = new Intl.DateTimeFormat(undefined, {
  ...clockOptions,
  month: 'short',
  day: 'numeric',
  timeZoneName: 'short',
});

export function clockTime(iso: string, timeZone?: string) {
  const formatter = timeZone
    ? new Intl.DateTimeFormat(undefined, { ...clockOptions, timeZone })
    : clock;
  return formatter.format(new Date(iso));
}
export function localStamp(iso: string) {
  return stamp.format(new Date(iso));
}

// A window spans qualifying sample endpoints. Do not extrapolate beyond the last frame.
export function bestWindow(site: Pick<SiteSample, 'time' | 'nowcast' | 'seeing'>[]) {
  let best: { start: number; end: number } | undefined;
  let start = -1;
  site.forEach((sample, i) => {
    if (sample.nowcast.clear < 0.7 || sample.seeing === 'poor') {
      start = -1;
      return;
    }
    if (
      start < 0 ||
      Date.parse(sample.time) - Date.parse(site[i - 1].time) !== tenMinutes
    )
      start = i;
    if (i > start && (!best || i - start > best.end - best.start))
      best = { start, end: i };
  });
  return best;
}

export function seeingHours<T extends Pick<SiteSample, 'time'>>(site: T[]) {
  const hour = (s: T) => Math.floor(Date.parse(s.time) / 3_600_000);
  return site.filter((s, i) => !i || hour(s) !== hour(site[i - 1]));
}

// lat0/lon0 locate a cell centre. MapLibre expects the outer image corners,
// clockwise from the northwest. Keep longitudes continuous at the date line.
export function gridCorners(
  grid: Nowcast['grid'],
): [[number, number], [number, number], [number, number], [number, number]] {
  const deg = 180 / (Math.PI * 6371000);
  const dy = grid.dy_m * deg;
  const midLat = grid.lat0 + (dy * (grid.ny - 1)) / 2;
  const dx = (grid.dx_m * deg) / Math.cos((midLat * Math.PI) / 180);
  const west = grid.lon0 - dx / 2,
    south = grid.lat0 - dy / 2;
  const east = west + grid.nx * dx,
    north = south + grid.ny * dy;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}
