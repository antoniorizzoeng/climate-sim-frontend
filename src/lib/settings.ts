import { useMemo, useSyncExternalStore } from 'react';
import { systems } from './model';
import { validCoordinates, validElevation, type SavedSite } from './sky';

export type UnitSystem = keyof typeof systems;
export const unitLabels: Record<UnitSystem, string> = {
  km: 'Kilometres and hours (km + h)',
  m: 'Metres and seconds (m + s)',
  cell: 'Grid units',
};

const keys = {
  map: 'climatesim.sky.mapKey',
  sites: 'climatesim.sky.sites',
  units: 'climatesim.settings.units',
} as const;
type Key = (typeof keys)[keyof typeof keys];

const localChange = 'climatesim:settings-change';
const session = new Map<Key, string | null>();
const empty = () => null;
const defaultUnits = () => 'km' as const;

function read(key: Key) {
  if (session.has(key)) return session.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: Key, value: string | null, useSession = false) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    session.delete(key);
    return true;
  } catch {
    if (useSession) session.set(key, value);
    return false;
  }
}

function notify() {
  window.dispatchEvent(new Event(localChange));
}

function subscribe(update: () => void) {
  function storageChanged(event: StorageEvent) {
    if (event.key === null) session.clear();
    else if (Object.values(keys).some((key) => key === event.key))
      session.delete(event.key as Key);
    else return;
    update();
  }
  window.addEventListener(localChange, update);
  window.addEventListener('storage', storageChanged);
  return () => {
    window.removeEventListener(localChange, update);
    window.removeEventListener('storage', storageChanged);
  };
}

export function loadMapKey() {
  return read(keys.map)?.trim() ?? '';
}

export function storeMapKey(value: string) {
  const saved = write(keys.map, value.trim() || null, true);
  notify();
  return saved;
}

const noMapKey = () => '';
export function useMapKey() {
  return useSyncExternalStore(subscribe, loadMapKey, noMapKey);
}

function loadUnitSystem(): UnitSystem {
  const value = read(keys.units);
  return value === 'm' || value === 'cell' ? value : 'km';
}

export function storeUnitSystem(value: UnitSystem) {
  const saved = write(keys.units, value, true);
  notify();
  return saved;
}

export function useUnitSystem() {
  return useSyncExternalStore(subscribe, loadUnitSystem, defaultUnits);
}

function parseSites(raw: string | null): SavedSite[] {
  try {
    const saved: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(saved)
      ? saved.filter(
          (s) =>
            s &&
            typeof s.name === 'string' &&
            s.name.trim() &&
            validCoordinates(s.lat, s.lon) &&
            validElevation(s.elevation_m),
        )
      : [];
  } catch {
    return [];
  }
}

const readSites = () => read(keys.sites);

export function loadSites() {
  return parseSites(readSites());
}

export function storeSites(sites: SavedSite[]) {
  const saved = write(keys.sites, JSON.stringify(sites));
  if (saved) notify();
  return saved;
}

export function useSavedSites() {
  const raw = useSyncExternalStore(subscribe, readSites, empty);
  return useMemo(() => parseSites(raw), [raw]);
}

export function clearLocalData() {
  const results = Object.values(keys).map((key) => write(key, null, true));
  notify();
  return results.every(Boolean);
}
