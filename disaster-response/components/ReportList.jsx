'use client';

import { useCallback, useEffect, useState } from 'react';
import { relativeTime } from '@/lib/client/format';
import ErrorMessage from './ErrorMessage';

export default function ReportList({ disasterId }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!disasterId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/disasters/${disasterId}/reports?limit=20`, { credentials: 'same-origin' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message || 'Failed to load reports');
      setRows(payload.data || []);
      setMeta(payload.meta || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [disasterId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card card__body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>Community reports</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {meta ? (
            <span className="faint" style={{ fontSize: 12 }}>
              via {meta.provider} · {meta.freshness}
              {meta.degraded ? ' · degraded' : ''}
            </span>
          ) : null}
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>

      {meta?.degraded ? (
        <div className="alert alert--warn" role="alert" style={{ marginBottom: 12 }}>
          <div>
            <div className="alert__title">Serving stale cache</div>
            <div>The reports provider is unreachable; showing the last cached feed.</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : error ? (
        <ErrorMessage error={error} title="Could not load reports" onRetry={load} />
      ) : !rows.length ? (
        <div className="faint">No community reports yet.</div>
      ) : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="report">
              <div className="report__head">
                <span>
                  <span className="report__author">@{r.author}</span>
                  <span className={`report__priority priority--${r.priority}`}>{r.priority}</span>
                </span>
                <span>{relativeTime(r.externalCreatedAt)}</span>
              </div>
              <div className="report__body">{r.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
