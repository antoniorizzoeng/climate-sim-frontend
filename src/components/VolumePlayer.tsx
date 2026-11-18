import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { loadVolume, message, type Colors } from '@/lib/api';
import { frameTime, gradient, numberText, type Run, type Volume } from '@/lib/model';
import { createVolumeScene } from '@/lib/volumeScene';
import { WebGLHelp } from './WebGLHelp';

type Entry = { controller: AbortController; task: Promise<Volume> };

export default function VolumePlayer({
  run,
  n,
  colors,
  range,
  onPresent,
}: {
  run: Run;
  n: number;
  colors: Colors;
  range: number[];
  onPresent: (n: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createVolumeScene> | null>(null);
  const [shown, setShown] = useState<number>();
  const [failure, setFailure] = useState(''),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [opacity, setOpacity] = useState(0.65),
    [threshold, setThreshold] = useState(0.025);
  const entries = useRef(new Map<number, Entry>());
  const { nx, ny, nz, dz } = run.resolved;
  const { dx = 1, dy = 1 } = run.request;
  const available = n < run.frames && run.status !== 'expired';
  const ahead = Math.min(n + 1, run.frames - 1);
  useEffect(() => {
    const cache = entries.current;
    const container = host.current!;
    let mounted = true;
    const lost = (event: Event) => {
      event.preventDefault();
      setFailure('WebGL2 context lost. Reopen Volume or choose Slice or Projection.');
    };
    container.addEventListener('webglcontextlost', lost, true);
    try {
      scene.current = createVolumeScene(container, [nx * dx, ny * dy, nz * dz]);
    } catch (e) {
      queueMicrotask(() => {
        if (mounted) setFailure(message(e));
      });
    }
    return () => {
      mounted = false;
      container.removeEventListener('webglcontextlost', lost, true);
      for (const entry of cache.values()) entry.controller.abort();
      cache.clear();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [nx, ny, nz, dx, dy, dz]);
  const [min, max] = range;
  useEffect(() => {
    scene.current?.appearance(colors.colormap, min, max, opacity, threshold);
  }, [colors.colormap, min, max, opacity, threshold]);
  useEffect(() => {
    if (!scene.current || failure || !available) return;
    let active = true;
    const cache = entries.current;
    for (const [i, entry] of cache)
      if (i < n || i > ahead) {
        entry.controller.abort();
        cache.delete(i);
      }
    // Keep only the selected volume and one upcoming frame in CPU memory.
    for (let i = n; i <= ahead; i++) {
      let entry = cache.get(i);
      if (!entry) {
        const controller = new AbortController();
        entry = { controller, task: loadVolume(run.id, i, controller.signal) };
        cache.set(i, entry);
      }
      entry.task
        .then((volume) => {
          if (active && i === n) {
            scene.current?.frame(volume);
            setShown(i);
            setError('');
            onPresent(i);
          }
        })
        .catch((e) => {
          if (cache.get(i) === entry) cache.delete(i);
          if (active && i === n) setError(message(e));
        });
    }
    return () => {
      active = false;
    };
  }, [run.id, n, ahead, available, onPresent, retry, failure]);
  return (
    <section className="panel viewport" aria-label="Volume viewport">
      <header className="panel-head">
        <h2>
          <Box size={17} />
          Volume viewport
        </h2>
        <span className="mode-tag">
          {nx} × {ny} × {nz}
        </span>
      </header>
      <div className="volume-stage">
        <div ref={host} className="volume-scene" hidden={!!failure || !available} />
        {(failure || error || !available || shown === undefined) && (
          <div className="plot-message" role="status">
            {failure ||
              error ||
              (run.status === 'expired'
                ? 'Outputs expired'
                : available
                  ? 'Loading volume…'
                  : 'Waiting for a frame…')}
            {failure && <WebGLHelp error={failure} />}
            {error && !failure && (
              <button className="secondary" onClick={() => setRetry((v) => v + 1)}>
                Retry frame
              </button>
            )}
          </div>
        )}
      </div>
      {!failure && (
        <div className="volume-settings input-grid">
          {(
            [
              ['Opacity', opacity, setOpacity],
              ['Threshold', threshold, setThreshold],
            ] as const
          ).map(([name, value, set]) => (
            <label key={name}>
              {name} · {Math.round(value * 100)}%
              <input
                aria-label={name}
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={value}
                onChange={(e) => set(+e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
      <div className="legend">
        <div>
          <span className="micro">FIELD INTENSITY</span>
          <span className="map-name">{colors.colormap}</span>
        </div>
        <div className="colorbar" style={{ background: gradient(colors.colormap) }} />
        <div className="legend-values">
          <span>{numberText(min)}</span>
          <span>{numberText(max)}</span>
        </div>
      </div>
      {!failure && (
        <footer className="viewport-foot">
          <span>Drag to orbit · Scroll or pinch to zoom</span>
          {shown !== undefined && (
            <span>
              <span>Volume frame {shown + 1}</span> · {frameTime(run, shown)}
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
