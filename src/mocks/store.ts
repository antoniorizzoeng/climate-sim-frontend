import { bytes } from '@/lib/history';
import type { components } from '@/lib/schema';
import {
  dtMax,
  makePlane,
  type Config,
  type FrameView,
  type Volume,
  type Field,
  type Plane,
  type RequestBody,
  type Run,
} from '@/lib/model';
type S = components['schemas'];
export const config: Config = {
  cpu_count: 8,
  default_processes: 8,
  colormaps: [
    'viridis',
    'inferno',
    'magma',
    'plasma',
    'cividis',
    'turbo',
    'coolwarm',
    'gray',
  ],
  presets: ['gaussian_hotspot', 'constant_zero'],
  supported_boundary_conditions: ['dirichlet', 'neumann', 'periodic'],
  disk_free_bytes: 128 * 1024 ** 2,
  retention: { active_days: 7, archive_days: 30 },
};
const day = 86400000,
  date = (t: number) => new Date(t).toISOString(),
  // Same format as the backend's default run names: "18 Nov 10:32 UTC".
  runStamp = (t: number) => {
    const d = new Date(t);
    const two = (n: number) => String(n).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    return `${two(d.getUTCDate())} ${month} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
  },
  id = () => crypto.randomUUID().replaceAll('-', '');
export const fields = new Map<
  string,
  { field: Field; plane: Plane; originalName: string; original?: File }
>();
export const runs = new Map<string, Run>();
const snapshots = new WeakMap<Run, Plane[]>();
export function statistics(
  p: Plane,
  variable: string,
  index: Record<string, number>,
): S['PlaneStats'] {
  let min = Infinity,
    max = -Infinity,
    sum = 0,
    count = 0;
  for (const v of p.data)
    if (Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      count++;
    }
  return {
    var: variable,
    index,
    nx: p.nx,
    ny: p.ny,
    min: count ? min : null,
    max: count ? max : null,
    mean: count ? sum / count : null,
    missing_count: p.data.length - count,
  };
}
export function createField(name: string, plane: Plane, original?: File) {
  const variable = original ? 'temperature' : 'u',
    now = Date.now(),
    { nx, ny } = plane;
  const field: Field = {
    id: id(),
    name,
    source: original ? 'upload' : 'drawn',
    created_at: date(now),
    last_used_at: date(now),
    state: 'active',
    expires_at: date(now + 7 * day),
    size_bytes: (original?.size ?? 0) + plane.data.byteLength,
    variables: [
      {
        name: variable,
        nz: original ? 2 : 1,
        ...(original && { z_dim: 'level' }),
        nx,
        ny,
        units: original ? 'K' : null,
        extra_dims: original
          ? [
              { name: 'time', size: 3, values: ['00:00', '06:00', '12:00'] },
              { name: 'level', size: 2, values: [850, 500] },
            ]
          : [],
      },
    ],
    default_var: variable,
    default_stats: statistics(plane, variable, {}),
  };
  if (original)
    field.variables.push({
      name: 'humidity',
      nx,
      ny,
      nz: 1,
      units: '%',
      extra_dims: [],
    });
  fields.set(field.id, {
    field,
    plane,
    original,
    originalName: original?.name ?? name + '.nc',
  });
  return field;
}
export function selectedPlane(
  fieldId: string,
  variable?: string,
  index: Record<string, number> = {},
): Plane {
  const entry = fields.get(fieldId);
  if (!entry) throw new Error('Field does not exist.');
  const v = entry.field.variables.find(
    (v) => v.name === (variable ?? entry.field.default_var),
  );
  if (!v) throw new Error('Unknown variable.');
  for (const [key, i] of Object.entries(index)) {
    const d = v.extra_dims.find((d) => d.name === key);
    if (!d || !Number.isInteger(i) || i < 0 || i >= d.size)
      throw new Error('Invalid ' + key + ' index.');
  }
  if (entry.field.source === 'drawn') return entry.plane;
  const { nx, ny, data } = entry.plane;
  return {
    nx,
    ny,
    data: data.map((n) =>
      v.name === 'humidity'
        ? (n - 260) * 2
        : n + (index.time ?? 0) * 3 - (index.level ?? 0) * 6,
    ),
  };
}
export function validate(body: RequestBody): S['RunValidation'] {
  const errors: S['ValidationIssue'][] = [];
  const add = (key: string, msg: string) =>
    errors.push({ loc: ['body', key], type: 'value_error', msg });
  const warnings: string[] = [];
  let nx = 0,
    ny = 0,
    nz = 1;
  if (body.source?.kind === 'field') {
    try {
      const source = body.source;
      const field = fields.get(source.field_id)!.field;
      const variable = field.variables.find(
        (v) => v.name === (source.var ?? field.default_var),
      )!;
      if (source.volume && variable.z_dim && (source.replicate_z ?? 1) > 1)
        add('source', 'Select a vertical variable or extrude a plane.');
      const index = { ...source.index };
      if (source.volume && variable.z_dim) delete index[variable.z_dim];
      const p = selectedPlane(source.field_id, source.var, index);
      nz = source.volume && variable.z_dim ? variable.nz : (source.replicate_z ?? 1);
      nx = p.nx;
      ny = p.ny;
      if (
        p.data.some((v) => !Number.isFinite(v)) &&
        !Number.isFinite(body.source.fill_value)
      )
        add('fill_value', 'A finite fill value is required.');
    } catch (e) {
      add('source', String(e));
    }
  } else if (
    body.source?.kind === 'preset' &&
    config.presets.includes(body.source.preset)
  ) {
    nx = body.source.nx;
    ny = body.source.ny;
    nz = body.source.nz ?? 1;
  } else add('source', 'Select a supported source.');
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 4 || ny < 4)
    add('source', 'Grid dimensions must be at least four.');
  if (!Number.isSafeInteger(nz) || nz < 1)
    add('source', 'Depth must be a positive integer.');
  if ((body.dz ?? 1) <= 0 || (body.Dz ?? 0) < 0)
    add('dz', 'Check vertical diffusion and spacing.');
  if (!(body.dt > 0)) add('dt', 'Time step must be positive.');
  if (!Number.isInteger(body.steps) || body.steps < 1 || body.steps > 2147483647)
    add('steps', 'Invalid step count.');
  if ((body.dx ?? 1) <= 0 || (body.dy ?? 1) <= 0 || (body.D ?? 0) < 0)
    add('D', 'Check diffusion and grid spacing.');
  if (
    body.frames !== undefined &&
    (!Number.isInteger(body.frames) || body.frames < 2 || body.out_every !== undefined)
  )
    add('frames', 'Choose at least two frames or supply out_every alone.');
  if (
    body.out_every !== undefined &&
    (!Number.isInteger(body.out_every) || body.out_every < 1)
  )
    add('out_every', 'Invalid output interval.');
  const dt_max = dtMax({ ...body, nz });
  if (dt_max !== null && body.dt > dt_max)
    add('dt', 'Time step exceeds the stability limit.');
  const bc = body.bc ?? {};
  if (Object.values(bc).some((v) => !config.supported_boundary_conditions.includes(v)))
    add('bc', 'Unsupported boundary condition.');
  if (
    (bc.left === 'periodic') !== (bc.right === 'periodic') ||
    (bc.top === 'periodic') !== (bc.bottom === 'periodic') ||
    (bc.front === 'periodic') !== (bc.back === 'periodic')
  )
    add('bc', 'Periodic edges must be paired.');
  const fits = (r: number) => {
    if (nz > 1) {
      for (let x = 1; x <= Math.min(nx, r); x++)
        for (let y = 1; y <= Math.min(ny, r / x); y++)
          if (r % (x * y) === 0 && r / (x * y) <= nz) return true;
      return false;
    }
    let a = Math.floor(Math.sqrt(r));
    while (r % a !== 0) a--;
    return (a <= nx && r / a <= ny) || (a <= ny && r / a <= nx);
  };
  let processes =
    body.processes ??
    Math.min(config.cpu_count, Math.max(1, Math.floor((nx * ny * nz) / 131072)));
  if (body.processes === undefined) {
    while (processes > 1 && !fits(processes)) processes--;
  } else if (
    !Number.isInteger(processes) ||
    processes < 1 ||
    processes > config.cpu_count ||
    !fits(processes)
  )
    add('processes', 'Rank grid must fit the field and CPU count.');
  if (errors.length) return { ok: false, errors, warnings, resolved: null };
  const out_every =
      body.out_every ?? Math.ceil(body.steps / ((body.frames ?? 101) - 1)),
    expected_frames = 1 + Math.ceil(body.steps / out_every),
    cells = nx * ny * nz,
    estimated_output_bytes = 8 * cells * expected_frames + 1024,
    estimated_memory_bytes = 28 * cells + 64 * 1024 ** 2 + 16 * 1024 ** 2 * processes,
    memory_capacity_bytes = 6.8e9;
  if (estimated_output_bytes > config.disk_free_bytes)
    warnings.push('Estimated output exceeds available disk space.');
  if (estimated_memory_bytes > memory_capacity_bytes)
    add(
      'source',
      `Needs about ${bytes(estimated_memory_bytes, true)} of memory; this server can give the engine ${bytes(memory_capacity_bytes, true)}. Use fewer layers or a smaller grid.`,
    );
  return {
    ok: !errors.length,
    errors,
    warnings,
    resolved: {
      nx,
      ny,
      nz,
      dz: body.dz ?? 1,
      steps: body.steps,
      dt: body.dt,
      dt_max,
      processes,
      out_every,
      expected_frames,
      estimated_output_bytes,
      estimated_memory_bytes,
      memory_capacity_bytes,
    },
  };
}
export function tick(now = Date.now()) {
  let occupied = false,
    position = 0;
  for (const r of runs.values()) {
    if (r.status === 'queued' && !occupied) {
      r.status = 'running';
      r.started_at = date(now);
      r.queue_position = null;
    }
    if (r.status === 'running') {
      const elapsed = Math.max(0, (now - Date.parse(r.started_at!)) / 1000);
      r.elapsed_seconds = Math.min(elapsed, 4);
      r.step = Math.min(r.resolved.steps, Math.floor((elapsed / 4) * r.resolved.steps));
      r.time = r.step * r.resolved.dt;
      r.frames = 1 + Math.floor(r.step / r.resolved.out_every);
      if (r.step === r.resolved.steps) {
        r.status = 'done';
        r.frames = r.resolved.expected_frames;
        r.finished_at = date(Date.parse(r.started_at!) + 4000);
        r.expires_at = date(Date.parse(r.finished_at) + 7 * day);
      } else occupied = true;
    }
    r.size_bytes = r.frames * r.resolved.nx * r.resolved.ny * r.resolved.nz * 4;
    if (r.status === 'queued') r.queue_position = ++position;
    if (r.expires_at && Date.parse(r.expires_at) <= now) {
      if (r.status !== 'expired') {
        r.status = 'expired';
        r.frames = 0;
        r.size_bytes = 0;
        r.expires_at = date(Date.parse(r.finished_at!) + 37 * day);
      }
      if (Date.parse(r.expires_at) <= now) runs.delete(r.id);
    }
  }
  for (const { field } of fields.values()) {
    const age = now - Date.parse(field.last_used_at ?? field.created_at);
    if (age >= 37 * day) fields.delete(field.id);
    else if (age >= 7 * day) {
      field.state = 'archived';
      field.expires_at = date(
        Date.parse(field.last_used_at ?? field.created_at) + 37 * day,
      );
    }
  }
}
export function initial(body: RequestBody, level?: number): Plane {
  const s = body.source;
  if (s.kind === 'preset' && s.nz && s.nz > 1 && s.preset === 'gaussian_hotspot') {
    const { nx, ny, nz } = s,
      dx = body.dx ?? 1,
      dy = body.dy ?? 1,
      dz = body.dz ?? 1;
    const sigma = 0.05 * Math.min(nx * dx, ny * dy, nz * dz);
    return {
      nx,
      ny,
      data: Float32Array.from({ length: nx * ny }, (_, i) => {
        const x = ((i % nx) + 0.5 - nx / 2) * dx,
          y = (Math.floor(i / nx) + 0.5 - ny / 2) * dy;
        return Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      }),
    };
  }
  if (s.kind === 'preset')
    return makePlane(s.nx, s.ny, s.preset === 'constant_zero' ? 'Clear' : 'Hotspot');
  const p = selectedPlane(
    s.field_id,
    s.var,
    level === undefined ? s.index : { ...s.index, level },
  );
  return {
    ...p,
    data: p.data.map((v) => (Number.isFinite(v) ? v : (s.fill_value ?? 0))),
  };
}
export function start(body: RequestBody, resolved: Run['resolved']): Run {
  // The mock upload has descending pressure levels. The API returns ascending z.
  const layers =
    body.source.kind === 'field' &&
    body.source.volume &&
    resolved.nz === 2 &&
    body.source.replicate_z !== 2
      ? [initial(body, 1), initial(body, 0)]
      : [initial(body)];
  const stats = layers.map((plane) => statistics(plane, 'u', {}));
  const fixed = (['left', 'right', 'top', 'bottom', 'front', 'back'] as const).some(
    (k) =>
      (resolved.nz > 1 || (k !== 'front' && k !== 'back')) &&
      (body.bc?.[k] ?? 'dirichlet') === 'dirichlet',
  );
  const now = Date.now();
  const r: Run = {
    id: id(),
    name:
      body.name?.trim() ||
      (body.source.kind === 'preset'
        ? body.source.preset.replaceAll('_', ' ')
        : fields.get(body.source.field_id)!.field.name) +
        ' · ' +
        runStamp(now),
    size_bytes: 0,
    status: 'queued',
    created_at: date(now),
    expires_at: null,
    request: body,
    resolved,
    step: 0,
    time: 0,
    frames: 0,
    queue_position: null,
    display_range: [
      Math.min(...stats.map((s) => s.min!), fixed ? 0 : Infinity),
      Math.max(...stats.map((s) => s.max!), fixed ? 0 : -Infinity),
    ],
    message: null,
  };
  if (body.source.kind === 'field') {
    const f = fields.get(body.source.field_id)!.field;
    f.last_used_at = date(now);
    f.state = 'active';
    f.expires_at = date(now + 7 * day);
  }
  snapshots.set(r, layers);
  runs.set(r.id, r);
  tick(now);
  return r;
}
// A deterministic visual stand-in for MPI, used only by MSW.
export function framePlane(r: Run, n: number, layer = 0): Plane {
  const p = snapshots.get(r)?.[layer] ?? initial(r.request);
  if (!n) return p;
  const { nx, ny } = p,
    dt = Math.min(n * r.resolved.out_every, r.resolved.steps) * r.resolved.dt;
  const shiftX = (dt * (r.request.vx ?? 0)) / (r.request.dx ?? 1),
    shiftY = (dt * (r.request.vy ?? 0)) / (r.request.dy ?? 1);
  const radius = Math.min(Math.min(nx, ny) / 4, Math.sqrt((r.request.D ?? 0) * dt));
  function coord(v: number, limit: number, lo: 'left' | 'bottom', hi: 'right' | 'top') {
    if (v >= 0 && v < limit) return v;
    const bc = r.request.bc?.[v < 0 ? lo : hi] ?? 'dirichlet';
    return bc === 'periodic'
      ? ((v % limit) + limit) % limit
      : bc === 'neumann'
        ? Math.max(0, Math.min(limit - 1, v))
        : -1;
  }
  function sample(x: number, y: number) {
    const i = coord(Math.round(x), nx, 'left', 'right'),
      j = coord(Math.round(y), ny, 'bottom', 'top');
    return i < 0 || j < 0 ? 0 : p.data[j * nx + i];
  }
  return {
    nx,
    ny,
    data: p.data.map((_, k) => {
      const x = (k % nx) - shiftX,
        y = Math.floor(k / nx) - shiftY;
      return (
        (4 * sample(x, y) +
          sample(x - radius, y) +
          sample(x + radius, y) +
          sample(x, y - radius) +
          sample(x, y + radius)) /
        8
      );
    }),
  };
}

// The demo advances a horizontal plane once per frame and samples the vertical
// profile separately. Keep mock PNGs, readouts and volumes on the same grid.
function volumeSampler(run: Run, n: number) {
  const layers = (snapshots.get(run) ?? [initial(run.request)]).map((_, z) =>
    framePlane(run, n, z),
  );
  const plane = layers[0];
  const { nx, ny, nz, dz } = run.resolved;
  const { source, D = 0, Dz = D, vz = 0, dx = 1, dy = 1 } = run.request;
  const time =
    Math.min(n * run.resolved.out_every, run.resolved.steps) * run.resolved.dt;
  const sigma = 0.05 * Math.min(nx * dx, ny * dy, nz * dz);
  const spread = Math.sqrt(sigma * sigma + 2 * Dz * time);
  return (x: number, y: number, z: number) => {
    const v = plane.data[y * nx + x];
    if (nz === 1) return v;
    let layer = z - (vz * time) / dz;
    if (run.request.bc?.front === 'periodic') layer = ((layer % nz) + nz) % nz;
    if (source.kind === 'preset') {
      const height = (layer + 0.5 - nz / 2) * dz;
      return (
        ((v * sigma) / spread) * Math.exp((-height * height) / (2 * spread * spread))
      );
    }
    if (layers.length > 1)
      return layers[Math.max(0, Math.min(nz - 1, Math.round(layer)))].data[y * nx + x];
    const diffusion = Math.sqrt(Dz * time) / dz;
    const distance = Math.min(layer + 0.5, nz - 0.5 - layer);
    const face = layer < nz / 2 ? 'front' : 'back';
    return (run.request.bc?.[face] ?? 'dirichlet') === 'dirichlet' && diffusion > 0
      ? v * Math.max(0, Math.min(1, distance / diffusion))
      : v;
  };
}
export function frameVolume(run: Run, n: number, maxSide: number): Volume {
  const grid = run.resolved;
  const stride = Math.ceil(Math.max(grid.nx, grid.ny, grid.nz) / maxSide);
  const nx = Math.ceil(grid.nx / stride),
    ny = Math.ceil(grid.ny / stride),
    nz = Math.ceil(grid.nz / stride);
  const sample = volumeSampler(run, n);
  return {
    nx,
    ny,
    nz,
    data: Float32Array.from({ length: nx * ny * nz }, (_, i) =>
      sample(
        (i % nx) * stride,
        (Math.floor(i / nx) % ny) * stride,
        Math.floor(i / (nx * ny)) * stride,
      ),
    ),
  };
}
export function projectedFrame(run: Run, n: number, view: FrameView): Plane {
  const { axis = 'z', slice, projection } = view;
  const grid = run.resolved;
  if (grid.nz === 1) return framePlane(run, n);
  const sample = volumeSampler(run, n);
  const nx = axis === 'x' ? grid.ny : grid.nx,
    ny = axis === 'z' ? grid.ny : grid.nz;
  const depth = grid[`n${axis}`];
  const data = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const value = (k: number) =>
        axis === 'z'
          ? sample(i, j, k)
          : axis === 'y'
            ? sample(i, k, j)
            : sample(k, i, j);
      if (!projection) data[j * nx + i] = value(slice ?? Math.floor(depth / 2));
      else {
        let total = projection === 'max' ? -Infinity : 0;
        for (let k = 0; k < depth; k++)
          total = projection === 'max' ? Math.max(total, value(k)) : total + value(k);
        data[j * nx + i] = projection === 'mean' ? total / depth : total;
      }
    }
  return { nx, ny, data };
}
