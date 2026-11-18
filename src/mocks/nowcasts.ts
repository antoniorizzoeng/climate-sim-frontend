import {
  defaultBlendTauHours,
  layerNames,
  reachesPole,
  skyDefaults,
  tenMinutes,
  validCoordinates,
  type Nowcast,
  type NowcastParams,
  type SiteSample,
} from '@/lib/sky';
import type { RequestBody, Run } from '@/lib/model';
import { createField, fields, runs, start, tick, validate } from './store';

const records = new Map<string, Nowcast>();
const week = 7 * 86400000;
export function validParams(body: unknown): body is NowcastParams {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const defaults = { ...skyDefaults, blend_tau_hours: defaultBlendTauHours };
  const p = { ...defaults, ...body } as NowcastParams & typeof defaults;
  return (
    Object.keys(body).every((k) =>
      [
        'lat',
        'lon',
        'window',
        'hours',
        'resolution',
        'radius_km',
        'blend_tau_hours',
      ].includes(k),
    ) &&
    (p.window === undefined || p.window === 'now' || p.window === 'tonight') &&
    validCoordinates(p.lat, p.lon) &&
    Number.isFinite(p.radius_km) &&
    p.radius_km >= 50 &&
    p.radius_km <= 1000 &&
    !reachesPole(p.lat, p.radius_km) &&
    Number.isInteger(p.hours) &&
    p.hours >= 1 &&
    p.hours <= 12 &&
    Number.isInteger(p.resolution) &&
    p.resolution >= 16 &&
    p.resolution <= 256 &&
    Number.isFinite(p.blend_tau_hours) &&
    p.blend_tau_hours > 0
  );
}

// Approximate solar night and synthetic Moon samples for the browser demo.
export function mockNight(p: NowcastParams, now: number): Nowcast['night'] {
  const hour = 3600000;
  const start = Math.floor(now / hour) * hour;
  const day = Math.floor(start / (24 * hour));
  const rad = Math.PI / 180;
  const ordinal =
    (start - Date.UTC(new Date(start).getUTCFullYear(), 0, 1)) / (24 * hour);
  const declination = -23.44 * rad * Math.cos((2 * Math.PI * (ordinal + 10)) / 365.25);
  const latitude = p.lat * rad;
  const cosAngle =
    (Math.sin(-18 * rad) - Math.sin(latitude) * Math.sin(declination)) /
    (Math.cos(latitude) * Math.cos(declination));
  if (cosAngle <= -1) return null;
  const halfDay = Math.acos(Math.min(1, cosAngle)) / (15 * rad);
  const noon = (day * 24 + 12 - p.lon / 15) * hour;
  let dusk = noon + halfDay * hour,
    dawn = noon + (24 - halfDay) * hour;
  while (dawn <= start) {
    dusk += 24 * hour;
    dawn += 24 * hour;
  }
  while (dawn - 24 * hour > start) {
    dusk -= 24 * hour;
    dawn -= 24 * hour;
  }
  const end = Math.min(
    dawn,
    start + (p.window === 'tonight' ? 24 : (p.hours ?? 6)) * hour,
  );
  if (dusk > end) return null;
  const moon = [];
  for (let t = Math.max(start, dusk); t <= end; t += tenMinutes)
    moon.push({
      time: new Date(t).toISOString(),
      illumination: 0.68,
      altitude_deg: 50 * Math.sin(((t - dusk) / (12 * hour)) * Math.PI - 0.5),
    });
  return {
    dusk: new Date(dusk).toISOString(),
    dawn: new Date(dawn).toISOString(),
    moon,
  };
}

export function createNowcast(input: NowcastParams) {
  const params = { ...skyDefaults, blend_tau_hours: defaultBlendTauHours, ...input };
  const now = Date.now(),
    n = params.resolution,
    dx = (2000 * params.radius_km) / n;
  const half = (((dx * (n - 1)) / 2 / 6371000) * 180) / Math.PI;
  const record: Nowcast = {
    id: crypto.randomUUID(),
    status: 'fetching',
    created_at: new Date(now).toISOString(),
    params,
    data_time: null,
    layers: [],
    site: null,
    best_window: null,
    night: null,
    message: null,
    expires_at: new Date(now + week).toISOString(),
    grid: {
      nx: n,
      ny: n,
      dx_m: dx,
      dy_m: dx,
      lat0: params.lat - half,
      lon0:
        ((params.lon - half / Math.cos((params.lat * Math.PI) / 180) + 540) % 360) -
        180,
    },
  };
  records.set(record.id, record);
  return record;
}

function prepare(record: Nowcast) {
  const { nx: n, dx_m: dx } = record.grid;

  record.data_time = new Date(
    Math.floor(Date.parse(record.created_at) / 3600000) * 3600000,
  ).toISOString();
  const startTime = Date.parse(record.data_time);
  record.night = mockNight(record.params, startTime);
  const steps =
    record.params.window === 'tonight' && record.night
      ? Math.max(
          1,
          Math.min(
            144,
            Math.ceil((Date.parse(record.night.dawn) - startTime) / tenMinutes),
          ),
        )
      : (record.params.hours ?? skyDefaults.hours) * 6;
  record.layers = layerNames.map((layer, i) => {
    const data = Float32Array.from({ length: n * n }, (_, k) => {
      const x = ((k % n) + 0.5) / n,
        y = (Math.floor(k / n) + 0.5) / n;
      const band = Math.cos(11 * x + 1.8 * Math.sin(6 * y + i) + i * 0.7);
      return 0.02 + (0.85 - i * 0.19) * ((1 + band) / 2) ** 4;
    });
    const field = createField('Sky nowcast ' + layer, { nx: n, ny: n, data });
    const body: RequestBody = {
      source: { kind: 'field', field_id: field.id },
      dt: 600,
      steps,
      out_every: 1,
      dx,
      dy: dx,
      vx: (dx / 600) * ((n * 0.65) / steps),
      vy: 0,
      D: 0,
      bc: { left: 'neumann', right: 'neumann', top: 'neumann', bottom: 'neumann' },
    };
    // The mock translates directly in grid coordinates. Subdivide the solver step to meet CFL.
    const substeps = Math.max(1, Math.ceil((n * 0.65) / steps));
    body.steps *= substeps;
    body.dt /= substeps;
    body.out_every = substeps;
    const resolved = validate(body).resolved;
    if (!resolved) throw new Error('Invalid mock cloud transport parameters.');
    return {
      layer,
      run_id: start(body, resolved).id,
      pressure_hpa: ([850, 500, 300] as const)[i],
    };
  });
  record.status = 'queued';
}

// For pure eastward translation with zero-gradient edges, sample the same source cells as framePlane.
function centre(run: Run, frame: number) {
  if (run.request.source.kind !== 'field') return 0;
  const plane = fields.get(run.request.source.field_id)!.plane,
    n = plane.nx;
  const shift =
    (frame * run.resolved.out_every * run.resolved.dt * run.request.vx!) /
    run.request.dx!;
  const middle = [Math.floor((n - 1) / 2), Math.floor(n / 2)];
  let sum = 0;
  for (const j of middle)
    for (const i of middle)
      sum += plane.data[j * n + Math.max(0, Math.round(i - shift))];
  return sum / 4;
}
function samples(record: Nowcast, children: Run[]): SiteSample[] {
  const initial = Date.parse(record.data_time!);
  const tau = record.params.blend_tau_hours ?? defaultBlendTauHours;
  return Array.from({ length: children[0].frames }, (_, i) => {
    const [low, mid, high] = children.map((run) => centre(run, i));
    const clear = (1 - low) * (1 - mid) * (1 - high),
      hour = Math.floor(i / 6);
    const jet_ms = [16, 22.5, 18, 14, 28, 38, 24][hour % 7];
    const modelCover = (offset: number) => {
      const value = (h: number) =>
        0.12 + (0.25 * (1 + Math.cos(h * 1.15 + offset))) / 2;
      return value(hour) + ((value(hour + 1) - value(hour)) * (i % 6)) / 6;
    };
    const total = modelCover(0);
    const model = {
      low: modelCover(1),
      mid: modelCover(2),
      high: modelCover(3),
      total,
      clear: 1 - total,
    };
    const weight = Math.exp(-(i / 6) / tau);
    const mix = (transport: number, forecast: number) =>
      weight * transport + (1 - weight) * forecast;
    const blendedTotal = mix(1 - clear, total);
    return {
      time: new Date(initial + i * tenMinutes).toISOString(),
      nowcast: { low, mid, high, clear, total: 1 - clear },
      model,
      blend: {
        low: mix(low, model.low),
        mid: mix(mid, model.mid),
        high: mix(high, model.high),
        total: blendedTotal,
        clear: 1 - blendedTotal,
      },
      jet_ms,
      seeing: jet_ms < 20 ? 'good' : jet_ms > 35 ? 'poor' : 'fair',
    };
  });
}

function blendedWindow(site: SiteSample[]): Nowcast['best_window'] {
  let start = 0;
  let bestStart = 0;
  let bestLength = 0;
  site.forEach((sample, i) => {
    if (sample.blend.clear < 0.7 || sample.seeing === 'poor') {
      start = i + 1;
      return;
    }
    const length = i - start + 1;
    if (length > bestLength) {
      bestStart = start;
      bestLength = length;
    }
  });
  if (!bestLength) return null;
  const stretch = site.slice(bestStart, bestStart + bestLength);
  return {
    start: stretch[0].time,
    end: stretch[stretch.length - 1].time,
    mean_clear:
      stretch.reduce((sum, sample) => sum + sample.blend.clear, 0) / bestLength,
    seeing: stretch.some((sample) => sample.seeing === 'fair') ? 'fair' : 'good',
  };
}

export function listNowcasts() {
  tick();
  const now = Date.now();
  for (const record of records.values()) {
    if (record.status === 'done' || record.status === 'error') {
      if (Date.parse(record.expires_at) <= now) removeNowcast(record.id);
      continue;
    }
    if (record.status === 'fetching') {
      if (now - Date.parse(record.created_at) >= 650) prepare(record);
      continue;
    }
    const children = record.layers.map((l) => runs.get(l.run_id));
    if (children.some((r) => !r || r.status === 'expired' || r.status === 'error')) {
      record.status = 'error';
      record.message = 'A cloud layer run failed or was removed.';
    } else if (children.every((r) => r?.status === 'done')) {
      record.site = samples(record, children as Run[]);
      record.best_window = blendedWindow(
        record.site.filter(
          (s) =>
            !record.night ||
            (s.time >= record.night.dusk && s.time <= record.night.dawn),
        ),
      );
      record.status = 'done';
    } else if (children.some((r) => r?.status === 'running' || r?.status === 'done'))
      record.status = 'running';
    if (record.status === 'done' || record.status === 'error')
      record.expires_at = new Date(now + week).toISOString();
  }
  return records;
}
export function removeNowcast(id: string) {
  const record = records.get(id);
  if (!record) return false;
  for (const l of record.layers) {
    const run = runs.get(l.run_id);
    runs.delete(l.run_id);
    if (run?.request.source.kind === 'field') {
      const fieldId = run.request.source.field_id;
      if (
        ![...runs.values()].some(
          (r) =>
            r.request.source.kind === 'field' && r.request.source.field_id === fieldId,
        )
      )
        fields.delete(fieldId);
    }
  }
  return records.delete(id);
}
