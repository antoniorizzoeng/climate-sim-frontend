'use client';
import dynamic from 'next/dynamic';
import { initialView, frameView, SpatialControls } from '@/components/SpatialControls';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Box,
  ChevronRight,
  CircleDot,
  FlaskConical,
  History as HistoryIcon,
  Layers2,
  LayoutDashboard,
  LoaderCircle,
  Paintbrush,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Telescope,
  UploadCloud,
  Waves,
} from 'lucide-react';
import { api, baseUrl, checked, message, saveDrawing, type Colors } from '@/lib/api';
import {
  colorTable,
  defaults,
  makePlane,
  type Config,
  type Conditions,
  type Field,
  type Plane,
  type PlaneSelection,
  type Run,
  type Source,
  cleanRange,
  withLayers,
} from '@/lib/model';
import { DrawingCanvas, DrawingControls, defaultBrush } from '@/components/Drawing';
import { ConditionsForm, NumberField } from '@/components/Conditions';
import { Viewport } from '@/components/Viewport';
import { Timeline } from '@/components/Timeline';
import { UploadControls, useUploadPlane } from '@/components/Upload';
import { Player } from '@/components/Player';
import { Examples } from '@/components/Examples';
import { examplePlane, exampleConditions, examples } from '@/lib/examples';
import { Output } from '@/components/Output';
import { Sky } from '@/components/sky/Sky';
import { History } from '@/components/History';

const VolumePlayer = dynamic(() => import('@/components/VolumePlayer'), {
  ssr: false,
  loading: () => (
    <div className="panel volume-stage" role="status">
      Loading volume viewer…
    </div>
  ),
});
async function connect() {
  await window.startClimateMock?.();
  return checked(await api.GET('/config'));
}
const mockMode = process.env.NEXT_PUBLIC_MOCK_API === '1';
const emptyColors: Colors = { colormap: 'inferno' };
export default function Workspace() {
  const [config, setConfig] = useState<Config>(),
    [connError, setConnError] = useState(false),
    [attempt, retry] = useState(0);
  const [view, setView] = useState<'workspace' | 'history' | 'sky'>('workspace'),
    [tab, setTab] = useState<'field' | 'conditions'>('field'),
    [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [plane, setPlane] = useState(() => makePlane()),
    [brush, setBrush] = useState(defaultBrush),
    [pattern, setPattern] = useState('Hotspot');
  const [selection, setSelection] = useState<PlaneSelection | null>(null),
    [fillOverride, setFill] = useState<string | null>(null);
  const previewMap = config?.colormaps.includes('inferno')
    ? 'inferno'
    : (config?.colormaps[0] ?? 'inferno');
  const uploaded = useUploadPlane(selection, previewMap),
    stats = uploaded.stats,
    fill = fillOverride ?? (stats?.mean != null ? String(stats.mean) : '');
  const [conditions, setConditions] = useState<Conditions>(defaults),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [warnings, setWarnings] = useState<string[]>([]);
  const saved = useRef<{ plane: Plane; field: Field } | null>(null),
    reviewed = useRef('');
  const [run, setRun] = useState<Run | null>(null),
    [n, setN] = useState(0),
    [colors, setColors] = useState<Colors>(emptyColors),
    [readout, setReadout] = useState(''),
    [pollAttempt, retryPoll] = useState(0);
  const visualColumn = useRef<HTMLDivElement>(null);
  const [spatial, setSpatial] = useState(initialView(1));
  const [preset, setPreset] = useState<'gaussian_hotspot'>();
  const [pollError, setPollError] = useState('');
  const [presented, setPresented] = useState(-1),
    [autoplay, setAutoplay] = useState(false);
  useEffect(() => {
    let active = true;
    connect()
      .then((c) => {
        if (!active) return;
        setConfig(c);
        setConnError(false);
        const first = c.supported_boundary_conditions.includes('dirichlet')
          ? 'dirichlet'
          : c.supported_boundary_conditions[0];
        setConditions((m) => ({
          ...m,
          bc: m.bc ?? { left: first, right: first, top: first, bottom: first },
        }));
      })
      .catch(() => {
        if (active) setConnError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const runId = run?.id,
    status = run?.status;
  useEffect(() => {
    if (runId && window.matchMedia('(max-width: 730px)').matches)
      visualColumn.current?.scrollIntoView({ block: 'start' });
  }, [runId]);
  useEffect(() => {
    if (!runId || !(status === 'queued' || status === 'running')) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = checked(
          await api.GET('/runs/{runId}', {
            params: { path: { runId: runId! } },
            signal: ctrl.signal,
          }),
        );
        if (!ctrl.signal.aborted) {
          setPollError('');
          setRun(r);
          if (r.status === status)
            timer = setTimeout(poll, status === 'queued' ? 2000 : 500);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setPollError(message(e));
      }
    }
    timer = setTimeout(poll, status === 'queued' ? 2000 : 500);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [runId, status, pollAttempt]);
  function clearReview() {
    setError('');
    setWarnings([]);
    reviewed.current = '';
  }
  function select(s: PlaneSelection) {
    if (selection?.volume && !s.volume) setConditions((m) => withLayers(m, 1));
    setSelection(s);
    setFill(null);
    clearReview();
  }
  function inspectRun(r: Run, play = false) {
    setAutoplay(play && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setPresented(-1);
    setRun(r);
    setSpatial(initialView(r.resolved.nz ?? 1));
    setN(0);
    setReadout('');
    setColors({ colormap: previewMap });
    setPollError('');
    clearReview();
  }
  function forget(id: string) {
    if (saved.current?.field.id === id) saved.current = null;
    if (selection?.field.id === id) {
      setSelection(null);
      setFill(null);
    }
    if (run?.id === id) {
      setRun(null);
      setN(0);
      setReadout('');
    }
    clearReview();
  }
  function openField(field: Field) {
    setN(0);
    setReadout('');
    select({ field, variable: field.default_var, index: {} });
    setMode('upload');
    setRun(null);
    setTab('field');
    setView('workspace');
  }
  function edit(p: Plane) {
    setPlane(p);
    setPreset(undefined);
    setPattern('Custom');
    clearReview();
  }
  const isExample = mode === 'draw' && examples.some((e) => e.name === pattern);
  const needFill =
    (!!stats?.missing_count && fill === '') ||
    (fill !== '' && !Number.isFinite(Number(fill)));
  const canStart =
    !!config &&
    !busy &&
    (mode === 'draw' || (!!selection && !needFill && !!uploaded.ready));
  async function launch() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      let source: Source;
      const { nz, ...solver } = conditions;
      if (mode === 'draw' && preset) {
        source = {
          kind: 'preset',
          preset,
          nx: plane.nx,
          ny: plane.ny,
          ...(nz && { nz }),
        };
      } else if (mode === 'draw') {
        const field =
          saved.current?.plane === plane
            ? saved.current.field
            : await saveDrawing(plane, isExample ? pattern : undefined);
        saved.current = { plane, field };
        source = { kind: 'field', field_id: field.id, ...(nz && { replicate_z: nz }) };
      } else {
        if (!selection) return;
        source = {
          kind: 'field',
          field_id: selection.field.id,
          var: selection.variable,
          index: selection.index,
          ...(nz && (selection.volume ? { volume: true } : { replicate_z: nz })),
          ...((stats?.missing_count || !stats || selection.volume) && fill !== ''
            ? { fill_value: Number(fill) }
            : {}),
        };
      }
      const body = { ...solver, source },
        signature = JSON.stringify(body);
      const validation = checked(await api.POST('/runs/validate', { body }));
      setWarnings(validation.warnings);
      if (!validation.ok)
        throw new Error(
          validation.errors.map((i) => i.loc.join('.') + ' — ' + i.msg).join('\n') ||
            'Run validation failed.',
        );
      const ticket = signature + JSON.stringify(validation.warnings);
      if (validation.warnings.length && reviewed.current !== ticket) {
        reviewed.current = ticket;
        return;
      }
      inspectRun(checked(await api.POST('/runs', { body })), isExample);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!run) return;
    setBusy(true);
    try {
      checked(
        await api.DELETE('/runs/{runId}', { params: { path: { runId: run.id } } }),
      );
      setRun(null);
      setN(0);
      setReadout('');
      clearReview();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const variable = selection?.field.variables.find(
      (v) => v.name === selection.variable,
    ),
    inUpload = mode === 'upload' && !run;
  const nx = run?.resolved.nx ?? (inUpload ? (variable?.nx ?? 224) : plane.nx),
    ny = run?.resolved.ny ?? (inUpload ? (variable?.ny ?? 128) : plane.ny);
  const range = run
    ? [
        colors.vmin ?? cleanRange(run.display_range)?.[0] ?? 0,
        colors.vmax ?? cleanRange(run.display_range)?.[1] ?? 1,
      ]
    : inUpload
      ? [stats?.min ?? 0, stats?.max ?? 1]
      : [brush.min, brush.max];
  const fillIndex =
    range[1] === range[0]
      ? 128
      : Math.max(
          0,
          Math.min(
            255,
            Math.round(((Number(fill) - range[0]) / (range[1] - range[0])) * 255),
          ),
        );
  const fillColor = colorTable(previewMap)[fillIndex];
  return (
    <>
      <header className="app-header">
        <div className="shell topbar">
          <a href="#workspace" className="brand" onClick={() => setView('workspace')}>
            <span className="brand-icon">
              <Waves size={25} />
            </span>
            Climate<span>Sim</span>
          </a>
          <nav aria-label="Main navigation">
            <button
              aria-current={view === 'workspace' ? 'page' : undefined}
              className={view === 'workspace' ? 'active' : ''}
              onClick={() => setView('workspace')}
            >
              <LayoutDashboard size={15} />
              Workspace
            </button>
            <button
              aria-current={view === 'history' ? 'page' : undefined}
              className={view === 'history' ? 'active' : ''}
              onClick={() => setView('history')}
            >
              <HistoryIcon size={15} />
              History
            </button>
            <button
              aria-current={view === 'sky' ? 'page' : undefined}
              className={view === 'sky' ? 'active' : ''}
              onClick={() => setView('sky')}
            >
              <Telescope size={15} />
              Sky
            </button>
          </nav>
          <div className="connection">
            <i className={'dot ' + (config ? 'green' : '')} />
            {config
              ? mockMode
                ? 'Mock engine'
                : 'Engine online'
              : connError
                ? mockMode
                  ? 'Demo unavailable'
                  : 'Engine offline'
                : 'Connecting'}
          </div>
        </div>
      </header>
      <main className="shell" id="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="short-line" />
              ADVECTION–DIFFUSION LAB
            </div>
            <h1>
              {view === 'history'
                ? 'Simulation history'
                : view === 'sky'
                  ? 'Observing sky'
                  : 'Simulation workspace'}
            </h1>
            <p>
              {view === 'history'
                ? 'Reopen fields, inspect past runs, and recover archived experiments.'
                : view === 'sky'
                  ? 'Track cloud cover and seeing at your observing site.'
                  : 'Create an initial field, configure the solver, and explore its evolution.'}
            </p>
          </div>
          <span className="solver-tag">
            <Box size={15} />
            {(run ? run.resolved.nz > 1 : !!conditions.nz) && view === 'workspace'
              ? '3D'
              : '2D'}{' '}
            solver
          </span>
        </div>
        {connError && (
          <div className="notice error" role="alert">
            {mockMode ? (
              <>
                <strong>Browser demo unavailable.</strong> Open the demo on localhost or
                HTTPS in a browser that allows service workers, then reconnect.
              </>
            ) : (
              <>
                <strong>Engine offline.</strong> Start the backend with{' '}
                <code>
                  {window.location.origin !== 'http://localhost:3000' &&
                    'CORS_ORIGINS=' + window.location.origin + ' '}
                  docker compose up --build backend
                </code>{' '}
                from this repository, then reconnect. Expected API at{' '}
                <code>{baseUrl}</code>.
              </>
            )}{' '}
            <button onClick={() => retry((x) => x + 1)}>Reconnect</button>
          </div>
        )}
        {view === 'workspace' && !run && (
          <Examples
            selected={mode === 'draw' ? pattern : ''}
            disabled={busy || !config}
            supported={config?.supported_boundary_conditions}
            choose={(example) => {
              if (!config) return;
              edit(examplePlane(example));
              setConditions(
                exampleConditions(example, config.supported_boundary_conditions),
              );
              setBrush(defaultBrush);
              setPreset(example.preset);
              setPattern(example.name);
              setMode('draw');
              setReadout('');
            }}
          />
        )}
        {view === 'sky' ? (
          <Sky online={!!config} />
        ) : view === 'history' ? (
          config ? (
            <History
              onDelete={forget}
              openField={openField}
              openRun={(r) => {
                inspectRun(r);
                setView('workspace');
              }}
            />
          ) : (
            <p>Waiting for the engine connection…</p>
          )
        ) : (
          <div className="workspace-grid">
            <div ref={visualColumn} className="visual-column">
              {run && run.resolved.nz > 1 && (
                <SpatialControls
                  view={spatial}
                  grid={run.resolved}
                  change={(v) => {
                    setSpatial(v);
                    setPresented(-1);
                    setReadout('');
                  }}
                />
              )}
              {run && spatial.mode === 'Volume' ? (
                <VolumePlayer
                  key={run.id}
                  run={run}
                  n={n}
                  colors={colors}
                  range={range}
                  onPresent={setPresented}
                />
              ) : run ? (
                <Player
                  key={run.id + JSON.stringify(spatial)}
                  view={run.resolved.nz > 1 ? frameView(spatial) : undefined}
                  run={run}
                  n={n}
                  colors={colors}
                  onRead={setReadout}
                  readout={readout}
                  range={range}
                  onPresent={setPresented}
                />
              ) : (
                <Viewport
                  nx={nx}
                  ny={ny}
                  map={inUpload ? previewMap : 'inferno'}
                  range={range}
                  mode="Initial field"
                  readout={readout}
                >
                  {mode === 'draw' ? (
                    <DrawingCanvas
                      plane={plane}
                      brush={brush}
                      change={edit}
                      onRead={setReadout}
                    />
                  ) : uploaded.url ? (
                    <Image
                      unoptimized
                      width={nx}
                      height={ny}
                      src={uploaded.url}
                      alt="Selected NetCDF plane preview"
                      style={{
                        background:
                          fill !== '' && fillColor
                            ? 'rgb(' + fillColor.join(',') + ')'
                            : undefined,
                      }}
                    />
                  ) : (
                    <div className="plot-message">
                      <Layers2 size={28} />
                      {uploaded.error ??
                        (selection?.field.state === 'archived'
                          ? 'Archived · preview unavailable'
                          : selection
                            ? 'Loading plane…'
                            : 'Upload a field to preview its values.')}
                    </div>
                  )}
                </Viewport>
              )}
              <Timeline
                key={'timeline-' + (runId ?? 'setup')}
                run={run}
                n={n}
                setN={setN}
                ready={presented === n}
                autoplay={autoplay && !!run}
              />
              <details className="panel explainer">
                <summary>What am I looking at?</summary>
                <p>
                  Color shows the amount of tracer in each cell.{' '}
                  <strong>Advection</strong> carries it with the wind.{' '}
                  <strong>Diffusion</strong> spreads it from high concentrations to low
                  ones.
                </p>
                <p>
                  The stability limit is the largest safe time step for this grid, wind
                  and diffusion. The workspace lowers the time step when those settings
                  require it.
                </p>
              </details>
            </div>
            <aside className="panel inspector">
              <header className="panel-head">
                <h2>
                  {run ? <Activity size={17} /> : <SlidersHorizontal size={17} />}{' '}
                  {run ? 'Run inspector' : 'Configuration'}
                </h2>
                <span className="micro">{run ? 'OUTPUT' : 'SETUP'}</span>
              </header>
              {run ? (
                <div className="inspector-body">
                  <div className="spread">
                    <strong className="capitalize">{run.status}</strong>
                    <span className="mono">
                      {run.elapsed_seconds?.toFixed(1) ?? '0.0'} s elapsed
                    </span>
                  </div>
                  <progress
                    aria-label="Run progress"
                    max={run.resolved.steps}
                    value={run.step}
                  />
                  <p className="hint">
                    Step {run.step} / {run.resolved.steps} · {run.frames} /{' '}
                    {run.resolved.expected_frames} frames{' '}
                    {run.queue_position && `· Queue position ${run.queue_position}`}
                  </p>
                  {run.message && (
                    <p className="error" role="alert">
                      {run.message}
                    </p>
                  )}
                  {pollError && (
                    <p className="error">
                      {pollError}{' '}
                      <button onClick={() => retryPoll((x) => x + 1)}>
                        Retry status
                      </button>
                    </p>
                  )}
                  <div className="rule" />
                  {config && (
                    <Output
                      key={run.id}
                      view={run.resolved.nz > 1 ? frameView(spatial) : undefined}
                      volume={spatial.mode === 'Volume'}
                      run={run}
                      n={n}
                      colors={colors}
                      change={setColors}
                      config={config}
                    />
                  )}
                  <div className="rule" />
                  {status === 'running' || status === 'queued' ? (
                    <button className="secondary" disabled={busy} onClick={cancel}>
                      Cancel run
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => {
                        setRun(null);
                        setN(0);
                        setReadout('');
                        clearReview();
                      }}
                    >
                      <RotateCcw size={14} />
                      Back to setup
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="inspector-tabs">
                    {(['field', 'conditions'] as const).map((t) => (
                      <button
                        key={t}
                        aria-pressed={tab === t}
                        className={tab === t ? 'selected' : ''}
                        onClick={() => setTab(t)}
                      >
                        {t === 'field' ? (
                          <Layers2 size={15} />
                        ) : (
                          <FlaskConical size={15} />
                        )}{' '}
                        {t === 'field' ? 'Initial field' : 'Conditions'}
                      </button>
                    ))}
                  </div>
                  <fieldset className="inspector-body" disabled={busy}>
                    {tab === 'field' ? (
                      <>
                        <div className="section-label">Field source</div>
                        <div className="source-tabs segmented">
                          <button
                            aria-pressed={mode === 'draw'}
                            onClick={() => {
                              setMode('draw');
                              setReadout('');
                              clearReview();
                            }}
                          >
                            <Paintbrush size={15} />
                            Draw field
                          </button>
                          <button
                            disabled={!config}
                            aria-pressed={mode === 'upload'}
                            onClick={() => {
                              if (selection?.volume && variable)
                                setConditions(withLayers(conditions, variable.nz));
                              setMode('upload');
                              setReadout('');
                              clearReview();
                            }}
                          >
                            <UploadCloud size={15} />
                            Upload file
                          </button>
                        </div>
                        {mode === 'draw' ? (
                          <>
                            {conditions.nz && (
                              <p className="hint">
                                {preset
                                  ? 'Gaussian volume preset · central slice'
                                  : 'Drawing repeated through the volume'}
                              </p>
                            )}
                            <DrawingControls
                              plane={plane}
                              change={edit}
                              brush={brush}
                              setBrush={setBrush}
                              pattern={pattern}
                              setPattern={setPattern}
                            />
                            {!preset && (
                              <NumberField
                                label="Extrude to N layers"
                                value={conditions.nz ?? 1}
                                min={1}
                                integer
                                update={(nz) => {
                                  if (isExample) setPattern('Custom');
                                  setConditions(withLayers(conditions, nz!));
                                  clearReview();
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <UploadControls
                            volume={!!(conditions.nz && selection?.volume)}
                            onVolumeChange={(active) => {
                              if (!selection || !variable) return;
                              const index = { ...selection.index };
                              if (variable.z_dim) delete index[variable.z_dim];
                              select({ ...selection, index, volume: active });
                              setConditions(
                                withLayers(conditions, active ? variable.nz : 1),
                              );
                            }}
                            selection={selection}
                            select={select}
                            stats={stats}
                            fill={fill}
                            setFill={(v) => {
                              setFill(v);
                              clearReview();
                            }}
                            busy={busy}
                            setBusy={setBusy}
                            onError={setError}
                            load={(p) => {
                              edit(p);
                              let min = Infinity,
                                max = -Infinity;
                              for (const v of p.data) {
                                min = Math.min(min, v);
                                max = Math.max(max, v);
                              }
                              setBrush({
                                ...defaultBrush,
                                min,
                                max: max > min ? max : min + 1,
                                strength: max,
                              });
                              setMode('draw');
                            }}
                          />
                        )}
                      </>
                    ) : config ? (
                      <ConditionsForm
                        volumeLayers={
                          mode === 'upload' && selection?.volume
                            ? variable?.nz
                            : undefined
                        }
                        model={conditions}
                        change={(m) => {
                          setConditions(m);
                          if (!m.nz && selection?.volume)
                            select({ ...selection, volume: false });
                          if (isExample) setPattern('Custom');
                          clearReview();
                        }}
                        config={config}
                      />
                    ) : (
                      <p className="hint">Waiting for server configuration…</p>
                    )}
                  </fieldset>
                  <div className="launch">
                    <div className="launch-meta">
                      <CircleDot size={13} />
                      {conditions.steps} steps <span>·</span> {conditions.frames}{' '}
                      requested frames
                    </div>
                    {warnings.map((w) => (
                      <p key={w} className="warning" role="status">
                        {w}
                      </p>
                    ))}
                    {error && (
                      <p className="error" role="alert">
                        {error}
                      </p>
                    )}
                    <button
                      className="primary run-button"
                      disabled={!canStart}
                      onClick={launch}
                    >
                      {busy ? (
                        <LoaderCircle size={16} />
                      ) : (
                        <Play size={15} fill="currentColor" />
                      )}
                      {busy
                        ? 'Preparing…'
                        : warnings.length
                          ? 'Run with warnings'
                          : 'Run simulation'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {run && error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </aside>
          </div>
        )}
        <footer className="app-footer">
          <span>
            <Waves size={15} />
            ClimateSim <ChevronRight size={12} /> Simulation lab
          </span>
          <span>
            <BookOpen size={13} />
            API v1.3.0
          </span>
        </footer>
      </main>
    </>
  );
}
