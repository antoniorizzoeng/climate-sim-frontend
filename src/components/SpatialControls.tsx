import type { Axis, FrameView, Run } from '@/lib/model';

export type SpatialView = {
  mode: 'Slice' | 'Projection' | 'Volume';
  axis: Axis;
  slice: number;
  reduction: 'max' | 'mean';
  project: boolean;
};
export function initialView(nz: number): SpatialView {
  return {
    mode: 'Slice',
    axis: 'z',
    slice: Math.floor(nz / 2),
    reduction: 'max',
    project: false,
  };
}
export function frameView(view: SpatialView): FrameView {
  return view.project
    ? { axis: view.axis, projection: view.reduction }
    : { axis: view.axis, slice: view.slice };
}
export function SpatialControls({
  view,
  grid,
  change,
}: {
  view: SpatialView;
  grid: Run['resolved'];
  change: (view: SpatialView) => void;
}) {
  return (
    <div className="spatial-controls panel">
      <div className="segmented" role="group" aria-label="3D view">
        {(['Slice', 'Projection', 'Volume'] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={view.mode === mode}
            onClick={() =>
              mode !== view.mode &&
              change({
                ...view,
                mode,
                project: mode === 'Volume' ? view.project : mode === 'Projection',
              })
            }
          >
            {mode}
          </button>
        ))}
      </div>
      {view.mode !== 'Volume' && (
        <div className="spatial-inputs">
          <label>
            Axis
            <select
              value={view.axis}
              onChange={(e) => {
                const axis = e.target.value as Axis;
                change({ ...view, axis, slice: Math.floor(grid[`n${axis}`] / 2) });
              }}
            >
              {['z', 'y', 'x'].map((axis) => (
                <option key={axis} value={axis}>
                  {axis.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          {view.project ? (
            <label>
              Projection method
              <select
                value={view.reduction}
                onChange={(e) =>
                  change({ ...view, reduction: e.target.value as 'max' | 'mean' })
                }
              >
                <option value="max">Maximum</option>
                <option value="mean">Mean</option>
              </select>
            </label>
          ) : (
            <label>
              Slice {view.slice} / {grid[`n${view.axis}`] - 1}
              <input
                aria-label="Slice index"
                type="range"
                min={0}
                max={grid[`n${view.axis}`] - 1}
                value={view.slice}
                onChange={(e) => change({ ...view, slice: +e.target.value })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
