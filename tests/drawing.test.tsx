import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  GridFields,
  DrawingCanvas,
  DrawingControls,
  defaultBrush,
} from '@/components/Drawing';
import { makePlane, resizePlane, encodePlane, type Plane } from '@/lib/model';
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
});
function Editor({ record }: { record: (p: Plane) => void }) {
  const [plane, setPlane] = useState(makePlane(8, 8, 'Clear')),
    [brush, setBrush] = useState({ ...defaultBrush, size: 1 }),
    [pattern, setPattern] = useState('');
  function change(p: Plane) {
    record(p);
    setPlane(p);
  }
  return (
    <>
      <GridFields plane={plane} change={(x, y) => change(resizePlane(plane, x, y))} />
      <DrawingCanvas plane={plane} brush={brush} change={change} />
      <DrawingControls
        plane={plane}
        brush={brush}
        change={change}
        setBrush={setBrush}
        pattern={pattern}
        setPattern={setPattern}
      />
    </>
  );
}
it('writes the bottom-left cell first in little-endian float32 and erases it', () => {
  const record = vi.fn();
  render(<Editor record={record} />);
  const canvas = screen.getByLabelText('Draw initial field');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 80, 80));
  const paint = () => {
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 2, clientY: 79 });
    fireEvent.pointerUp(canvas);
  };
  paint();
  const p = record.mock.lastCall?.[0] as Plane;
  expect(Array.from(new Uint8Array(encodePlane(p.data)).slice(0, 4))).toEqual([
    0, 0, 128, 63,
  ]);
  expect(p.data[56]).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
  paint();
  expect(record.mock.lastCall?.[0].data[0]).toBe(0);
});
it('applies starter patterns, grid size, brush settings and clear', () => {
  const record = vi.fn();
  render(<Editor record={record} />);
  fireEvent.click(screen.getByText('Stripes'));
  expect(new Set(record.mock.lastCall?.[0].data).size).toBeGreaterThan(1);
  fireEvent.change(screen.getByLabelText('Brush size', { exact: false }), {
    target: { value: '12' },
  });
  expect(screen.getByText('12 cells')).toBeVisible();
  expect(screen.getByLabelText('Value min')).toBeVisible();
  const columns = screen.getByLabelText('Columns');
  fireEvent.change(columns, { target: { value: '12' } });
  fireEvent.blur(columns);
  expect(record.mock.lastCall?.[0].nx).toBe(12);
  fireEvent.click(screen.getByText('Clear'));
  expect(new Set(record.mock.lastCall?.[0].data)).toEqual(new Set([0]));
});
it('can select and paint a specific cell with the keyboard', () => {
  const record = vi.fn();
  render(<Editor record={record} />);
  const canvas = screen.getByLabelText('Draw initial field');
  fireEvent.focus(canvas);
  fireEvent.keyDown(canvas, { key: 'ArrowDown' });
  fireEvent.keyDown(canvas, { key: 'Enter' });
  expect(record.mock.lastCall?.[0].data[3 * 8 + 4]).toBe(1);
});
