import { http, HttpResponse } from 'msw';
import { encode } from 'fast-png';
import { baseUrl, decodeGrid } from '@/lib/api';
import {
  encodePlane,
  makePlane,
  pixels,
  type ColorMap,
  type Plane,
  type FrameView,
  type Run,
  type RequestBody,
} from '@/lib/model';
import {
  config,
  createField,
  fields,
  projectedFrame,
  frameVolume,
  runs,
  selectedPlane,
  start,
  statistics,
  tick,
  validate,
} from './store';
import { createNowcast, listNowcasts, removeNowcast, validParams } from './nowcasts';
import { netcdf } from './netcdf';
import { downsample } from './raster';

const url = (p: string) => baseUrl + p;
const missing = () =>
  HttpResponse.json({ detail: 'Record does not exist.' }, { status: 404 });
const conflict = (detail: string) => HttpResponse.json({ detail }, { status: 409 });
const invalid = (msg: string) =>
  HttpResponse.json(
    { detail: [{ loc: ['body'], msg, type: 'value_error' }] },
    { status: 422 },
  );
function list<T extends { id: string }>(items: T[], q: URLSearchParams) {
  const limit = Number(q.get('limit') ?? 50),
    cursor = q.get('cursor');
  items.reverse();
  const at = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0;
  return HttpResponse.json({
    items: items.slice(at, at + limit),
    next_cursor: at + limit < items.length ? items[at + limit - 1].id : null,
  });
}
function invalidDisplay(q: URLSearchParams) {
  const min = q.get('vmin'),
    max = q.get('vmax'),
    side = q.get('max_side');
  if (min !== null || max !== null) {
    if (
      !min ||
      !max ||
      !Number.isFinite(+min) ||
      !Number.isFinite(+max) ||
      +min >= +max
    )
      return invalid('Supply a finite minimum below the maximum.');
  }
  if (side !== null && (!Number.isInteger(+side) || +side < 16))
    return invalid('Invalid maximum image size.');
}
function planeOutput(
  p: Plane,
  q: URLSearchParams,
  png: boolean,
  range?: number[] | null,
) {
  if (png) {
    const map = (q.get('colormap') ?? 'viridis') as ColorMap;
    if (!config.colormaps.includes(map)) return invalid('Unknown colormap.');
    const stats = statistics(p, 'u', {}),
      min = Number(q.get('vmin') ?? range?.[0] ?? stats.min ?? 0),
      max = Number(q.get('vmax') ?? range?.[1] ?? stats.max ?? 1);
    const problem = invalidDisplay(q);
    if (problem) return problem;
    const sample = downsample(p, Number(q.get('max_side') ?? 0)),
      { nx, ny } = sample;
    return new HttpResponse(
      new Uint8Array(
        encode({
          width: nx,
          height: ny,
          channels: 4,
          data: pixels(sample, map, min, max),
        }),
      ).buffer,
      { headers: { 'Content-Type': 'image/png' } },
    );
  }
  const i0 = Number(q.get('i0') ?? 0),
    j0 = Number(q.get('j0') ?? 0),
    w = Math.min(p.nx - i0, Number(q.get('w') ?? p.nx)),
    h = Math.min(p.ny - j0, Number(q.get('h') ?? p.ny)),
    stride = Number(q.get('stride') ?? 1);
  if (
    ![i0, j0, w, h, stride].every(Number.isInteger) ||
    i0 < 0 ||
    j0 < 0 ||
    w < 1 ||
    h < 1 ||
    stride < 1
  )
    return invalid('Invalid value window.');
  const nx = Math.ceil(w / stride),
    ny = Math.ceil(h / stride);
  const data = Float32Array.from(
    { length: nx * ny },
    (_, k) =>
      p.data[(j0 + Math.floor(k / nx) * stride) * p.nx + i0 + (k % nx) * stride],
  );
  return new HttpResponse(encodePlane(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Nx': String(nx),
      'X-Ny': String(ny),
      'X-I0': String(i0),
      'X-J0': String(j0),
      'X-Stride': String(stride),
    },
  });
}
function readView(q: URLSearchParams, run: Run): FrameView | null {
  const axis = q.get('axis') ?? 'z',
    projection = q.get('projection') ?? 'none';
  if (
    (axis !== 'x' && axis !== 'y' && axis !== 'z') ||
    (projection !== 'none' && projection !== 'max' && projection !== 'mean')
  )
    return null;
  if (run.resolved.nz === 1) return {};
  if (projection !== 'none') return { axis, projection };
  const slice = q.has('slice')
    ? Number(q.get('slice'))
    : Math.floor(run.resolved[`n${axis}`] / 2);
  return Number.isInteger(slice) && slice >= 0 && slice < run.resolved[`n${axis}`]
    ? { axis, slice }
    : null;
}
const makeRun = (body: RequestBody) => {
  if (body.source.kind === 'field' && !fields.has(body.source.field_id))
    return missing();
  const v = validate(body);
  return v.resolved
    ? HttpResponse.json(start(body, v.resolved), { status: 202 })
    : HttpResponse.json({ detail: v.errors }, { status: 422 });
};
// Validate the wire shape before applying solver-specific checks.
function objectWithKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((k) => keys.includes(k))
  );
}
function isRequest(body: unknown): body is RequestBody {
  const numeric = [
    'dx',
    'dy',
    'dz',
    'Dz',
    'vz',
    'D',
    'vx',
    'vy',
    'dt',
    'steps',
    'out_every',
    'frames',
    'processes',
  ];
  if (
    !objectWithKeys(body, ['source', 'bc', 'units', 'name', ...numeric]) ||
    !Number.isFinite(body.dt) ||
    !Number.isInteger(body.steps)
  )
    return false;
  if (numeric.some((k) => k in body && !Number.isFinite(body[k]))) return false;
  if (
    body.bc !== undefined &&
    (!objectWithKeys(body.bc, ['left', 'right', 'top', 'bottom', 'front', 'back']) ||
      Object.values(body.bc).some(
        (v) => !['dirichlet', 'neumann', 'periodic'].includes(String(v)),
      ))
  )
    return false;
  if (
    body.name !== undefined &&
    (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120)
  )
    return false;
  if (
    body.units !== undefined &&
    (!objectWithKeys(body.units, ['length', 'time']) ||
      !['km', 'm', 'cell'].includes(String(body.units.length)) ||
      !['h', 's', 't'].includes(String(body.units.time)))
  )
    return false;
  const source = body.source;
  if (
    objectWithKeys(source, ['kind', 'preset', 'nx', 'ny', 'nz']) &&
    source.kind === 'preset'
  )
    return (
      (source.nz === undefined || Number.isInteger(source.nz)) &&
      Number.isInteger(source.nx) &&
      Number.isInteger(source.ny) &&
      config.presets.some((p) => p === source.preset)
    );
  if (
    !objectWithKeys(source, [
      'kind',
      'field_id',
      'var',
      'index',
      'fill_value',
      'volume',
      'replicate_z',
    ]) ||
    source.kind !== 'field' ||
    typeof source.field_id !== 'string'
  )
    return false;
  if (
    (source.volume !== undefined && typeof source.volume !== 'boolean') ||
    (source.replicate_z !== undefined && !Number.isInteger(source.replicate_z))
  )
    return false;
  if (source.var !== undefined && typeof source.var !== 'string') return false;
  if (source.fill_value != null && !Number.isFinite(source.fill_value)) return false;
  const index = source.index;
  return (
    index === undefined ||
    (!!index &&
      typeof index === 'object' &&
      !Array.isArray(index) &&
      Object.values(index).every(
        (i) => typeof i === 'number' && Number.isInteger(i) && i >= 0,
      ))
  );
}
async function runRequest(request: Request, validateOnly: boolean) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRequest(body)) return invalid('Malformed run request.');
  return validateOnly ? HttpResponse.json(validate(body)) : makeRun(body);
}
type ExportJob = { progress: number; file?: Blob; error?: string };
const exportCache = new WeakMap<import('@/lib/model').Run, Map<string, ExportJob>>();
export const handlers = [
  http.post(url('/nowcasts'), async ({ request }) => {
    const params: unknown = await request.json().catch(() => null);
    return validParams(params)
      ? HttpResponse.json(createNowcast(params), { status: 202 })
      : invalid(
          'Check coordinates, grid footprint, radius, hours, resolution and blend time.',
        );
  }),
  http.get(url('/nowcasts'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    const limit = Number(query.get('limit') ?? 50);
    return Number.isInteger(limit) && limit >= 1 && limit <= 200
      ? list([...listNowcasts().values()], query)
      : invalid('Limit must be between 1 and 200.');
  }),
  http.get(url('/nowcasts/:id'), ({ params }) => {
    const record = listNowcasts().get(String(params.id));
    return record ? HttpResponse.json(record) : missing();
  }),
  http.post(url('/nowcasts/:id/refresh'), ({ params }) => {
    const record = listNowcasts().get(String(params.id));
    return record
      ? HttpResponse.json(createNowcast(record.params), { status: 202 })
      : missing();
  }),
  http.delete(url('/nowcasts/:id'), ({ params }) =>
    removeNowcast(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : missing(),
  ),

  http.get(url('/health'), () =>
    HttpResponse.json({
      status: 'ok',
      engine: 'Mock MPI engine',
      api_version: '1.4.0',
    }),
  ),
  http.get(url('/config'), () => HttpResponse.json(config)),
  http.get(url('/fields'), ({ request }) => {
    tick();
    return list(
      [...fields.values()].map((f) => f.field),
      new URL(request.url).searchParams,
    );
  }),
  http.post(url('/fields'), async ({ request }) => {
    const form = await request.formData(),
      file = form.get('file');
    if (!file || typeof file === 'string') return invalid('Choose a NetCDF file.');
    const p = makePlane(640, 360);
    p.data = p.data.map((n, k) => (k % 167 === 0 ? NaN : 260 + n * 40));
    const field = createField(file.name, p, file);
    field.variables[0].spacing = {
      dx: 1500,
      dy: 2000,
      length_unit: 'm',
      approximate: true,
    };
    return HttpResponse.json(field, { status: 201 });
  }),
  http.post(url('/fields/drawn'), async ({ request }) => {
    const f = await request.formData(),
      data = f.get('data'),
      nx = Number(f.get('nx')),
      ny = Number(f.get('ny'));
    if (
      !data ||
      typeof data === 'string' ||
      ![nx, ny].every((x) => Number.isInteger(x) && x >= 4) ||
      data.size !== nx * ny * 4
    )
      return invalid('Invalid float32 drawing.');
    const p = decodeGrid(
      await data.arrayBuffer(),
      new Headers({ 'X-Nx': String(nx), 'X-Ny': String(ny) }),
    );
    if (p.data.some((v) => !Number.isFinite(v)))
      return invalid('Drawing must be finite.');
    return HttpResponse.json(createField(String(f.get('name') ?? 'drawn'), p), {
      status: 201,
    });
  }),
  http.get(url('/fields/:id'), ({ params }) => {
    tick();
    const f = fields.get(String(params.id));
    return f ? HttpResponse.json(f.field) : missing();
  }),
  http.delete(url('/fields/:id'), ({ params }) => {
    tick();
    const id = String(params.id);
    if (
      [...runs.values()].some(
        (r) =>
          (r.status === 'queued' || r.status === 'running') &&
          r.request.source.kind === 'field' &&
          r.request.source.field_id === id,
      )
    )
      return conflict('An active run uses this field.');
    return fields.delete(id) ? new HttpResponse(null, { status: 204 }) : missing();
  }),
  http.get(url('/fields/:id/:operation'), ({ params, request }) => {
    tick();
    const entry = fields.get(String(params.id));
    if (!entry) return missing();
    if (params.operation === 'original')
      return new HttpResponse(
        entry.original ?? netcdf(entry.plane.nx, entry.plane.ny, () => entry.plane),
        { headers: { 'Content-Type': 'application/x-netcdf' } },
      );
    if (entry.field.state === 'archived') return conflict('Field is archived.');
    const q = new URL(request.url).searchParams,
      index: Record<string, number> = {};
    for (const [k, v] of q) {
      const m = /^index\[(.+)\]$/.exec(k);
      if (m) index[m[1]] = +v;
    }
    try {
      const variable = q.get('var') ?? entry.field.default_var,
        p = selectedPlane(entry.field.id, variable, index);
      return params.operation === 'stats'
        ? HttpResponse.json(statistics(p, variable, index))
        : planeOutput(p, q, params.operation === 'preview.png');
    } catch (e) {
      return invalid(String(e));
    }
  }),
  http.post(url('/runs/validate'), ({ request }) => runRequest(request, true)),
  http.post(url('/runs'), ({ request }) => runRequest(request, false)),
  http.get(url('/runs'), ({ request }) => {
    tick();
    return list([...runs.values()], new URL(request.url).searchParams);
  }),
  http.get(url('/runs/:id'), ({ params }) => {
    tick();
    const r = runs.get(String(params.id));
    return r ? HttpResponse.json(r) : missing();
  }),
  http.delete(url('/runs/:id'), ({ params }) => {
    const removed = runs.delete(String(params.id));
    tick();
    return removed ? new HttpResponse(null, { status: 204 }) : missing();
  }),
  http.post(url('/runs/:id/rerun'), ({ params }) => {
    tick();
    const r = runs.get(String(params.id));
    return r ? makeRun(r.request) : missing();
  }),
  ...['/frames/:n.png', '/frames/:n/values', '/frames/:n/volume'].map((path, index) =>
    http.get(url('/runs/:id' + path), ({ params, request }) => {
      tick();
      const r = runs.get(String(params.id)),
        n = Number(params.n);
      if (
        !r ||
        r.status === 'expired' ||
        !Number.isInteger(n) ||
        n < 0 ||
        n >= r.resolved.expected_frames
      )
        return missing();
      if (n >= r.frames) return conflict('Frame not written.');
      const q = new URL(request.url).searchParams;
      if (index === 2) {
        const side = Number(q.get('max_side') ?? 64);
        if (!Number.isInteger(side) || side < 1 || side > 128)
          return invalid('Invalid volume sample size.');
        const v = frameVolume(r, n, side);
        return new HttpResponse(encodePlane(v.data), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Nx': String(v.nx),
            'X-Ny': String(v.ny),
            'X-Nz': String(v.nz),
          },
        });
      }
      const view = readView(q, r);
      if (!view) return invalid('Invalid frame view.');
      return planeOutput(projectedFrame(r, n, view), q, index === 0, r.display_range);
    }),
  ),
  http.get(url('/runs/:id/result.nc'), ({ params }) => {
    tick();
    const r = runs.get(String(params.id));
    if (!r || r.status === 'expired') return missing();
    if (r.status !== 'done') return conflict('Run is not complete.');
    if (r.resolved.estimated_output_bytes > 256 * 1024 ** 2)
      return HttpResponse.json(
        { detail: 'Mock NetCDF export exceeds the browser memory budget.' },
        { status: 507 },
      );
    return new HttpResponse(
      netcdf(
        r.resolved.nx,
        r.resolved.ny,
        (i) => frameVolume(r, i, Math.max(r.resolved.nx, r.resolved.ny, r.resolved.nz)),
        r.frames,
        r.resolved.nz,
      ),
    );
  }),
  http.get(url('/runs/:id/export.:format'), async ({ params, request }) => {
    tick();
    const r = runs.get(String(params.id));
    if (!r || r.status === 'expired') return missing();
    if (r.status !== 'done') return conflict('Run is not complete.');
    const format = params.format;
    if (format !== 'gif' && format !== 'mp4') return missing();
    const q = new URL(request.url).searchParams,
      fps = Number(q.get('fps') ?? 12),
      colormap = (q.get('colormap') ?? 'viridis') as ColorMap;
    if (
      !Number.isInteger(fps) ||
      fps < 1 ||
      fps > 60 ||
      !config.colormaps.includes(colormap)
    )
      return invalid('Invalid export settings.');
    const min = Number(q.get('vmin') ?? r.display_range?.[0] ?? 0),
      max = Number(q.get('vmax') ?? r.display_range?.[1] ?? 1);
    let jobs = exportCache.get(r);
    if (!jobs) {
      jobs = new Map();
      exportCache.set(r, jobs);
    }
    const problem = invalidDisplay(q);
    if (problem) return problem;
    const maxSide = Number(q.get('max_side') ?? 0);
    const view = readView(q, r);
    if (!view) return invalid('Invalid export view.');
    const key = request.url;
    let job = jobs.get(key);
    if (!job) {
      const pending: ExportJob = { progress: 0 };
      job = pending;
      jobs.set(key, pending);
      void import('./animation')
        .then((m) =>
          m.renderAnimation(
            r,
            format,
            { fps, colormap, min, max, maxSide, view },
            (v) => {
              pending.progress = v;
            },
          ),
        )
        .then((blob) => {
          pending.file = blob;
        })
        .catch((e) => {
          pending.error = String(e);
        });
    }
    if (job.error) {
      jobs.delete(key);
      return HttpResponse.json({ detail: job.error }, { status: 500 });
    }
    if (!job.file)
      return HttpResponse.json(
        { progress: job.progress },
        { status: 202, headers: { 'Retry-After': '1' } },
      );
    return new HttpResponse(job.file, {
      headers: {
        'Content-Type': job.file.type,
        'Content-Disposition': 'attachment; filename=simulation.' + format,
      },
    });
  }),
];
