import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Map,
  Ruler,
  UserRound,
} from 'lucide-react';
import { navigate, type SettingsSection } from '@/lib/navigation';
import {
  clearLocalData,
  storeMapKey,
  storeUnitSystem,
  unitLabels,
  useMapKey,
  useUnitSystem,
  type UnitSystem,
} from '@/lib/settings';
import './settings.css';

const sections = {
  maps: { label: 'Maps', Icon: Map },
  units: { label: 'Units', Icon: Ruler },
  data: { label: 'Data in this browser', Icon: Database },
  account: { label: 'Account', Icon: UserRound },
};

function MapPreferences() {
  const mapKey = useMapKey();
  const [edit, setEdit] = useState<{ saved: string; value: string }>();
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const draft = edit?.saved === mapKey ? edit.value : mapKey;
  const key = draft.trim();

  function stopTest() {
    pending.current?.abort();
    setTesting(false);
  }

  function save(value: string) {
    stopTest();
    const saved = storeMapKey(value);
    setEdit(undefined);
    setShow(false);
    setNotice(
      saved
        ? value
          ? 'Key saved in this browser.'
          : 'Key removed.'
        : 'Browser storage is unavailable. This change applies to this visit.',
    );
  }

  async function testKey() {
    if (!key || testing) return;
    const ctrl = new AbortController();
    pending.current = ctrl;
    setTesting(true);
    setNotice('Testing key…');
    const url = new URL('https://api.maptiler.com/geocoding/Zurich.json');
    url.searchParams.set('key', key);
    url.searchParams.set('limit', '1');
    let result = 'Could not test the key. Try again in a moment.';
    try {
      const response = await fetch(url, {
        credentials: 'omit',
        redirect: 'error',
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (response.ok) result = 'Valid MapTiler key.';
      else if (response.status === 401 || response.status === 403)
        result = 'Invalid or restricted MapTiler key.';
    } catch {
      // Network failures do not establish whether the key is valid.
    }
    if (!ctrl.signal.aborted) {
      setNotice(result);
      setTesting(false);
    }
  }

  return (
    <>
      <p>
        Add a MapTiler API key to enable maps and place search in Sky.{' '}
        <a href="https://cloud.maptiler.com/" target="_blank" rel="noreferrer">
          Get a free MapTiler key
        </a>
      </p>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (key && key !== mapKey) save(key);
        }}
      >
        <label htmlFor="maptiler-key">MapTiler API key</label>
        <div className="settings-key">
          <input
            id="maptiler-key"
            type={show ? 'text' : 'password'}
            aria-describedby="maptiler-key-privacy"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={draft}
            onChange={(event) => {
              stopTest();
              setEdit({ saved: mapKey, value: event.target.value });
              setNotice('');
            }}
          />
          <button
            className="secondary"
            type="button"
            aria-controls="maptiler-key"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="settings-actions">
          <button className="primary" disabled={!key || key === mapKey}>
            Save
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!key || testing}
            onClick={testKey}
          >
            Test key
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!mapKey}
            onClick={() => save('')}
          >
            Remove
          </button>
        </div>
      </form>
      <p className="hint" id="maptiler-key-privacy">
        Your key is stored only in this browser and sent only to MapTiler. It never goes
        to the Climate Sim backend.
      </p>
      {notice && <p role="status">{notice}</p>}
    </>
  );
}

function UnitPreferences() {
  const units = useUnitSystem();
  const [notice, setNotice] = useState('');
  return (
    <>
      <p>
        Choose the default for new workspaces. You can override it for each run in
        Conditions.
      </p>
      <label className="settings-units">
        Default unit system
        <select
          value={units}
          onChange={(event) => {
            const saved = storeUnitSystem(event.target.value as UnitSystem);
            setNotice(
              saved
                ? 'Default units saved.'
                : 'Browser storage is unavailable. This change applies to this visit.',
            );
          }}
        >
          {Object.entries(unitLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {notice && <p role="status">{notice}</p>}
    </>
  );
}

function BrowserData() {
  const [notice, setNotice] = useState('');
  return (
    <>
      <p>Climate Sim stores these settings in this browser:</p>
      <dl className="settings-data">
        <div>
          <dt>MapTiler key</dt>
          <dd>Used for Sky maps and place search.</dd>
        </div>
        <div>
          <dt>Saved Sky sites</dt>
          <dd>Names, coordinates, and elevations of sites you bookmark.</dd>
        </div>
        <div>
          <dt>Preferences</dt>
          <dd>Your default workspace unit system.</dd>
        </div>
      </dl>
      <div className="settings-actions">
        <button
          className="secondary"
          onClick={() => {
            if (
              !window.confirm(
                'Clear the MapTiler key, saved Sky sites, and preferences in this browser?',
              )
            )
              return;
            setNotice(
              clearLocalData()
                ? 'Local data cleared.'
                : 'Browser storage is unavailable. Changes apply to this visit.',
            );
          }}
        >
          Clear local data
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </>
  );
}

function Account() {
  return (
    <p>
      Accounts are coming in a future release, with sign-in and per-user storage quotas.
    </p>
  );
}

const panels = {
  maps: MapPreferences,
  units: UnitPreferences,
  data: BrowserData,
  account: Account,
};

export function Settings({ section }: { section: SettingsSection }) {
  const { label, Icon } = sections[section];
  const Panel = panels[section];
  return (
    <div className="settings-layout">
      <nav className="panel settings-sections" aria-label="Settings sections">
        {Object.entries(sections).map(([id, { label, Icon }]) => (
          <button
            key={id}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => navigate('settings', id as SettingsSection)}
          >
            <Icon size={17} />
            <span>{label}</span>
            <ChevronRight size={14} className="settings-chevron" />
          </button>
        ))}
      </nav>
      <section
        className="panel settings-panel"
        aria-labelledby="settings-panel-heading"
      >
        <header className="panel-head">
          <h2 id="settings-panel-heading">
            <Icon size={17} />
            {label}
          </h2>
        </header>
        <div className="settings-body">
          <Panel />
        </div>
      </section>
    </div>
  );
}
