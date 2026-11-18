import { useEffect, useState } from 'react';
import { UploadCloud, FileBox, PencilLine } from 'lucide-react';
import { api, checked, decodeGrid, message, upload } from '@/lib/api';
import {
  resizePlane,
  numberText,
  type ColorMap,
  type Plane,
  type PlaneSelection,
} from '@/lib/model';
import type { components } from '@/lib/schema';
import { DecimalInput } from './DecimalInput';
const coordinateText = (v: number | string) =>
  typeof v === 'number' ? numberText(v) : v;
type Stats = components['schemas']['PlaneStats'];
type Result = {
  selection: PlaneSelection;
  stats?: Stats;
  url?: string;
  error?: string;
  ready?: boolean;
};
export function useUploadPlane(
  selection: PlaneSelection | null,
  colormap: ColorMap,
): Partial<Result> {
  const [result, setResult] = useState<Result>();
  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    let url: string | undefined;
    const { field, variable, index } = selection;
    const params = { path: { fieldId: field.id }, query: { var: variable, index } };
    const archived = field.state === 'archived';
    async function fetchStats() {
      const result = await api.GET('/fields/{fieldId}/stats', {
        params,
        signal: controller.signal,
      });
      if (archived && result.response.status === 409) {
        if (
          variable === field.default_var &&
          Object.values(index).every((v) => v === 0)
        )
          return field.default_stats;
        return undefined;
      }
      return checked(result);
    }
    (async () => {
      const [stats, preview] = await Promise.all([
        fetchStats(),
        archived
          ? null
          : api
              .GET('/fields/{fieldId}/preview.png', {
                params: {
                  ...params,
                  query: { ...params.query, colormap, max_side: 1024 },
                },
                parseAs: 'blob',
                signal: controller.signal,
              })
              .then(checked),
      ]);
      if (!controller.signal.aborted) {
        url = preview ? URL.createObjectURL(preview) : undefined;
        setResult({ selection, stats, url, ready: true });
      }
    })().catch((e) => {
      if (!controller.signal.aborted) setResult({ selection, error: message(e) });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [selection, colormap]);
  if (!selection) return {};
  return result?.selection === selection ? result : {};
}
export function UploadControls({
  volume,
  onVolumeChange,
  selection,
  select,
  stats,
  fill,
  setFill,
  load,
  busy,
  setBusy,
  onError,
}: {
  selection: PlaneSelection | null;
  select: (s: PlaneSelection) => void;
  volume: boolean;
  onVolumeChange: (active: boolean) => void;
  stats?: Stats;
  fill: string;
  setFill: (v: string) => void;
  load: (p: Plane) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onError: (s: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  async function receive(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    onError('');
    try {
      const field = await upload(file);
      select({ field, variable: field.default_var, index: {} });
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function toCanvas() {
    if (!selection || !stats) return;
    setBusy(true);
    onError('');
    try {
      const stride = Math.max(1, Math.ceil(Math.max(stats.nx, stats.ny) / 512));
      const r = await api.GET('/fields/{fieldId}/values', {
        params: {
          path: { fieldId: selection.field.id },
          query: { var: selection.variable, index: selection.index, stride },
        },
        parseAs: 'arrayBuffer',
      });
      const p = decodeGrid(checked(r), r.response.headers);
      p.data.forEach((v, i) => {
        if (!Number.isFinite(v)) p.data[i] = Number(fill);
      });
      load(
        p.nx < 4 || p.ny < 4 ? resizePlane(p, Math.max(4, p.nx), Math.max(4, p.ny)) : p,
      );
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const variable = selection?.field.variables.find(
    (v) => v.name === selection.variable,
  );
  return (
    <div className="control-stack">
      <label
        className={'dropzone' + (drag ? ' dragging' : '')}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void receive(e.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={24} />
        <b>{busy ? 'Reading field…' : 'Choose a NetCDF file'}</b>
        <span>or drag and drop it here</span>
        <input
          aria-label="Upload NetCDF file"
          type="file"
          accept=".nc,.nc4,.cdf,.netcdf,.h5,.hdf5"
          disabled={busy}
          onChange={(e) => {
            void receive(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {selection && variable && (
        <>
          <div className="file-name">
            <FileBox size={16} />
            {selection.field.name}
          </div>
          <label>
            Variable
            <select
              value={selection.variable}
              onChange={(e) =>
                select({
                  ...selection,
                  variable: e.target.value,
                  index: {},
                  volume: false,
                })
              }
            >
              {selection.field.variables.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                  {v.units ? ' · ' + v.units : ''}
                </option>
              ))}
            </select>
          </label>
          {variable.z_dim && variable.nz > 1 && (
            <button
              className="secondary"
              aria-pressed={volume}
              onClick={() => onVolumeChange(!volume)}
            >
              Use as volume · {variable.nz} layers
            </button>
          )}
          {variable.extra_dims
            .filter((d) => !volume || d.name !== variable.z_dim)
            .map((d) => (
              <label key={d.name}>
                {d.name} index{' '}
                {d.size > 200 &&
                  d.values?.[selection.index[d.name] ?? 0] !== undefined &&
                  ' · ' + coordinateText(d.values[selection.index[d.name] ?? 0])}
                {d.size <= 200 ? (
                  <select
                    value={selection.index[d.name] ?? 0}
                    onChange={(e) =>
                      select({
                        ...selection,
                        index: { ...selection.index, [d.name]: +e.target.value },
                      })
                    }
                  >
                    {Array.from({ length: d.size }, (_, i) => (
                      <option value={i} key={i}>
                        {i}
                        {d.values?.[i] !== undefined
                          ? ' · ' + coordinateText(d.values[i])
                          : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={d.size - 1}
                    step={1}
                    value={selection.index[d.name] ?? 0}
                    onChange={(e) => {
                      if (e.target.validity.valid && e.target.value)
                        select({
                          ...selection,
                          index: { ...selection.index, [d.name]: +e.target.value },
                        });
                    }}
                  />
                )}
              </label>
            ))}
          {variable.spacing?.approximate && (
            <p className="hint">Coordinate spacing is approximate.</p>
          )}
          {selection.field.state === 'archived' && (
            <p className="hint">Archived field. Starting a run reactivates it.</p>
          )}
          {stats && (
            <p className="hint">
              {volume && 'Preview plane · '}
              {stats.missing_count.toLocaleString()} missing cells · mean{' '}
              {stats.mean == null ? 'unavailable' : numberText(stats.mean)}
            </p>
          )}
          {(volume ||
            !!stats?.missing_count ||
            (!stats && selection.field.state === 'archived')) && (
            <label>
              Missing-cell fill value
              <DecimalInput
                placeholder="Enter a finite value"
                value={fill}
                onEdit={setFill}
              />
            </label>
          )}
          {selection.field.state === 'active' && !volume && (
            <button
              className="secondary"
              disabled={
                busy ||
                !stats ||
                (!!stats.missing_count && (!fill || !Number.isFinite(Number(fill))))
              }
              onClick={toCanvas}
            >
              <PencilLine size={15} />
              Load into canvas
            </button>
          )}
        </>
      )}
    </div>
  );
}
