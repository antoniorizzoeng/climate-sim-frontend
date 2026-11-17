import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { api, checked, decodeGrid, frameBlob, message, type Colors } from '@/lib/api';
import { cellAt, type Run } from '@/lib/model';

export function PlayerImage({
  run,
  n,
  colors,
  onRead,
}: {
  run: Run;
  n: number;
  colors: Colors;
  onRead: (s: string) => void;
}) {
  const cache = useRef(new Map<number, string>()),
    [frame, setFrame] = useState<{ key: string; url: string } | null>(null),
    [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    hover = useRef<AbortController | null>(null);
  const colorKey = JSON.stringify(colors),
    available = n < run.frames && run.status !== 'expired',
    key = [run.id, colorKey, n].join('/');
  useEffect(() => {
    const entries = cache.current;
    return () => {
      for (const url of entries.values()) URL.revokeObjectURL(url);
      entries.clear();
    };
  }, [run.id, colorKey]);
  // Request the visible frame independently of look-ahead. Polling can announce
  // more frames while an image download is still in flight.
  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    const options: Colors = JSON.parse(colorKey);
    (async () => {
      let url = cache.current.get(n);
      if (!url) {
        const blob = await frameBlob(run.id, n, options, false, controller.signal);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        cache.current.set(n, url);
      }
      setFrame({ key, url });
      setError('');
      for (const [index, old] of cache.current)
        if (Math.abs(index - n) > 2) {
          URL.revokeObjectURL(old);
          cache.current.delete(index);
        }
    })().catch((e) => {
      if (!controller.signal.aborted) setError(message(e));
    });
    return () => controller.abort();
  }, [available, run.id, n, key, colorKey]);
  const ahead = Math.min(n + 2, run.frames - 1);
  useEffect(() => {
    if (!available || frame?.key !== key) return;
    const controller = new AbortController();
    const options: Colors = JSON.parse(colorKey);
    (async () => {
      for (let i = n + 1; i <= ahead; i++) {
        if (cache.current.has(i)) continue;
        const blob = await frameBlob(run.id, i, options, false, controller.signal);
        if (controller.signal.aborted) return;
        cache.current.set(i, URL.createObjectURL(blob));
      }
    })().catch(() => {
      /* The visible-frame request retries a failed prefetch on demand. */
    });
    return () => controller.abort();
  }, [frame?.key, key, available, n, ahead, colorKey, run.id]);
  function stopHover() {
    clearTimeout(timer.current);
    hover.current?.abort();
  }
  useEffect(() => {
    onRead('');
    return stopHover;
  }, [run.id, n, onRead]);
  if (!available || frame?.key !== key)
    return (
      <div className="plot-message" role="status">
        {error ||
          (available
            ? 'Loading frame…'
            : run.status === 'expired'
              ? 'Outputs expired'
              : 'Waiting for a frame…')}
      </div>
    );
  return (
    <Image
      unoptimized
      width={run.resolved.nx}
      height={run.resolved.ny}
      alt={`Simulation frame ${n + 1}`}
      src={frame.url}
      onPointerLeave={() => {
        stopHover();
        onRead('');
      }}
      onPointerMove={(e) => {
        const { i, j } = cellAt(
          e.currentTarget.getBoundingClientRect(),
          e.clientX,
          e.clientY,
          run.resolved.nx,
          run.resolved.ny,
        );
        stopHover();
        const ctrl = new AbortController();
        hover.current = ctrl;
        timer.current = setTimeout(async () => {
          try {
            const r = await api.GET('/runs/{runId}/frames/{n}/values', {
              params: {
                path: { runId: run.id, n },
                query: { i0: i, j0: j, w: 1, h: 1 },
              },
              parseAs: 'arrayBuffer',
              signal: ctrl.signal,
            });
            const p = decodeGrid(checked(r), r.response.headers);
            if (!ctrl.signal.aborted)
              onRead(
                `x ${r.response.headers.get('X-I0') ?? i} · y ${r.response.headers.get('X-J0') ?? j} · u ${p.data[0].toPrecision(4)}`,
              );
          } catch (e) {
            if (!ctrl.signal.aborted) onRead(message(e));
          }
        }, 65);
      }}
    />
  );
}
