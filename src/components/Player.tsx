import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, checked, decodeGrid, message, type Colors } from '@/lib/api';
import { cellAt, numberText, pixels, type Plane, type Run } from '@/lib/model';
import { MeanChart, chartInterval, type MeanSample } from './MeanChart';
import { Viewport } from './Viewport';

type Frame = {
  index: number;
  plane: Plane;
  mean: number;
  raster?: { key: string; image: ImageData };
};
type Entry = { controller: AbortController; task: Promise<Frame> };

async function loadFrame(
  id: string,
  n: number,
  stride: number,
  signal: AbortSignal,
): Promise<Frame> {
  const response = await api.GET('/runs/{runId}/frames/{n}/values', {
    params: { path: { runId: id, n }, query: { stride } },
    parseAs: 'arrayBuffer',
    signal,
  });
  const plane = decodeGrid(checked(response), response.response.headers);
  let sum = 0,
    count = 0;
  for (const value of plane.data) {
    if (Number.isFinite(value)) {
      sum += value;
      count++;
    }
  }
  return { index: n, plane, mean: count ? sum / count : NaN };
}

function raster(frame: Frame, colors: Colors, min: number, max: number) {
  const key = [colors.colormap, min, max].join('/');
  if (frame.raster?.key !== key) {
    const { nx, ny } = frame.plane;
    frame.raster = {
      key,
      image: new ImageData(pixels(frame.plane, colors.colormap, min, max), nx, ny),
    };
  }
  return frame.raster.image;
}

function FrameCanvas({
  frame,
  colors,
  range,
  smooth,
  label,
  onMove,
  onLeave,
}: {
  frame: Frame;
  colors: Colors;
  range: number[];
  smooth: boolean;
  label: string;
  onMove?: React.PointerEventHandler<HTMLCanvasElement>;
  onLeave?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [min, max] = range;
  useLayoutEffect(() => {
    canvas.current
      ?.getContext('2d')
      ?.putImageData(raster(frame, colors, min, max), 0, 0);
  }, [frame, colors, min, max]);
  return (
    <canvas
      role="img"
      aria-label={label}
      ref={canvas}
      width={frame.plane.nx}
      height={frame.plane.ny}
      style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    />
  );
}

// The workspace keys this component by run ID, so cached planes and means belong to one run.
export function Player({
  run,
  n,
  colors,
  range,
  onRead,
  readout,
  onPresent,
}: {
  run: Run;
  n: number;
  colors: Colors;
  range: number[];
  onRead: (s: string) => void;
  readout: string;
  onPresent: (n: number) => void;
}) {
  const [compare, setCompare] = useState(false),
    [smooth, setSmooth] = useState(false);
  const cache = useRef(new Map<number, Entry>());
  const [visible, show] = useState<Frame>(),
    [first, setFirst] = useState<Frame>();
  const [samples, setSamples] = useState(new Map<number, MeanSample>());
  const [error, setError] = useState(''),
    [attempt, retry] = useState(0);
  const stride = Math.max(
    1,
    Math.ceil(Math.max(run.resolved.nx, run.resolved.ny) / 512),
  );
  const [min, max] = range,
    available = n < run.frames && run.status !== 'expired';
  const interval = chartInterval(run.resolved.expected_frames);
  const ahead = Math.min(run.frames - 1, n + 3);
  useEffect(() => {
    const entries = cache.current;
    return () => {
      for (const e of entries.values()) e.controller.abort();
      entries.clear();
    };
  }, []);
  useEffect(() => {
    if (!available) return;
    let active = true;
    const entries = cache.current;
    for (const [i, entry] of entries) {
      if (i !== 0 && (i < n - 1 || i > ahead)) {
        entry.controller.abort();
        entries.delete(i);
      }
    }
    const wanted = new Set([n, ...(compare ? [0] : [])]);
    for (let i = n + 1; i <= ahead; i++) wanted.add(i);
    for (const i of wanted) {
      let entry = entries.get(i);
      if (!entry) {
        const controller = new AbortController();
        const task = loadFrame(run.id, i, stride, controller.signal);
        entry = { controller, task };
        entries.set(i, entry);
      }
      entry.task
        .then((frame) => {
          if (!active) return;
          raster(frame, colors, min, max);
          if (Number.isFinite(frame.mean)) {
            const bucket = Math.floor(i / interval);
            setSamples((previous) => {
              if ((previous.get(bucket)?.index ?? Infinity) <= i) return previous;
              return new Map(previous).set(bucket, { index: i, mean: frame.mean });
            });
          }
          if (i === n) {
            show(frame);
            setError('');
            onPresent(i);
          }
          if (i === 0) setFirst(frame);
        })
        .catch((e) => {
          if (entries.get(i) === entry) entries.delete(i);
          if (active && (i === n || (compare && i === 0))) setError(message(e));
        });
    }
    return () => {
      active = false;
    };
  }, [
    available,
    run.id,
    n,
    ahead,
    stride,
    compare,
    colors,
    min,
    max,
    onPresent,
    attempt,
    interval,
  ]);

  const hover = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function stopHover() {
    clearTimeout(timer.current);
    hover.current?.abort();
  }
  useEffect(() => {
    onRead('');
    return stopHover;
  }, [visible, onRead]);
  function read(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!visible) return;
    const { i, j } = cellAt(
      e.currentTarget.getBoundingClientRect(),
      e.clientX,
      e.clientY,
      run.resolved.nx,
      run.resolved.ny,
    );
    const display = (v: number) => onRead(`x ${i} · y ${j} · u ${numberText(v)}`);
    stopHover();
    if (i % stride === 0 && j % stride === 0) {
      display(visible.plane.data[(j / stride) * visible.plane.nx + i / stride]);
      return;
    }
    const controller = new AbortController();
    hover.current = controller;
    timer.current = setTimeout(async () => {
      try {
        const r = await api.GET('/runs/{runId}/frames/{n}/values', {
          params: {
            path: { runId: run.id, n: visible.index },
            query: { i0: i, j0: j, w: 1, h: 1 },
          },
          parseAs: 'arrayBuffer',
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          display(decodeGrid(checked(r), r.response.headers).data[0]);
      } catch (e) {
        if (!controller.signal.aborted) onRead(message(e));
      }
    }, 65);
  }
  const waiting = (
    <div className="plot-message" role="status">
      {run.status === 'expired'
        ? 'Outputs expired'
        : available
          ? 'Loading frame…'
          : 'Waiting for a frame…'}
    </div>
  );
  const props = { colors, range, smooth };
  return (
    <Viewport
      nx={run.resolved.nx}
      ny={run.resolved.ny}
      map={colors.colormap}
      range={range}
      mode="Run output"
      readout={readout}
      controls={
        <div className="frame-options">
          <button aria-pressed={smooth} onClick={() => setSmooth(!smooth)}>
            Smooth pixels
          </button>
          <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
            Compare frames
          </button>
          {error && (
            <span role="alert">
              Frame unavailable.{' '}
              <button onClick={() => retry((v) => v + 1)}>Retry</button>
            </span>
          )}
        </div>
      }
      reference={
        compare &&
        (first && available ? (
          <FrameCanvas {...props} frame={first} label="First frame reference" />
        ) : (
          waiting
        ))
      }
      currentLabel={
        visible ? 'Current · frame ' + (visible.index + 1) : 'Current frame'
      }
      chart={
        <MeanChart
          means={samples}
          current={visible}
          stride={stride}
          last={run.resolved.expected_frames - 1}
        />
      }
    >
      {visible && available ? (
        <FrameCanvas
          {...props}
          frame={visible}
          label={'Simulation frame ' + (visible.index + 1)}
          onMove={read}
          onLeave={() => {
            stopHover();
            onRead('');
          }}
        />
      ) : (
        waiting
      )}
    </Viewport>
  );
}
