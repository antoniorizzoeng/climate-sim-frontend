import { HttpResponse } from 'msw';
import { sorts } from '@/lib/history';
import type { Field, Run } from '@/lib/model';
import { config, fields, runs } from './store';
import { listNowcasts } from './nowcasts';

const invalidHistory = (msg: string) =>
  HttpResponse.json(
    { detail: [{ loc: ['query'], msg, type: 'value_error' }] },
    { status: 422 },
  );

export function inventory() {
  const records = [...listNowcasts().values()];
  const layerIds = new Set(records.flatMap((r) => r.layers.map((l) => l.run_id)));
  const layerFields = new Set<string>();
  let nowcasts_bytes = records.reduce(
    (sum, r) => sum + new TextEncoder().encode(JSON.stringify(r)).length,
    0,
  );
  const userRuns = [...runs.values()].filter((run) => {
    if (!layerIds.has(run.id)) return true;
    nowcasts_bytes += run.size_bytes;
    if (run.request.source.kind === 'field')
      layerFields.add(run.request.source.field_id);
    return false;
  });
  const userFields = [...fields.values()]
    .map((f) => f.field)
    .filter((field) => {
      if (!layerFields.has(field.id)) return true;
      nowcasts_bytes += field.size_bytes;
      return false;
    });
  const sumBytes = (items: (Run | Field)[]) =>
    items.reduce((sum, r) => sum + r.size_bytes, 0);
  const runs_bytes = sumBytes(userRuns),
    fields_bytes = sumBytes(userFields);
  const used_bytes = runs_bytes + fields_bytes + nowcasts_bytes;
  const total_bytes = Math.max(config.disk_free_bytes, used_bytes);
  return {
    runs: userRuns,
    fields: userFields,
    storage: {
      runs_bytes,
      fields_bytes,
      nowcasts_bytes,
      used_bytes,
      total_bytes,
      free_bytes: total_bytes - used_bytes,
    },
  };
}

export function historyList(items: (Run | Field)[], params: URLSearchParams) {
  const q = (params.get('q') ?? '').toLowerCase(),
    from = params.get('created_from'),
    to = params.get('created_to'),
    sort = params.get('sort') ?? 'created_desc',
    limit = Number(params.get('limit') ?? 50);
  if (
    !Object.hasOwn(sorts, sort) ||
    q.length > 120 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    (from !== null && !Number.isFinite(Date.parse(from))) ||
    (to !== null && !Number.isFinite(Date.parse(to)))
  )
    return invalidHistory('Invalid history query.');
  const matches = items.filter(
    (i) =>
      (i.name.toLowerCase().includes(q) || i.id.toLowerCase().startsWith(q)) &&
      (!from || Date.parse(i.created_at) >= Date.parse(from)) &&
      (!to || Date.parse(i.created_at) < Date.parse(to)),
  );
  matches.sort((a, b) => {
    const diff = sort.startsWith('name')
      ? a.name.localeCompare(b.name)
      : sort.startsWith('size')
        ? a.size_bytes - b.size_bytes
        : Date.parse(a.created_at) - Date.parse(b.created_at);
    return (sort.endsWith('desc') ? -diff : diff) || a.id.localeCompare(b.id);
  });
  const cursor = params.get('cursor');
  const token = (id: string) =>
    encodeURIComponent(JSON.stringify([q, from, to, sort, id]));
  const index = cursor ? matches.findIndex((i) => token(i.id) === cursor) : -1;
  if (cursor && index < 0) return invalidHistory('Cursor does not match this query.');
  const page = matches.slice(index + 1, index + 1 + limit);
  return HttpResponse.json({
    items: page,
    total: matches.length,
    total_bytes: matches.reduce((sum, i) => sum + i.size_bytes, 0),
    next_cursor:
      index + 1 + limit < matches.length ? token(page[page.length - 1].id) : null,
  });
}
