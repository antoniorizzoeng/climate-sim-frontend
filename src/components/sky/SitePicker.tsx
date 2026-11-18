import { useState, useCallback } from 'react';
import { Crosshair, LocateFixed, Play, BookmarkPlus } from 'lucide-react';
import {
  loadSites,
  reachesPole,
  skyDefaults,
  storeSites,
  validCoordinates,
  type NowcastParams,
  type SavedSite,
} from '@/lib/sky';

import { MapSettings } from './MapSettings';
export function SitePicker({
  busy,
  run,
  mapKey = '',
  onKey,
}: {
  busy: boolean;
  mapKey?: string;
  onKey?: (s: string) => void;
  run: (params: NowcastParams) => void;
}) {
  const [lat, setLat] = useState(''),
    [lon, setLon] = useState(''),
    [name, setName] = useState('');
  const [radius, setRadius] = useState(String(skyDefaults.radius_km)),
    [hours, setHours] = useState(String(skyDefaults.hours)),
    [resolution, setResolution] = useState(String(skyDefaults.resolution));
  const [sites, setSites] = useState<SavedSite[]>(loadSites),
    [notice, setNotice] = useState(''),
    [locating, setLocating] = useState(false);
  const [windowMode, setWindowMode] = useState<'tonight' | 'now'>('tonight');
  const choose = useCallback((lat: number, lon: number) => {
    setLat(String(lat));
    setLon(String(lon));
    setName('');
    setNotice('');
  }, []);
  const coordinatesValid = lat !== '' && lon !== '' && validCoordinates(+lat, +lon);
  const polar = lat !== '' && reachesPole(+lat, +radius);
  function locate() {
    if (!navigator.geolocation) {
      setNotice('Location is unavailable. Enter coordinates manually.');
      return;
    }
    setLocating(true);
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(String(coords.latitude));
        setLon(String(coords.longitude));
        setName('');
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setNotice(error.message || 'Location unavailable. Enter coordinates manually.');
      },
      { timeout: 15000 },
    );
  }
  function save() {
    const site = { name: name.trim(), lat: +lat, lon: +lon };
    const next = [...loadSites().filter((s) => s.name !== site.name), site];
    if (storeSites(next)) {
      setSites(next);
      setNotice('Site saved on this device.');
    } else
      setNotice('This browser could not save the site. You can still run a nowcast.');
  }
  return (
    <section className="panel sky-picker">
      <header className="panel-head">
        <h2>
          <Crosshair size={17} />
          Observing site
        </h2>
      </header>
      {onKey && (
        <MapSettings
          mapKey={mapKey}
          onKey={onKey}
          lat={coordinatesValid ? +lat : null}
          lon={coordinatesValid ? +lon : null}
          choose={choose}
        />
      )}
      <form
        className="sky-body control-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (coordinatesValid && !polar)
            run({
              lat: +lat,
              lon: +lon,
              radius_km: +radius,
              window: windowMode,
              ...(windowMode === 'now' && { hours: +hours }),
              resolution: +resolution,
            });
        }}
      >
        {sites.length > 0 && (
          <div className="sky-sites" role="group" aria-label="Saved sites">
            {sites.map((s) => (
              <button
                className="secondary"
                type="button"
                key={s.name}
                aria-pressed={
                  coordinatesValid &&
                  +lat === s.lat &&
                  +lon === s.lon &&
                  name === s.name
                }
                onClick={() => {
                  choose(s.lat, s.lon);
                  setName(s.name);
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="input-grid">
          <label>
            Latitude (°)
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="−90 to 90"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </label>
          <label>
            Longitude (°)
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="−180 to 180"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={locating}
          onClick={locate}
        >
          <LocateFixed size={15} />
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        <p className="hint">
          Running or refreshing sends the site and surrounding grid coordinates to
          Open-Meteo through the backend. With a map key, place searches and map tiles
          go directly to MapTiler with your key.
        </p>
        <div>
          <h3>Save this site</h3>
          <div className="sky-save">
            <label>
              Site name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!name.trim() || !coordinatesValid}
              onClick={save}
            >
              <BookmarkPlus size={15} />
              Save
            </button>
          </div>
        </div>
        {notice && (
          <p role="status" className="hint">
            {notice}
          </p>
        )}
        <label>
          Forecast window
          <select
            value={windowMode}
            onChange={(e) => setWindowMode(e.target.value as 'tonight' | 'now')}
          >
            <option value="tonight">Tonight</option>
            <option value="now">Next hours</option>
          </select>
        </label>
        <div className="sky-settings">
          <label>
            Radius (km)
            <input
              type="number"
              step="any"
              min="50"
              max="1000"
              required
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </label>
          {windowMode === 'now' && (
            <label>
              Hours
              <input
                type="number"
                min="1"
                max="12"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
          )}
          <label>
            Cells per side
            <input
              type="number"
              min="16"
              max="256"
              required
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </label>
        </div>
        {polar && (
          <p role="alert" className="error">
            The grid must stay short of the poles. Adjust latitude or radius.
          </p>
        )}
        <button className="primary" disabled={busy || polar}>
          <Play size={15} />
          Run nowcast
        </button>
      </form>
    </section>
  );
}
