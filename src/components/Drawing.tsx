import { useEffect, useRef, useState } from 'react';
import { Paintbrush, Eraser, Trash2, Waves, Blend, ScatterChart } from 'lucide-react';
import {
  cellAt,
  numberText,
  makePlane,
  resizePlane,
  pixels,
  type Plane,
  type Pattern,
  type ColorMap,
} from '@/lib/model';

export type Brush = {
  size: number;
  strength: number;
  erase: boolean;
  min: number;
  max: number;
};
export const defaultBrush: Brush = {
  size: 8,
  strength: 1,
  erase: false,
  min: 0,
  max: 1,
};
type DrawingProps = { plane: Plane; change: (plane: Plane) => void; brush: Brush };
export function DrawingCanvas({
  plane,
  change,
  brush,
  map = 'inferno',
  onRead,
}: DrawingProps & { map?: ColorMap; onRead?: (s: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    last = useRef<{ i: number; j: number } | null>(null);
  const working = useRef(plane);
  const keyboardCell = useRef({ i: 0, j: 0 });
  function readCell(i: number, j: number) {
    onRead?.(
      `x ${i} · y ${j} · u ${numberText(working.current.data[j * plane.nx + i])}`,
    );
  }
  useEffect(() => {
    working.current = plane;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(plane.nx, plane.ny);
    img.data.set(pixels(plane, map, brush.min, brush.max, true));
    ctx.putImageData(img, 0, 0);
  }, [plane, map, brush.min, brush.max]);
  function stroke(i: number, j: number) {
    const prev = last.current || { i, j },
      { nx, ny } = plane,
      data = working.current.data.slice();
    const n = Math.max(1, Math.abs(prev.i - i), Math.abs(prev.j - j)),
      radius = brush.size / 2;
    for (let step = 1; step <= n; step++) {
      const cx = prev.i + ((i - prev.i) * step) / n,
        cy = prev.j + ((j - prev.j) * step) / n;
      for (
        let y = Math.max(0, Math.floor(cy - radius));
        y <= Math.min(ny - 1, cy + radius);
        y++
      )
        for (
          let x = Math.max(0, Math.floor(cx - radius));
          x <= Math.min(nx - 1, cx + radius);
          x++
        )
          if (Math.hypot(cx - x, cy - y) <= radius)
            data[y * nx + x] = brush.erase ? brush.min : brush.strength;
    }
    last.current = { i, j };
    working.current = { nx, ny, data };
    change(working.current);
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    return cellAt(
      e.currentTarget.getBoundingClientRect(),
      e.clientX,
      e.clientY,
      plane.nx,
      plane.ny,
    );
  }
  return (
    <canvas
      ref={canvas}
      aria-label="Draw initial field"
      tabIndex={0}
      width={plane.nx}
      height={plane.ny}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const { i, j } = point(e);
        stroke(i, j);
      }}
      onPointerMove={(e) => {
        const { i, j } = point(e);
        readCell(i, j);
        if (last.current) stroke(i, j);
      }}
      onLostPointerCapture={() => (last.current = null)}
      onPointerUp={() => (last.current = null)}
      onPointerLeave={() => onRead?.('')}
      onFocus={() => {
        keyboardCell.current = {
          i: Math.floor(plane.nx / 2),
          j: Math.floor(plane.ny / 2),
        };
        readCell(keyboardCell.current.i, keyboardCell.current.j);
      }}
      onBlur={() => onRead?.('')}
      onKeyDown={(e) => {
        let { i, j } = keyboardCell.current;
        switch (e.key) {
          case 'ArrowLeft':
            i--;
            break;
          case 'ArrowRight':
            i++;
            break;
          case 'ArrowDown':
            j--;
            break;
          case 'ArrowUp':
            j++;
            break;
          case 'Enter':
          case ' ':
            stroke(i, j);
            last.current = null;
            break;
          default:
            return;
        }
        e.preventDefault();
        i = Math.max(0, Math.min(i, plane.nx - 1));
        j = Math.max(0, Math.min(j, plane.ny - 1));
        keyboardCell.current = { i, j };
        readCell(i, j);
      }}
      title="Drag to paint. With keyboard focus, use the arrow keys to select a cell and Enter to paint."
    />
  );
}
export function DrawingControls({
  plane,
  change,
  brush,
  setBrush,
  pattern,
  setPattern,
}: DrawingProps & {
  setBrush: (b: Brush) => void;
  pattern: string;
  setPattern: (p: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  function preset(p: Pattern, nx = plane.nx, ny = plane.ny) {
    change(makePlane(nx, ny, p, brush.min, brush.max));
    setPattern(p);
  }
  return (
    <div className="control-stack">
      <div>
        <div className="section-label">Starter pattern</div>
        <div className="patterns">
          {(['Hotspot', 'Stripes', 'Noise'] as const).map((p, index) => {
            const Icon = [Blend, Waves, ScatterChart][index];
            return (
              <button
                key={p}
                className={p === pattern ? 'chosen' : ''}
                aria-pressed={p === pattern}
                onClick={() => preset(p)}
              >
                <Icon size={16} />
                {p}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rule" />
      <div className="spread">
        <span className="section-label">Drawing tools</span>
        <button className="subtle" onClick={() => preset('Clear')}>
          <Trash2 size={13} />
          Clear
        </button>
      </div>
      <div className="segmented">
        <button
          aria-pressed={!brush.erase}
          onClick={() => setBrush({ ...brush, erase: false })}
        >
          <Paintbrush size={15} />
          Brush
        </button>
        <button
          aria-pressed={brush.erase}
          onClick={() => setBrush({ ...brush, erase: true })}
        >
          <Eraser size={15} />
          Eraser
        </button>
      </div>
      <label className="slider-label">
        Brush size <span className="slider-value">{brush.size} cells</span>
        <input
          type="range"
          min="1"
          max="40"
          value={brush.size}
          onChange={(e) => setBrush({ ...brush, size: +e.target.value })}
        />
      </label>
      <label className="slider-label">
        Brush strength{' '}
        <span className="slider-value">{numberText(brush.strength)}</span>
        <input
          type="range"
          min={brush.min}
          max={brush.max}
          step={(brush.max - brush.min) / 100}
          aria-valuetext={numberText(brush.strength)}
          value={brush.strength}
          onChange={(e) => setBrush({ ...brush, strength: +e.target.value })}
        />
      </label>
      <details open={custom} onToggle={(e) => setCustom(e.currentTarget.open)}>
        <summary>Grid &amp; value range</summary>
        <div className="input-grid">
          {(['nx', 'ny'] as const).map((key) => (
            <label key={key}>
              {key === 'nx' ? 'Columns' : 'Rows'}
              <input
                key={plane[key]}
                type="number"
                min="4"
                max="1024"
                defaultValue={plane[key]}
                onBlur={(e) => {
                  if (!e.target.validity.valid || !e.target.value) {
                    e.target.value = String(plane[key]);
                    return;
                  }
                  if (+e.target.value !== plane[key]) {
                    const nx = key === 'nx' ? +e.target.value : plane.nx,
                      ny = key === 'ny' ? +e.target.value : plane.ny;
                    change(resizePlane(plane, nx, ny));
                  }
                }}
              />
            </label>
          ))}
          {(['min', 'max'] as const).map((key) => (
            <label key={key}>
              Value {key}
              <input
                type="number"
                step="any"
                defaultValue={numberText(brush[key])}
                key={brush[key]}
                onBlur={(e) => {
                  if (e.target.value === numberText(brush[key])) return;
                  const v = e.target.valueAsNumber;
                  const b = { ...brush, [key]: v };
                  if (Number.isFinite(Math.fround(v)) && b.max > b.min)
                    setBrush({
                      ...b,
                      strength: Math.max(b.min, Math.min(b.max, b.strength)),
                    });
                  else e.target.value = numberText(brush[key]);
                }}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
