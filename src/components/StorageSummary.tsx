import { useEffect, useState } from 'react';
import { api, checked, message } from '@/lib/api';
import { bytes } from '@/lib/history';
import type { components } from '@/lib/schema';

export function StorageSummary({ revision }: { revision: number }) {
  const [usage, setUsage] = useState<components['schemas']['StorageUsage']>();
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .GET('/storage', { signal: ctrl.signal })
      .then(checked)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setUsage(data);
          setError('');
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(message(e));
      });
    return () => ctrl.abort();
  }, [revision, attempt]);

  return (
    <section className="history-storage" aria-label="Disk storage">
      <h3>Disk storage</h3>
      {error ? (
        <p role="alert">
          {error} <button onClick={() => retry((v) => v + 1)}>Retry storage</button>
        </p>
      ) : usage ? (
        <>
          <div className="storage-numbers">
            <strong>{bytes(usage.used_bytes)} used by Climate Sim</strong>
            <span>
              {bytes(usage.free_bytes)} free of {bytes(usage.total_bytes)}
            </span>
          </div>
          <div className="storage-bar" aria-hidden="true">
            {(['runs_bytes', 'fields_bytes', 'nowcasts_bytes', 'other'] as const).map(
              (key) => {
                const size =
                  key === 'other'
                    ? Math.max(
                        0,
                        usage.total_bytes - usage.free_bytes - usage.used_bytes,
                      )
                    : usage[key];
                return (
                  <i
                    key={key}
                    className={key}
                    style={{
                      minWidth: size > 0 ? 2 : 0,
                      width: (100 * size) / Math.max(1, usage.total_bytes) + '%',
                    }}
                  />
                );
              },
            )}
          </div>
          <ul>
            {(['runs', 'fields', 'nowcasts'] as const).map((k) => (
              <li key={k}>
                <i className={k + '_bytes'} />
                {k} {bytes(usage[`${k}_bytes`])}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Loading storage…</p>
      )}
    </section>
  );
}
