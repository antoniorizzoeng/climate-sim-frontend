import type { components } from './schema';

export type Nowcast = components['schemas']['Nowcast'];
export type NowcastParams = Nowcast['params'];
export type SiteSample = NonNullable<Nowcast['site']>[number];
export type SavedSite = Pick<NowcastParams, 'lat' | 'lon'> & { name: string };
export const skyDefaults = { radius_km: 300, hours: 6, resolution: 96 };
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

const siteKey = 'climatesim.sky.sites';
export function loadSites(): SavedSite[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(siteKey) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter(
          (s) =>
            s &&
            typeof s.name === 'string' &&
            s.name.trim() &&
            validCoordinates(s.lat, s.lon),
        )
      : [];
  } catch {
    return [];
  }
}
export function storeSites(sites: SavedSite[]) {
  try {
    window.localStorage.setItem(siteKey, JSON.stringify(sites));
    return true;
  } catch {
    return false;
  }
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
export function bestWindow(site: SiteSample[]) {
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

export function seeingHours(site: SiteSample[]) {
  const hour = (s: SiteSample) => Math.floor(Date.parse(s.time) / 3_600_000);
  return site.filter((s, i) => !i || hour(s) !== hour(site[i - 1]));
}
