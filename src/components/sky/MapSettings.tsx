import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { storeMapKey, validCoordinates } from '@/lib/sky';

const SiteMap = lazy(() => import('./SiteMap'));
type Place = { id: string; place_name: string; center: [number, number] };

function PlacePicker({
  mapKey,
  lat,
  lon,
  choose,
}: {
  mapKey: string;
  lat: number | null;
  lon: number | null;
  choose: (lat: number, lon: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function search() {
    pending.current?.abort();
    const ctrl = new AbortController();
    pending.current = ctrl;
    setPlaces([]);
    setNotice('Searching…');
    try {
      const url = new URL(
        'https://api.maptiler.com/geocoding/' +
          encodeURIComponent(query.trim()) +
          '.json',
      );
      url.searchParams.set('key', mapKey);
      url.searchParams.set('limit', '5');
      const r = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      const matches = (data.features as Place[]).filter(
        (f) => f.center && validCoordinates(f.center[1], f.center[0]),
      );
      if (!ctrl.signal.aborted) {
        setPlaces(matches);
        setNotice(matches.length ? '' : 'No places found.');
      }
    } catch {
      if (!ctrl.signal.aborted)
        setNotice('Place search unavailable. Check your map key and connection.');
    }
  }
  return (
    <div className="sky-map-settings">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) void search();
        }}
        className="sky-save"
      >
        <label>
          Address or place
          <input
            type="search"
            value={query}
            onChange={(e) => {
              pending.current?.abort();
              setQuery(e.target.value);
              setPlaces([]);
              setNotice('');
            }}
          />
        </label>
        <button className="secondary" disabled={!query.trim()}>
          Search
        </button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {places.length > 0 && (
        <ul>
          {places.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  choose(f.center[1], f.center[0]);
                  setQuery(f.place_name);
                  setPlaces([]);
                }}
              >
                {f.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close map' : 'Choose on map'}
      </button>
      {open && (
        <Suspense fallback={<p>Loading map…</p>}>
          <SiteMap mapKey={mapKey} lat={lat} lon={lon} choose={choose} />
        </Suspense>
      )}
    </div>
  );
}

export function MapSettings({
  mapKey,
  onKey,
  ...site
}: {
  mapKey: string;
  onKey: (value: string) => void;
  lat: number | null;
  lon: number | null;
  choose: (lat: number, lon: number) => void;
}) {
  const [draft, setDraft] = useState(mapKey);
  const [notice, setNotice] = useState('');
  return (
    <div className="sky-map-tools">
      <details>
        <summary>
          Map key{' '}
          <span className="disclosure-hint">{mapKey ? 'Configured' : 'Optional'}</span>
        </summary>
        <form
          className="sky-save"
          onSubmit={(e) => {
            e.preventDefault();
            const key = draft.trim();
            const saved = storeMapKey(key);
            onKey(key);
            setDraft(key);
            setNotice(
              saved
                ? key
                  ? 'Key saved in this browser.'
                  : 'Key removed.'
                : 'Browser storage unavailable. This setting applies to this visit.',
            );
          }}
        >
          <label>
            MapTiler API key
            <input
              type="password"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className="secondary">Apply</button>
        </form>
        {notice && <p role="status">{notice}</p>}
      </details>
      {mapKey && <PlacePicker key={mapKey} mapKey={mapKey} {...site} />}
    </div>
  );
}
