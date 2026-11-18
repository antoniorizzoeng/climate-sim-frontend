import { useState, useCallback } from 'react';
import { Crosshair, LocateFixed, Play, BookmarkPlus } from 'lucide-react';
import {
  elevationLimits,
  loadSites,
  reachesPole,
  skyDefaults,
  storeSites,
  validCoordinates,
  validElevation,
  type Nowcast,
  type NowcastParams,
  type SavedSite,
} from '@/lib/sky';

import { MapSettings } from './MapSettings';
import { formatElevation } from './ObserverCloud';
export function SitePicker({
  busy,
  run,
  mapKey = '',
  onKey,
  siteElevation,
}: {
  busy: boolean;
  mapKey?: string;
  onKey?: (s: string) => void;
  siteElevation?: Nowcast['site_elevation'];
  run: (params: NowcastParams) => void;
}) {
  const [lat, setLat] = useState(''),
    [lon, setLon] = useState(''),
    [elevation, setElevation] = useState(''),
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
    setElevation('');
    setName('');
    setNotice('');
  }, []);
  const coordinatesValid = lat !== '' && lon !== '' && validCoordinates(+lat, +lon);
  const elevationValue = elevation === '' ? null : +elevation;
  const elevationValid = validElevation(elevationValue);
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
        choose(coords.latitude, coords.longitude);
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
    const site = {
      name: name.trim(),
      lat: +lat,
      lon: +lon,
      elevation_m: elevationValue,
    };
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
          if (coordinatesValid && elevationValid && !polar)
            run({
              lat: +lat,
              lon: +lon,
              elevation_m: elevationValue,
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
                  elevationValue === (s.elevation_m ?? null) &&
                  name === s.name
                }
                onClick={() => {
                  choose(s.lat, s.lon);
                  setName(s.name);
                  setElevation(s.elevation_m == null ? '' : String(s.elevation_m));
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
        <label>
          Elevation (m)
          <input
            type="number"
            step="any"
            {...elevationLimits}
            placeholder="Auto from terrain model"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
          />
        </label>
        {siteElevation && (
          <p className="hint" role="status">
            Nowcast used {formatElevation(siteElevation.elevation_m)} ·{' '}
            {siteElevation.source === 'user' ? 'entered' : 'from Open-Meteo terrain'}
          </p>
        )}
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
          {process.env.NEXT_PUBLIC_DEMO_BASE_PATH
            ? 'Demo nowcasts use simulated weather and keep site coordinates in the browser.'
            : 'Running or refreshing sends the site and surrounding grid coordinates to Open-Meteo through the backend.'}{' '}
          With a map key, place searches and map tiles go directly to MapTiler with your
          key.
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
              disabled={!name.trim() || !coordinatesValid || !elevationValid}
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
