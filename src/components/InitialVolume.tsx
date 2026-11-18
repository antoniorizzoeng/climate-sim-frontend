import { useEffect, useMemo, useRef, useState } from 'react';
import { drawingVolume, uploadedVolume } from '@/lib/initialVolume';
import { message } from '@/lib/api';
import type { ColorMap, Conditions, Plane, PlaneSelection, Volume } from '@/lib/model';
import { createVolumeScene } from '@/lib/volumeScene';
import { Viewport } from './Viewport';

function Scene({
  volume,
  extent,
  map,
  min,
  max,
}: {
  volume: Volume;
  extent: number[];
  map: ColorMap;
  min: number;
  max: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createVolumeScene> | null>(null);
  const [error, setError] = useState('');
  const [x, y, z] = extent;
  useEffect(() => {
    const el = host.current!;
    function lost(e: Event) {
      e.preventDefault();
      setError('WebGL2 context lost. Reopen the 3D preview.');
    }
    el.addEventListener('webglcontextlost', lost, true);
    let active = true;
    try {
      scene.current = createVolumeScene(el, [x, y, z]);
    } catch (e) {
      queueMicrotask(() => {
        if (active) setError(message(e));
      });
    }
    return () => {
      active = false;
      el.removeEventListener('webglcontextlost', lost, true);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [x, y, z]);
  useEffect(() => {
    scene.current?.appearance(map, min, max, 0.65, 0.025);
    scene.current?.frame(volume);
  }, [x, y, z, volume, map, min, max]);
  return (
    <>
      <div className="volume-scene" ref={host} />
      {error && (
        <div role="status" className="plot-message">
          {error}
        </div>
      )}
    </>
  );
}

export default function InitialVolume({
  plane,
  selection,
  model,
  gaussian,
  map,
  range,
  fill,
  controls,
}: {
  plane?: Plane;
  selection: PlaneSelection | null;
  model: Conditions;
  gaussian: boolean;
  map: ColorMap;
  range: number[];
  fill?: number;
  controls: React.ReactNode;
}) {
  const variable = selection?.field.variables.find(
    (v) => v.name === selection.variable,
  );
  const layers = model.nz ?? 1;
  const drawn = useMemo(
    () => plane && drawingVolume(plane, model, gaussian),
    [plane, model, gaussian],
  );
  const [result, setResult] = useState<{
    selection: PlaneSelection;
    layers: number;
    volume?: Volume;
    error?: string;
  }>();
  useEffect(() => {
    if (!selection || !variable || selection.field.state === 'archived') return;
    const ctrl = new AbortController();
    uploadedVolume(selection, variable, layers, ctrl.signal)
      .then((volume) => {
        if (!ctrl.signal.aborted) setResult({ selection, layers, volume });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setResult({ selection, layers, error: message(e) });
      });
    return () => ctrl.abort();
  }, [selection, variable, layers]);
  const current =
    result?.selection === selection && result?.layers === layers ? result : undefined;
  const sampled = useMemo(() => {
    if (!current?.volume) return;
    const volume = {
      ...current.volume,
      data: current.volume.data.map((v) => (Number.isFinite(v) ? v : (fill ?? NaN))),
    };
    let min = Infinity,
      max = -Infinity;
    for (const v of volume.data)
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    return { volume, range: Number.isFinite(min) ? [min, max] : [0, 1] };
  }, [current, fill]);
  const volume = drawn ?? sampled?.volume;
  const limits = sampled?.range ?? range;
  const nx = plane?.nx ?? variable?.nx ?? 1,
    ny = plane?.ny ?? variable?.ny ?? 1;
  return (
    <Viewport
      nx={nx}
      ny={ny}
      nz={layers}
      map={map}
      range={limits}
      mode="Initial field"
      headerControls={controls}
      readout="Drag to orbit · Scroll or pinch to zoom"
    >
      <div className="volume-stage">
        {volume ? (
          <Scene
            volume={volume}
            extent={[
              nx * (model.dx ?? 1),
              ny * (model.dy ?? 1),
              layers * (model.dz ?? 1),
            ]}
            map={map}
            min={limits[0]}
            max={limits[1]}
          />
        ) : (
          <div role="status" className="plot-message">
            {current?.error ??
              (selection?.field.state === 'archived'
                ? 'Archived · preview unavailable'
                : selection
                  ? 'Loading volume…'
                  : 'Upload a field to preview its values.')}
          </div>
        )}
      </div>
    </Viewport>
  );
}
