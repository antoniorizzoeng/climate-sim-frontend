'use client';
import dynamic from 'next/dynamic';
import { initialView, frameView, SpatialControls } from '@/components/SpatialControls';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
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
  ScanLine,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Telescope,
  UploadCloud,
  Waves,
} from 'lucide-react';
import { api, baseUrl, checked, message, saveDrawing, type Colors } from '@/lib/api';
import {
  applySpacing,
  changeUnits,
  systems,
  resizePlane,
  numberText,
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
  type RequestBody,
  cleanRange,
  withLayers,
} from '@/lib/model';
import {
  DrawingCanvas,
  DrawingControls,
  GridFields,
  defaultBrush,
} from '@/components/Drawing';
import { ConditionsForm, NumberField } from '@/components/Conditions';
import { Viewport } from '@/components/Viewport';
import { Timeline } from '@/components/Timeline';
import { UploadControls, useUploadPlane } from '@/components/Upload';
import { Player } from '@/components/Player';
import { Examples } from '@/components/Examples';
import { examplePlane, exampleConditions, examples } from '@/lib/examples';
import { Output } from '@/components/Output';
import { Sky } from '@/components/sky/Sky';
import { sameLayers, sourceLayer, gaussianSlice } from '@/lib/initialVolume';
import { SliceChoice } from '@/components/SliceChoice';
import { History } from '@/components/History';
import { Settings } from '@/components/settings/Settings';
import { closeSettings, navigate, useNavigation } from '@/lib/navigation';
import { useUnitSystem } from '@/lib/settings';
import { bytes } from '@/lib/history';
import type { components } from '@/lib/schema';

type RunValidation = components['schemas']['RunValidation'];

function memoryIssue(validation?: RunValidation) {
  const resolved = validation?.resolved;
  return resolved && resolved.estimated_memory_bytes > resolved.memory_capacity_bytes
    ? validation.errors.find((issue) => issue.loc.join('.') === 'body.source')
    : undefined;
}

const InitialVolume = dynamic(() => import('@/components/InitialVolume'), {
  ssr: false,
});

// matchMedia is missing in some embedded browsers and in jsdom; treat that as no match.
function mediaMatches(query: string) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

const VolumePlayer = dynamic(() => import('@/components/VolumePlayer'), {
  ssr: false,
  loading: () => (
    <div className="panel volume-stage" role="status">
      Loading volume viewer…
    </div>
  ),
});

const mockMode =
  !!process.env.NEXT_PUBLIC_DEMO_BASE_PATH || process.env.NEXT_PUBLIC_MOCK_API === '1';
const emptyColors: Colors = { colormap: 'inferno' };
export default function Workspace() {
  const [config, setConfig] = useState<Config>(),
    [connError, setConnError] = useState(false),
    [attempt, retry] = useState(0);
  const { view, section } = useNavigation();
  const [tab, setTab] = useState<'field' | 'conditions'>('field'),
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
  const defaultUnits = useUnitSystem();
  const [editedConditions, setEditedConditions] = useState<Conditions>();
  const newConditions = useMemo(
    () => changeUnits(defaults, systems[defaultUnits], true),
    [defaultUnits],
  );
  const model = editedConditions ?? newConditions;
  const conditions = useMemo(() => {
    if (model.bc || !config) return model;
    const choices = config.supported_boundary_conditions;
    const first = choices.includes('dirichlet') ? 'dirichlet' : choices[0];
    return { ...model, bc: { left: first, right: first, top: first, bottom: first } };
  }, [config, model]);
  function setConditions(next: SetStateAction<Conditions>) {
    setEditedConditions((old) => {
      if (typeof next !== 'function') return next;
      return next(old?.bc ? old : { ...(old ?? conditions), bc: conditions.bc });
    });
  }
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [warnings, setWarnings] = useState<string[]>([]);
  const saved = useRef<{ plane: Plane; field: Field } | null>(null),
    reviewed = useRef('');
  const [run, setRun] = useState<Run | null>(null),
    [n, setN] = useState(0),
    [colors, setColors] = useState<Colors>(emptyColors),
    [readout, setReadout] = useState(''),
    [pollAttempt, retryPoll] = useState(0);
  const inspectedRunId = useRef<string | null>(null);
  const visualColumn = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('');
  const [volumePreview, setVolumePreview] = useState(false);
  const [chooseSlice, setChooseSlice] = useState(false);
  const [runName, setRunName] = useState('');
  const [setupValidation, setSetupValidation] = useState<{
    request: RequestBody;
    result: RunValidation;
  }>();
  const [checkingLayers, setCheckingLayers] = useState(false);
  const comparison = useRef<AbortController | null>(null);
  useEffect(() => () => comparison.current?.abort(), [view, selection, mode]);
  const [spatial, setSpatial] = useState(initialView(1));
  const [preset, setPreset] = useState<'gaussian_hotspot'>();
  const drawing = useMemo(
    () =>
      preset && conditions.nz
        ? gaussianSlice(plane.nx, plane.ny, conditions, Math.floor(conditions.nz / 2))
        : plane,
    [preset, conditions, plane],
  );
  const [pollError, setPollError] = useState('');
  const [presented, setPresented] = useState(-1),
    [autoplay, setAutoplay] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(async () => {
        await window.startClimateMock?.();
        void api
          .GET('/health')
          .then(checked)
          .then((h) => {
            if (active) setVersion(h.api_version);
          })
          .catch(() => {
            if (active) setVersion('');
          });
        return checked(await api.GET('/config'));
      })
      .then((c) => {
        if (!active) return;
        setConfig(c);
        setConnError(false);
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
    if (runId && mediaMatches('(max-width: 730px)'))
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
    const v = s.field.variables.find((v) => v.name === s.variable);
    const newVariable =
      selection?.field.id !== s.field.id ||
      selection.variable !== s.variable ||
      mode !== 'upload';
    setConditions((m) => {
      const next =
        s.volume && v ? withLayers(m, v.nz) : selection?.volume ? withLayers(m, 1) : m;
      if (newVariable) return applySpacing(next, v?.spacing);
      if (s.volume && !selection?.volume) return applySpacing(next, v?.spacing, true);
      return next;
    });
    setSelection(s);
    setFill(null);
    clearReview();
  }
  function inspectRun(r: Run, play = false) {
    inspectedRunId.current = r.id;
    setAutoplay(play && !mediaMatches('(prefers-reduced-motion: reduce)'));
    setPresented(-1);
    setRun(r);
    setSpatial(initialView(r.resolved.nz ?? 1));
    setN(0);
    setReadout('');
    setColors({ colormap: previewMap });
    setPollError('');
    clearReview();
  }
  function clearRun() {
    inspectedRunId.current = null;
    setRun(null);
    setN(0);
    setReadout('');
  }
  function forget(id: string) {
    if (saved.current?.field.id === id) saved.current = null;
    if (selection?.field.id === id) {
      setSelection(null);
      setFill(null);
    }
    if (inspectedRunId.current === id) clearRun();
    clearReview();
  }
  function openField(field: Field) {
    clearRun();
    select({ field, variable: field.default_var, index: {} });
    setMode('upload');
    setTab('field');
    navigate('workspace');
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
  const uploadReady = !!selection && !needFill && !!uploaded.ready;
  const fillValue =
    (stats?.missing_count || !stats || selection?.volume) && fill !== ''
      ? Number(fill)
      : undefined;
  const { nx: columns, ny: rows } = plane;
  const setupRequest = useMemo((): RequestBody | undefined => {
    if (!config) return;
    const { nz, ...solver } = conditions;
    let source: Source;
    if (mode === 'upload') {
      if (!selection || !uploadReady) return;
      source = {
        kind: 'field',
        field_id: selection.field.id,
        var: selection.variable,
        index: selection.index,
        ...(nz && (selection.volume ? { volume: true } : { replicate_z: nz })),
        ...(fillValue !== undefined && { fill_value: fillValue }),
      };
    } else {
      // A preset of the same size estimates an unsaved drawing without storing a field.
      const estimatePreset = preset ?? config.presets[0];
      if (!estimatePreset) return;
      source = {
        kind: 'preset',
        preset: estimatePreset,
        nx: columns,
        ny: rows,
        ...(nz && { nz }),
      };
    }
    return { ...solver, source };
  }, [
    config,
    conditions,
    mode,
    selection,
    uploadReady,
    fillValue,
    preset,
    columns,
    rows,
  ]);

  useEffect(() => {
    if (!setupRequest || run || busy || view !== 'workspace') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = checked(
          await api.POST('/runs/validate', {
            body: setupRequest,
            signal: controller.signal,
          }),
        );
        if (!controller.signal.aborted)
          setSetupValidation({ request: setupRequest, result });
      } catch {
        // Launch validates again and reports request failures.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [setupRequest, run, busy, view]);

  const validation =
    setupValidation?.request === setupRequest ? setupValidation?.result : undefined;
  const memoryError = memoryIssue(validation);
  const resolved = validation?.resolved;
  const estimate = resolved && (
    <div className="grid-estimate">
      <p className="hint">Output ≈ {bytes(resolved.estimated_output_bytes, true)}</p>
      {Number.isFinite(resolved.estimated_memory_bytes) &&
        Number.isFinite(resolved.memory_capacity_bytes) && (
          <p className={memoryError ? 'error' : 'hint'}>
            Memory ≈ {bytes(resolved.estimated_memory_bytes, true)} of{' '}
            {bytes(resolved.memory_capacity_bytes, true)}
          </p>
        )}
      {memoryError && (
        <p className="error" role="alert">
          {memoryError.msg}
        </p>
      )}
    </div>
  );
  const canStart =
    !!config && !busy && !memoryError && (mode === 'draw' || uploadReady);
  async function launch() {
    if (!canStart) return;
    setEditedConditions(conditions);
    setBusy(true);
    setError('');
    try {
      const { nz, ...solver } = conditions;
      let source = setupRequest?.source;
      if (mode === 'draw' && !preset) {
        const field =
          saved.current?.plane === plane
            ? saved.current.field
            : await saveDrawing(plane, isExample ? pattern : undefined);
        saved.current = { plane, field };
        source = { kind: 'field', field_id: field.id, ...(nz && { replicate_z: nz }) };
      }
      if (!source) return;
      const body = {
        ...solver,
        ...(runName.trim() && { name: runName.trim() }),
        source,
      };
      const signature = JSON.stringify(body);
      const validation = checked(await api.POST('/runs/validate', { body }));
      setWarnings(validation.warnings);
      if (setupRequest)
        setSetupValidation({ request: setupRequest, result: validation });
      if (!validation.ok) {
        const issue = setupRequest && memoryIssue(validation);
        const otherErrors = validation.errors.filter((error) => error !== issue);
        if (otherErrors.length || !issue)
          setError(
            otherErrors.map((i) => i.loc.join('.') + ' — ' + i.msg).join('\n') ||
              'Run validation failed.',
          );
        return;
      }
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
      if (inspectedRunId.current === run.id) {
        clearRun();
        clearReview();
      }
    } catch (e) {
      if (inspectedRunId.current === run.id) setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const variable = selection?.field.variables.find(
      (v) => v.name === selection.variable,
    ),
    inUpload = mode === 'upload' && !run;
  function keepSlice(z: number) {
    if (inUpload && selection?.volume && variable?.z_dim) {
      select({
        ...selection,
        volume: false,
        index: { ...selection.index, [variable.z_dim]: sourceLayer(variable, z) },
      });
      setFill(fillOverride ?? fill);
    } else if (mode === 'draw' && preset) {
      edit(gaussianSlice(plane.nx, plane.ny, conditions, z));
    }
    setConditions(withLayers(conditions, 1));
    setChooseSlice(false);
    clearReview();
  }
  async function setDimension(three: boolean) {
    if (busy || !!conditions.nz === three) return;
    if (three) {
      setConditions(
        applySpacing(
          withLayers(conditions, 16),
          inUpload ? variable?.spacing : undefined,
          true,
        ),
      );
      clearReview();
      return;
    }
    if (inUpload && selection?.volume && variable) {
      if (selection.field.state === 'archived') {
        setChooseSlice(true);
        return;
      }
      const ctrl = new AbortController();
      comparison.current = ctrl;
      setCheckingLayers(true);
      setBusy(true);
      try {
        const same = await sameLayers(selection, variable, ctrl.signal);
        if (!ctrl.signal.aborted) {
          if (same) keepSlice(0);
          else setChooseSlice(true);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(message(e));
      } finally {
        comparison.current = null;
        setCheckingLayers(false);
        setBusy(false);
      }
    } else if (mode === 'draw' && preset && (conditions.nz ?? 1) > 2)
      setChooseSlice(true);
    else keepSlice(0);
  }
  const previewControls = (
    <div
      className="segmented preview-switch"
      role="group"
      aria-label="Initial field preview"
    >
      {[false, true].map((three) => (
        <button
          key={String(three)}
          aria-label={three ? '3D preview' : '2D preview'}
          aria-pressed={volumePreview === three}
          onClick={() => {
            setVolumePreview(three);
            setReadout('');
          }}
        >
          {three ? '3D' : '2D'}
        </button>
      ))}
    </div>
  );
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
  const failedWithoutFrames = run?.status === 'error' && run.frames === 0;
  const [runReason, ...engineOutput] = run?.message?.split(/\r?\n/) ?? [];
  return (
    <>
      <header className="app-header">
        <div className="shell topbar">
          <a href="#workspace" className="brand" onClick={() => navigate('workspace')}>
            <span className="brand-icon">
              <Waves size={25} />
            </span>
            Climate<span>Sim</span>
          </a>
          <nav aria-label="Main navigation">
            <button
              aria-current={view === 'workspace' ? 'page' : undefined}
              className={view === 'workspace' ? 'active' : ''}
              onClick={() => navigate('workspace')}
            >
              <LayoutDashboard size={15} />
              Workspace
            </button>
            <button
              aria-current={view === 'history' ? 'page' : undefined}
              className={view === 'history' ? 'active' : ''}
              onClick={() => navigate('history')}
            >
              <HistoryIcon size={15} />
              History
            </button>
            <button
              aria-current={view === 'sky' ? 'page' : undefined}
              className={view === 'sky' ? 'active' : ''}
              onClick={() => navigate('sky')}
            >
              <Telescope size={15} />
              Sky
            </button>
          </nav>
          <div className="header-tools">
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
            <button
              className="header-settings"
              aria-label="Settings"
              aria-current={view === 'settings' ? 'page' : undefined}
              onClick={() =>
                view === 'settings' ? closeSettings() : navigate('settings')
              }
            >
              <SettingsIcon size={19} />
            </button>
          </div>
        </div>
      </header>
      <main className="shell" id="workspace" data-view={view}>
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
                  : view === 'settings'
                    ? 'Settings'
                    : 'Simulation workspace'}
            </h1>
            <p>
              {view === 'history'
                ? 'Reopen fields, inspect past runs, and recover archived experiments.'
                : view === 'sky'
                  ? 'Track cloud cover and seeing at your observing site.'
                  : view === 'settings'
                    ? 'Manage your Climate Sim preferences.'
                    : 'Create an initial field, configure the solver, and explore its evolution.'}
            </p>
          </div>
          {checkingLayers && view === 'workspace' && (
            <div className="inline">
              <span role="status">Comparing layers…</span>
              <button className="secondary" onClick={() => comparison.current?.abort()}>
                Cancel
              </button>
            </div>
          )}
          {chooseSlice && view === 'workspace' && (
            <SliceChoice
              layers={conditions.nz ?? 1}
              keep={keepSlice}
              cancel={() => setChooseSlice(false)}
            />
          )}
        </div>
        {connError && view !== 'settings' && (
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
        {view === 'settings' ? (
          <Settings section={section} />
        ) : view === 'sky' ? (
          <Sky online={!!config} />
        ) : view === 'history' ? (
          config ? (
            <History
              onDelete={forget}
              openField={openField}
              openRun={(r) => {
                inspectRun(r);
                navigate('workspace');
              }}
            />
          ) : (
            <p>Waiting for the engine connection…</p>
          )
        ) : (
          <div className="workspace-grid">
            <div ref={visualColumn} className="visual-column">
              {run && !failedWithoutFrames && run.resolved.nz > 1 && (
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
              {failedWithoutFrames ? (
                <section className="panel viewport" aria-label="Field viewport">
                  <header className="panel-head">
                    <h2>
                      <ScanLine size={17} /> Field viewport
                    </h2>
                    <span className="mode-tag">
                      {nx} × {ny}
                      {run.resolved.nz > 1 && ` × ${run.resolved.nz}`}
                    </span>
                  </header>
                  <div className="volume-stage">
                    <div className="plot-message" role="status">
                      No frames were written
                    </div>
                  </div>
                </section>
              ) : run && spatial.mode === 'Volume' ? (
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
              ) : volumePreview ? (
                <InitialVolume
                  plane={inUpload ? undefined : plane}
                  selection={inUpload ? selection : null}
                  model={conditions}
                  gaussian={!inUpload && !!preset}
                  map={inUpload ? previewMap : 'inferno'}
                  range={range}
                  fill={fill === '' ? undefined : Number(fill)}
                  controls={previewControls}
                />
              ) : (
                <Viewport
                  nx={nx}
                  ny={ny}
                  map={inUpload ? previewMap : 'inferno'}
                  range={range}
                  mode="Initial field"
                  headerControls={previewControls}
                  readout={readout}
                >
                  {mode === 'draw' ? (
                    <DrawingCanvas
                      plane={drawing}
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
                units={conditions.units}
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
                  <strong className="run-name">{run.name}</strong>
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
                    {run.resolved.expected_frames} frames · {run.resolved.processes} MPI
                    processes
                    {run.queue_position && `· Queue position ${run.queue_position}`}
                  </p>
                  {runReason && (
                    <p className="error" role="alert">
                      <strong>{runReason}</strong>
                    </p>
                  )}
                  {engineOutput.some((line) => line.trim()) && (
                    <details className="engine-output">
                      <summary>Engine output</summary>
                      <pre>{engineOutput.join('\n')}</pre>
                    </details>
                  )}
                  {pollError && (
                    <p className="error">
                      {pollError}{' '}
                      <button onClick={() => retryPoll((x) => x + 1)}>
                        Retry status
                      </button>
                    </p>
                  )}
                  {config && !failedWithoutFrames && (
                    <>
                      <div className="rule" />
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
                      <div className="rule" />
                    </>
                  )}
                  {status === 'running' || status === 'queued' ? (
                    <button className="secondary" disabled={busy} onClick={cancel}>
                      Cancel run
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => {
                        clearRun();
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
                        <GridFields
                          plane={inUpload ? variable : plane}
                          change={
                            inUpload
                              ? undefined
                              : (x, y) => edit(resizePlane(drawing, x, y))
                          }
                        >
                          {conditions.nz &&
                            ((inUpload && selection?.volume) || preset ? (
                              <label>
                                Layers
                                <input type="number" readOnly value={conditions.nz} />
                              </label>
                            ) : (
                              <NumberField
                                label="Extrude to N layers"
                                value={conditions.nz}
                                min={2}
                                integer
                                update={(nz) => {
                                  setConditions(withLayers(conditions, nz!));
                                  clearReview();
                                }}
                              />
                            ))}
                        </GridFields>
                        {estimate}
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
                              if (mode !== 'upload')
                                setConditions((m) =>
                                  applySpacing(
                                    selection?.volume && variable
                                      ? withLayers(m, variable.nz)
                                      : m,
                                    variable?.spacing,
                                  ),
                                );
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
                              plane={drawing}
                              change={edit}
                              brush={brush}
                              setBrush={setBrush}
                              pattern={pattern}
                              setPattern={setPattern}
                            />
                          </>
                        ) : (
                          <UploadControls
                            volume={!!(conditions.nz && selection?.volume)}
                            onVolumeChange={(active) => {
                              if (!selection || !variable) return;
                              if (!active) {
                                void setDimension(false);
                                return;
                              }
                              const index = { ...selection.index };
                              if (variable.z_dim) delete index[variable.z_dim];
                              select({ ...selection, index, volume: active });
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
                        gridEstimate={estimate}
                        onDimensionChange={setDimension}
                        approximate={
                          mode === 'upload' && variable?.spacing?.approximate
                        }
                        volumeLayers={
                          mode === 'upload' && selection?.volume
                            ? variable?.nz
                            : undefined
                        }
                        model={conditions}
                        change={(m) => {
                          setConditions(m);

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
                    <label className="run-name-input">
                      Run name (optional)
                      <input
                        type="text"
                        maxLength={120}
                        value={runName}
                        disabled={busy}
                        placeholder="Server default"
                        onChange={(e) => {
                          setRunName(e.target.value);
                          clearReview();
                        }}
                      />
                    </label>
                    <div className="launch-meta">
                      <CircleDot size={13} />
                      {conditions.steps} steps ·{' '}
                      {numberText(conditions.steps * conditions.dt)}{' '}
                      {conditions.units?.time} simulated <span>·</span>{' '}
                      {conditions.frames} requested frames
                    </div>
                    {resolved && (
                      <p className="hint">
                        Server selected {resolved.processes} MPI processes.
                      </p>
                    )}
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
                        : warnings.length && !memoryError
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
          {version && (
            <span>
              <BookOpen size={13} />
              API v{version}
            </span>
          )}
        </footer>
      </main>
    </>
  );
}
