import { useCallback, useEffect, useState } from 'react';
import { Activity, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { Run } from '@/lib/model';
import { frameTime, type Units } from '@/lib/model';
export function Timeline({
  run,
  n,
  setN,
  ready = true,
  autoplay = false,
  clocks,
  units,
}: {
  clocks?: string[];
  units?: Units;
  ready?: boolean;
  autoplay?: boolean;
  run?: Run | null;
  n: number;
  setN: (n: number) => void;
}) {
  const [playing, setPlaying] = useState(autoplay),
    [speed, setSpeed] = useState(1);
  const count = run?.status === 'expired' ? 0 : (run?.frames ?? 0),
    last = Math.max(0, count - 1);
  const live = run?.status === 'running' || run?.status === 'queued';
  const toggle = useCallback(() => {
    if (!count) return;
    if (!playing && n >= last && !live) setN(0);
    setPlaying(!playing);
  }, [count, n, last, live, playing, setN]);
  useEffect(() => {
    if (!playing || !count || !ready) return;
    const t = setTimeout(() => {
      if (n < last) setN(n + 1);
      else if (!live) setPlaying(false);
    }, 200 / speed);
    return () => clearTimeout(t);
  }, [playing, count, n, last, speed, setN, live, ready]);
  const stepFrame = useCallback(
    (offset: number) => {
      setPlaying(false);
      setN(Math.max(0, Math.min(last, n + offset)));
    },
    [last, n, setN],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        !count ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        el.closest('input,select,textarea,[contenteditable=true]')
      )
        return;
      if (e.code === 'Space' && !el.closest('button,summary,a')) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(e.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, stepFrame, count]);
  const step = run ? Math.min(n * run.resolved.out_every, run.resolved.steps) : 0,
    time = run ? frameTime(run, n) : `t = 0 ${units?.time ?? 'h'}`;
  return (
    <section className="panel timeline">
      <header className="panel-head">
        <h2>
          <Activity size={17} />
          {clocks ? 'Layer playback' : 'Timeline'}
        </h2>
        <span className="mono muted">
          {count ? `Frame ${n + 1} / ${count}` : 'No frames yet'}
        </span>
      </header>
      <div className="transport">
        <button
          className="play-btn"
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={!count}
          onClick={toggle}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          className="icon-btn"
          aria-label="Previous frame"
          disabled={!count || n === 0}
          onClick={() => stepFrame(-1)}
        >
          <SkipBack size={17} />
        </button>
        <button
          className="icon-btn"
          aria-label="Next frame"
          disabled={n >= last}
          onClick={() => stepFrame(1)}
        >
          <SkipForward size={17} />
        </button>
        <input
          type="range"
          aria-label="Frame scrubber"
          aria-valuetext={clocks?.[n] ?? `Step ${step}, ${time}`}
          min={0}
          max={last || 1}
          value={n}
          disabled={!last}
          onChange={(e) => {
            setPlaying(false);
            setN(+e.target.value);
          }}
        />
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        >
          {[0.5, 1, 2, 4].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
      <div className="timeline-meta">
        <span>
          {clocks ? (
            <>
              {clocks[0]} – {clocks[last]} · Local time <b>{clocks[n]}</b>
            </>
          ) : (
            <>
              Step <b>{step}</b> <i>/</i> <b>{time}</b>
            </>
          )}
        </span>
        <span>
          <kbd>space</kbd> play / pause <kbd>←</kbd>
          <kbd>→</kbd> step
        </span>
      </div>
    </section>
  );
}
