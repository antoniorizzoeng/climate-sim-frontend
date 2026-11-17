import { useEffect, useRef, useState } from 'react';
import { Download, Film, ImageDown, Database } from 'lucide-react';
import { api, checked, download, frameBlob, message, type Colors } from '@/lib/api';
import type { ColorMap, Config, Run } from '@/lib/model';
export function Output({
  run,
  n,
  colors,
  change,
  config,
}: {
  run: Run;
  n: number;
  colors: Colors;
  change: (v: Colors) => void;
  config: Config;
}) {
  const [rangeDraft, setRangeDraft] = useState<[string, string] | null>(null);
  const [min, max] = rangeDraft ?? [
    String(colors.vmin ?? run.display_range?.[0] ?? 0),
    String(colors.vmax ?? run.display_range?.[1] ?? 1),
  ];
  const [format, setFormat] = useState<'mp4' | 'gif'>('mp4'),
    [fps, setFps] = useState(12),
    [job, setJob] = useState(''),
    [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  function updateRange(a: string, b: string) {
    setRangeDraft([a, b]);
    if (a !== '' && b !== '' && Number.isFinite(+a) && Number.isFinite(+b) && +a < +b)
      change({ ...colors, vmin: +a, vmax: +b });
  }
  async function save(type: 'video' | 'png' | 'result') {
    if (active.current) return;
    const ctrl = new AbortController();
    active.current = ctrl;
    setJob('Preparing download…');
    setError('');
    try {
      const path = { runId: run.id };
      if (type === 'png') {
        const blob = await frameBlob(run.id, n, colors, true, ctrl.signal);
        if (!ctrl.signal.aborted) download(blob, `frame-${n}.png`);
      } else if (type === 'result') {
        const blob = checked(
          await api.GET('/runs/{runId}/result.nc', {
            params: { path },
            parseAs: 'blob',
            signal: ctrl.signal,
          }),
        );
        if (!ctrl.signal.aborted) download(blob, 'result.nc');
      } else {
        while (!ctrl.signal.aborted) {
          const r = await api.GET('/runs/{runId}/export.{format}', {
            params: { path: { ...path, format }, query: { ...colors, fps } },
            parseAs: 'blob',
            signal: ctrl.signal,
          });
          const blob = checked(r);
          if (r.response.status === 200) {
            if (!ctrl.signal.aborted) download(blob, `simulation.${format}`);
            break;
          }
          const { progress } = JSON.parse(await blob.text());
          if (ctrl.signal.aborted) break;
          setJob(`Rendering ${format.toUpperCase()} · ${Math.round(progress * 100)}%`);
          await new Promise<void>((resolve) => {
            const done = () => {
              clearTimeout(timer);
              ctrl.signal.removeEventListener('abort', done);
              resolve();
            };
            const timer = setTimeout(
              done,
              Math.max(0.1, Number(r.response.headers.get('Retry-After') ?? 1)) * 1000,
            );
            ctrl.signal.addEventListener('abort', done, { once: true });
          });
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(message(e));
    } finally {
      active.current = null;
      if (!ctrl.signal.aborted) setJob('');
    }
  }
  return (
    <div className="control-stack">
      <div className="section-label">Frame appearance</div>
      <label>
        Colormap
        <select
          value={colors.colormap}
          onChange={(e) => change({ ...colors, colormap: e.target.value as ColorMap })}
        >
          {config.colormaps.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="input-grid">
        <label>
          Range minimum
          <input
            type="number"
            step="any"
            value={min}
            onChange={(e) => updateRange(e.target.value, max)}
          />
        </label>
        <label>
          Range maximum
          <input
            type="number"
            step="any"
            value={max}
            onChange={(e) => updateRange(min, e.target.value)}
          />
        </label>
      </div>
      {(+min >= +max || !min || !max) &&
        !(
          colors.vmin === undefined && run.display_range?.[0] === run.display_range?.[1]
        ) && <p className="hint">Enter a minimum below the maximum.</p>}
      <button
        className="subtle"
        onClick={() => {
          change({ colormap: colors.colormap });
          setRangeDraft(null);
        }}
      >
        Reset to run range
      </button>
      <div className="rule" />
      <div className="section-label with-icon">
        <Download size={15} />
        Export simulation
      </div>
      <div className="input-grid">
        <label>
          Format
          <select
            aria-label="Animation format"
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="mp4">MP4 video</option>
            <option value="gif">Animated GIF</option>
          </select>
        </label>
        <label>
          Frames per second
          <input
            type="number"
            min={1}
            max={60}
            value={fps || ''}
            onChange={(e) => setFps(+e.target.value)}
          />
        </label>
      </div>
      <button
        className="primary"
        disabled={
          !!job ||
          run.status !== 'done' ||
          fps < 1 ||
          fps > 60 ||
          !Number.isInteger(fps)
        }
        onClick={() => save('video')}
      >
        <Film size={16} />
        Download {format.toUpperCase()}
      </button>
      <div className="two-actions">
        <button
          className="secondary"
          disabled={!!job || !run.frames || run.status === 'expired'}
          onClick={() => save('png')}
        >
          <ImageDown size={15} />
          Frame PNG
        </button>
        <button
          className="secondary"
          disabled={!!job || run.status !== 'done'}
          onClick={() => save('result')}
        >
          <Database size={15} />
          Result.nc
        </button>
      </div>
      {job && (
        <p className="hint" role="status">
          {job}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
