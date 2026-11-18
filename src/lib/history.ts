import type { operations } from './schema';

type Query = NonNullable<operations['listRuns']['parameters']['query']>;
export const sorts = {
  created_desc: 'Newest',
  created_asc: 'Oldest',
  size_desc: 'Largest',
  size_asc: 'Smallest',
  name_asc: 'Name A–Z',
  name_desc: 'Name Z–A',
} satisfies Record<NonNullable<Query['sort']>, string>;
export type HistoryQuery = {
  q: string;
  from: string;
  to: string;
  sort: keyof typeof sorts;
};

function dateInput(iso: string | null, exclusive: boolean) {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) - (exclusive ? 1 : 0));
  if (!Number.isFinite(+d)) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function readHistoryQuery(): HistoryQuery {
  const p = new URLSearchParams(window.location.search);
  const sort = p.get('sort') ?? '';
  return {
    q: p.get('q') ?? '',
    from: dateInput(p.get('created_from'), false),
    to: dateInput(p.get('created_to'), true),
    sort: Object.hasOwn(sorts, sort) ? (sort as HistoryQuery['sort']) : 'created_desc',
  };
}
export function requestQuery(query: HistoryQuery) {
  const end = new Date(query.to + 'T00:00:00');
  end.setDate(end.getDate() + 1);
  return {
    q: query.q.trim() || undefined,
    created_from: query.from
      ? new Date(query.from + 'T00:00:00').toISOString()
      : undefined,
    created_to: query.to ? end.toISOString() : undefined,
    sort: query.sort,
  };
}

export function writeHistoryQuery(query: HistoryQuery, tab: 'runs' | 'fields') {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries({
    ...requestQuery(query),
    history_tab: tab,
  })) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href !== window.location.href)
    window.history.replaceState(window.history.state, '', url);
}

export function bytes(value: number, decimal = false) {
  const base = decimal ? 1000 : 1024;
  const units = decimal
    ? ['B', 'kB', 'MB', 'GB', 'TB', 'PB']
    : ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.max(1, value)) / Math.log(base)),
  );
  return (
    (value / base ** i).toLocaleString(undefined, {
      minimumFractionDigits: decimal && i > 0 ? 1 : 0,
      maximumFractionDigits: 1,
    }) +
    ' ' +
    units[i]
  );
}
