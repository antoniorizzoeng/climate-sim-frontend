import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Download, Trash2, RotateCcw } from 'lucide-react';
import { api, checked, download, message } from '@/lib/api';
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
  const [tab, setTab] = useState<'runs' | 'fields'>('runs'),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [revision, refresh] = useState(0);
  const [page, setPage] = useState<{
      key: string;
      items: (Run | Field)[];
      next: string | null;
    }>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState('');
  const cursor = cursors[cursors.length - 1],
    key = JSON.stringify([tab, cursor, revision]);
  useEffect(() => {
    const ctrl = new AbortController();
    const options = { params: { query: { limit: 10, cursor } }, signal: ctrl.signal };
    (async () => {
      const list =
        tab === 'runs'
          ? checked(await api.GET('/runs', options))
          : checked(await api.GET('/fields', options));
      if (!ctrl.signal.aborted)
        setPage({ key, items: list.items, next: list.next_cursor });
    })().catch((e) => {
      if (!ctrl.signal.aborted) setError(message(e));
    });
    return () => ctrl.abort();
  }, [tab, cursor, key]);
  async function act(item: Field | Run, action: 'delete' | 'download' | 'rerun') {
    setError('');
    setBusy(true);
    try {
      if (action === 'delete') {
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
        const blob = checked(
          await api.GET('/fields/{fieldId}/original', {
            params: { path: { fieldId: item.id } },
            parseAs: 'blob',
          }),
        );
        download(blob, item.source === 'drawn' ? item.name + '.nc' : item.name);
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
        <p className="empty">No saved {tab} yet.</p>
      ) : (
        page.items.map((item) => {
          const isRun = 'status' in item;
          return (
            <div className="history-row" key={item.id}>
              <div>
                <strong>{isRun ? 'Run ' + item.id.slice(0, 8) : item.name}</strong>{' '}
                <span className="mode-tag">{isRun ? item.status : item.state}</span>
                <p>
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
