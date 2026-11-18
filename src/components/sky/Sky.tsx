import { useEffect, useState } from 'react';
import { Activity, BookOpen, Clock3, RefreshCw, Trash2 } from 'lucide-react';
import { api, checked, message } from '@/lib/api';
import type { Run } from '@/lib/model';
import {
  loadMapKey,
  layerNames,
  localStamp,
  type Nowcast,
  type NowcastParams,
} from '@/lib/sky';
import { SitePicker } from './SitePicker';
import { SkyChart } from './SkyChart';
import { SkyGrid } from './SkyGrid';
import { LayerMovies } from './LayerMovies';
import './sky.css';
import './forecast.css';

const stages = ['fetching', 'queued', 'running', 'done'] as const;
function terminal(record: Nowcast) {
  return record.status === 'done' || record.status === 'error';
}

function Method({ record }: { record?: Nowcast }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>
          <BookOpen size={17} />
          Method &amp; limits
        </h2>
      </header>
      <div className="sky-body sky-method">
        {process.env.NEXT_PUBLIC_DEMO_BASE_PATH ? (
          <p>
            The demo generates sample cloud cover, winds and seeing in your browser.
          </p>
        ) : (
          <>
            <p>
              Open-Meteo supplies initial cloud cover and hourly winds. Three runs carry
              low, mid and high clouds across a local grid at 850, 500 and 300 hPa.
              Cover at the site is sampled between cells and combined using random
              overlap.
            </p>
            <p>
              Cloud formation, dissipation and vertical motion are omitted. The grid
              edges have zero gradient. Confidence is highest in the first few hours,
              before air from beyond the grid reaches the site. The Open-Meteo line uses
              its own total cover, interpolated between forecast hours.
            </p>
            <p>
              At first, the blend relies on clouds carried by the wind. As time goes on,
              it gives more weight to the Open-Meteo forecast.
            </p>
            <p>
              Seeing is a rough guide from 250 hPa wind alone. Below 20 m/s is good,
              20–35 m/s is fair, and above 35 m/s is poor.
            </p>
            <div className="data-time">
              <span>Initial cloud data</span>
              <strong>
                {record?.data_time ? localStamp(record.data_time) : 'Awaiting data'}
              </strong>
            </div>
            <small>
              Valid hour from Open-Meteo. Best-match data can combine model cycles.
            </small>
          </>
        )}
      </div>
    </section>
  );
}

export function Sky({ online }: { online: boolean }) {
  const [recent, setRecent] = useState<Nowcast[]>([]),
    [selected, setSelected] = useState<Nowcast>();
  const [runs, setRuns] = useState<Run[]>([]),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState(''),
    [listError, setListError] = useState(''),
    [pollError, setPollError] = useState('');
  const [listVersion, reloadList] = useState(0),
    [attempt, retry] = useState(0);
  const [mapKey, setMapKey] = useState(loadMapKey);
  const id = selected?.id;
  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .GET('/nowcasts', { params: { query: { limit: 10 } }, signal: ctrl.signal })
      .then(checked)
      .then((page) => {
        if (!ctrl.signal.aborted) {
          setRecent(page.items);
          setListError('');
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setListError(message(e));
      });
    return () => ctrl.abort();
  }, [online, listVersion]);

  useEffect(() => {
    if (!id || !online) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const record = checked(
          await api.GET('/nowcasts/{id}', {
            params: { path: { id: id! } },
            signal: ctrl.signal,
          }),
        );
        if (ctrl.signal.aborted) return;
        setSelected(record);
        setRecent((items) =>
          items.map((item) => (item.id === record.id ? record : item)),
        );
        const children = await Promise.allSettled(
          record.layers.map(async (layer) =>
            checked(
              await api.GET('/runs/{runId}', {
                params: { path: { runId: layer.run_id } },
                signal: ctrl.signal,
              }),
            ),
          ),
        );
        if (ctrl.signal.aborted) return;
        setRuns(
          children.flatMap((child) =>
            child.status === 'fulfilled' ? [child.value] : [],
          ),
        );
        const failure = children.find((child) => child.status === 'rejected');
        setPollError(failure?.status === 'rejected' ? message(failure.reason) : '');
        if (!terminal(record)) timer = setTimeout(poll, 1000);
      } catch (e) {
        if (!ctrl.signal.aborted) setPollError(message(e));
      }
    }
    void poll();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [id, online, attempt]);
  function select(record?: Nowcast) {
    setRuns([]);
    setSelected(record);
    setConfirm(false);
    setActionError('');
    setPollError('');
    retry((v) => v + 1);
  }
  async function submit(params?: NowcastParams) {
    if (busy || (!params && !id)) return;
    setBusy(true);
    setActionError('');
    try {
      const record = params
        ? checked(await api.POST('/nowcasts', { body: params }))
        : checked(
            await api.POST('/nowcasts/{id}/refresh', { params: { path: { id: id! } } }),
          );
      select(record);
      reloadList((v) => v + 1);
    } catch (e) {
      setActionError(
        /no astronomical (night|darkness)/i.test(message(e))
          ? 'No astronomical darkness at this site in the next 24 hours. Choose Next hours or another site.'
          : message(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!id || busy) return;
    setBusy(true);
    try {
      checked(await api.DELETE('/nowcasts/{id}', { params: { path: { id } } }));
      select();
      setRecent((items) => items.filter((item) => item.id !== id));
      reloadList((v) => v + 1);
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const statusPanel = selected && (
    <section className="panel sky-status">
      <header className="panel-head">
        <h2>
          <Activity size={16} />
          Nowcast status
        </h2>
        <span className="mode-tag" role="status">
          {selected.status}
        </span>
      </header>
      <div className="sky-body">
        <div className="sky-record">
          <strong>
            {selected.params.lat.toFixed(4)}°, {selected.params.lon.toFixed(4)}°
          </strong>
          <small>Created {localStamp(selected.created_at)}</small>
        </div>
        <div className="sky-stages" aria-label="Nowcast stages">
          {stages.map((stage) => (
            <span
              key={stage}
              aria-current={stage === selected.status ? 'step' : undefined}
            >
              {stage}
            </span>
          ))}
        </div>
        {selected.message && (
          <p role="alert" className="error">
            {selected.message}
          </p>
        )}
        <div className="layer-progress">
          {layerNames.map((name) => {
            const layer = selected.layers.find((l) => l.layer === name),
              run = runs.find((r) => r.id === layer?.run_id);
            return (
              <div key={name}>
                <strong>{name}</strong>
                <small>
                  {run?.status ?? (terminal(selected) ? 'Unavailable' : 'Waiting')}
                </small>
                <progress
                  aria-label={name + ' layer progress'}
                  max={run?.resolved.steps ?? 1}
                  value={run?.step ?? 0}
                />
                {run?.message && <small className="error">{run.message}</small>}
              </div>
            );
          })}
        </div>
        {pollError && (
          <p className="error" role="alert">
            {pollError}{' '}
            <button className="secondary" onClick={() => retry((v) => v + 1)}>
              Retry status
            </button>
          </p>
        )}
        <div className="sky-actions">
          <button className="secondary" disabled={busy} onClick={() => submit()}>
            <RefreshCw size={14} />
            Refresh nowcast
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
        {confirm && (
          <div className="sky-delete">
            <p>Delete this nowcast and its three layer runs?</p>
            <div className="sky-actions">
              <button className="secondary" disabled={busy} onClick={remove}>
                Confirm delete
              </button>
              <button className="secondary" onClick={() => setConfirm(false)}>
                Keep nowcast
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
  return (
    <div className="sky-layout">
      <div className="sky-picker-slot">
        <SitePicker
          mapKey={mapKey}
          onKey={setMapKey}
          busy={busy || !online}
          run={submit}
        />
      </div>
      <div className="sky-results">
        {actionError && (
          <p role="alert" className="notice error">
            {actionError}
          </p>
        )}
        {!selected?.site && statusPanel}
        <SkyChart record={selected} />
        {selected && (
          <LayerMovies
            mapKey={mapKey}
            key={JSON.stringify([selected.id, mapKey])}
            record={selected}
            runs={runs}
          />
        )}
        {selected?.site && statusPanel}
        <Method record={selected} />
      </div>
      <aside className="sky-side">
        {selected && <SkyGrid grid={selected.grid} />}
        <section className="panel">
          <header className="panel-head">
            <h2>
              <Clock3 size={17} />
              Recent nowcasts
            </h2>
          </header>
          {listError && (
            <p className="sky-body error" role="alert">
              {listError}{' '}
              <button onClick={() => reloadList((v) => v + 1)}>Retry list</button>
            </p>
          )}
          {recent.length ? (
            <ul className="sky-recent">
              {recent.map((item) => (
                <li key={item.id}>
                  <button
                    disabled={busy}
                    aria-current={id === item.id ? 'true' : undefined}
                    onClick={() => select(item)}
                  >
                    <strong>
                      {item.params.lat.toFixed(3)}°, {item.params.lon.toFixed(3)}°
                    </strong>
                    <span>{item.status}</span>
                    <small>
                      {localStamp(item.created_at)} ·{' '}
                      {item.params.window === 'tonight'
                        ? 'Tonight'
                        : (item.params.hours ?? 6) + ' h'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !listError && <p className="sky-body hint">No recent nowcasts.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
