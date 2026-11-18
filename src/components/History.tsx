import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Download, Trash2, RotateCcw } from 'lucide-react';
import { api, checked, download, message } from '@/lib/api';
import {
  bytes,
  readHistoryQuery,
  requestQuery,
  sorts,
  writeHistoryQuery,
  type HistoryQuery,
} from '@/lib/history';
import { StorageSummary } from './StorageSummary';
import './history.css';
import type { Run, Field } from '@/lib/model';
export function History({
  openField,
  onDelete,
  openRun,
}: {
  onDelete: (id: string) => void;
  openField: (field: Field) => void;
  openRun: (run: Run) => void;
}) {
  const [tab, setTab] = useState<'runs' | 'fields'>(() =>
      new URLSearchParams(window.location.search).get('history_tab') === 'fields'
        ? 'fields'
        : 'runs',
    ),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [revision, refresh] = useState(0);
  const [draft, setDraft] = useState(readHistoryQuery);
  const [query, setQuery] = useState(draft);
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState<{
      key: string;
      items: (Run | Field)[];
      next: string | null;
      total: number;
      totalBytes: number;
    }>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState('');
  const invalidRange = !!draft.to && draft.from > draft.to;
  useEffect(() => {
    if (invalidRange || draft === query) return;
    const timer = setTimeout(() => {
      setCursors([undefined]);
      setError('');
      setEditing('');
      setConfirm('');
      setQuery(draft);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, query, invalidRange]);
  useEffect(() => {
    writeHistoryQuery(query, tab);
  }, [query, tab]);
  function change<K extends keyof HistoryQuery>(key: K, value: HistoryQuery[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
  }
  const cursor = cursors[cursors.length - 1],
    key = JSON.stringify([tab, cursor, revision, query]);
  useEffect(() => {
    const ctrl = new AbortController();
    const options = {
      params: { query: { ...requestQuery(query), limit: 10, cursor } },
      signal: ctrl.signal,
    };
    (async () => {
      const list =
        tab === 'runs'
          ? checked(await api.GET('/runs', options))
          : checked(await api.GET('/fields', options));
      if (!ctrl.signal.aborted)
        setPage({
          key,
          items: list.items,
          next: list.next_cursor,
          total: list.total,
          totalBytes: list.total_bytes,
        });
    })().catch((e) => {
      if (!ctrl.signal.aborted) setError(message(e));
    });
    return () => ctrl.abort();
  }, [tab, cursor, key, query]);
  async function act(
    item: Field | Run,
    action: 'delete' | 'download' | 'rerun' | 'rename',
  ) {
    setError('');
    setBusy(true);
    try {
      if (action === 'rename') {
        const body = { name: name.trim() };
        if ('status' in item)
          checked(
            await api.PATCH('/runs/{runId}', {
              params: { path: { runId: item.id } },
              body,
            }),
          );
        else
          checked(
            await api.PATCH('/fields/{fieldId}', {
              params: { path: { fieldId: item.id } },
              body,
            }),
          );
        setEditing('');
        setCursors([undefined]);
        refresh((v) => v + 1);
      } else if (action === 'delete') {
        if ('status' in item)
          checked(
            await api.DELETE('/runs/{runId}', { params: { path: { runId: item.id } } }),
          );
        else
          checked(
            await api.DELETE('/fields/{fieldId}', {
              params: { path: { fieldId: item.id } },
            }),
          );
        onDelete(item.id);
        setConfirm('');
        setCursors([undefined]);
        refresh((x) => x + 1);
      } else if (action === 'download' && 'state' in item) {
        const result = await api.GET('/fields/{fieldId}/original', {
          params: { path: { fieldId: item.id } },
          parseAs: 'blob',
        });
        const disposition = result.response.headers.get('Content-Disposition') ?? '';
        const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
        const filename = encoded
          ? decodeURIComponent(encoded)
          : /filename="([^"]+)"/i.exec(disposition)?.[1];
        download(
          checked(result),
          filename ?? (item.source === 'drawn' ? item.name + '.nc' : item.name),
        );
      } else if (action === 'rerun') {
        openRun(
          checked(
            await api.POST('/runs/{runId}/rerun', {
              params: { path: { runId: item.id } },
            }),
          ),
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel history">
      <header className="panel-head">
        <h2>
          <Archive size={17} />
          History
        </h2>
        <div className="segmented">
          {(['runs', 'fields'] as const).map((t) => (
            <button
              key={t}
              aria-pressed={t === tab}
              onClick={() => {
                setTab(t);
                setEditing('');
                setCursors([undefined]);
                setConfirm('');
                setError('');
              }}
            >
              {t === 'runs' ? 'Runs' : 'Fields'}
            </button>
          ))}
        </div>
      </header>
      <StorageSummary revision={revision} />
      <div className="history-filters">
        <label>
          Search by name
          <input
            type="search"
            maxLength={120}
            value={draft.q}
            onChange={(e) => change('q', e.target.value)}
          />
        </label>
        <label>
          Created from
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => change('from', e.target.value)}
          />
        </label>
        <label>
          Created through
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => change('to', e.target.value)}
          />
        </label>
        <label>
          Sort
          <select
            value={draft.sort}
            onChange={(e) => change('sort', e.target.value as HistoryQuery['sort'])}
          >
            {Object.entries(sorts).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalidRange && (
        <p role="alert">The end date must be on or after the start date.</p>
      )}
      {page?.key === key && (
        <p className="history-totals" role="status">
          {page.total} matching {page.total === 1 ? tab.slice(0, -1) : tab} ·{' '}
          {bytes(page.totalBytes)}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button
            onClick={() => {
              setError('');
              refresh((x) => x + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
      {page?.key !== key ? (
        <p className="empty">Loading {tab}…</p>
      ) : !page.items.length ? (
        <p className="empty">
          {query.q || query.from || query.to
            ? 'No matching ' + tab + '.'
            : 'No saved ' + tab + ' yet.'}
        </p>
      ) : (
        page.items.map((item) => {
          const isRun = 'status' in item;
          return (
            <div className="history-row" key={item.id}>
              <div>
                {editing === item.id ? (
                  <form
                    className="history-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (name.trim()) void act(item, 'rename');
                    }}
                  >
                    <input
                      aria-label="New name"
                      autoFocus
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditing('');
                      }}
                    />
                    <button className="secondary" disabled={busy || !name.trim()}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing('')}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <strong>{item.name}</strong>{' '}
                    <button
                      className="rename-button"
                      aria-label={'Rename ' + item.name}
                      disabled={busy}
                      onClick={() => {
                        setName(item.name);
                        setEditing(item.id);
                      }}
                    >
                      Rename
                    </button>
                  </>
                )}
                <span className="mode-tag">{isRun ? item.status : item.state}</span>
                <p>
                  {bytes(item.size_bytes)} ·{' '}
                  {new Date(item.created_at).toLocaleString()}{' '}
                  {item.expires_at &&
                    ' · ' +
                      (!isRun && item.state === 'active' ? 'Archives ' : 'Expires ') +
                      new Date(item.expires_at).toLocaleString()}
                </p>
              </div>
              <div className="inline">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => (isRun ? openRun(item) : openField(item))}
                >
                  {isRun ? 'View' : 'Use field'}
                  <ArrowRight size={14} />
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => act(item, isRun ? 'rerun' : 'download')}
                >
                  {isRun ? <RotateCcw size={14} /> : <Download size={14} />}{' '}
                  {isRun ? 'Rerun' : 'Original'}
                </button>
                {confirm === item.id ? (
                  <>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => act(item, 'delete')}
                    >
                      Confirm delete
                    </button>
                    <button onClick={() => setConfirm('')}>Keep</button>
                  </>
                ) : (
                  <button
                    className="icon-btn"
                    aria-label={'Delete ' + item.id}
                    onClick={() => setConfirm(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
      <footer className="spread">
        <button
          className="secondary"
          disabled={cursors.length === 1 || busy}
          onClick={() => setCursors((a) => a.slice(0, -1))}
        >
          Previous
        </button>
        <span className="mono">Page {cursors.length}</span>
        <button
          className="secondary"
          disabled={page?.key !== key || !page.next || busy}
          onClick={() => setCursors((a) => [...a, page?.next ?? undefined])}
        >
          Next
        </button>
      </footer>
    </section>
  );
}
