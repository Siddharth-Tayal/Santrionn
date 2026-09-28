'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { formatDistance } from '@/lib/client/format';
import ErrorMessage from './ErrorMessage';

const TYPES = ['shelter', 'hospital', 'food', 'water', 'rescue'];
const RADII = [5, 10, 25, 50];

export default function ResourceList({ disaster }) {
  const [radius, setRadius] = useState(10);
  const [type, setType] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!disaster?.id) return;
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ radius: String(radius) });
      if (type) query.set('type', type);
      const url = `/api/disasters/${disaster.id}/resources?${query}`;
      const res = await fetch(url, { credentials: 'same-origin' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message || 'Failed to load resources');
      setRows(payload.data || []);
      setMeta(payload.meta || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [disaster?.id, radius, type]);

  useEffect(() => { load(); }, [load]);

  const location = disaster?.location || {};
  const noCoords = typeof location.latitude !== 'number';

  return (
    <div className="card card__body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>Nearby resources</h3>
        {meta ? <span className="faint" style={{ fontSize: 12 }}>{meta.count} within {meta.radiusKm} km</span> : null}
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="field">
          <label className="field__label">Radius</label>
          <div className="btn-row">
            {RADII.map((r) => (
              <button key={r} type="button" className={`btn btn--sm ${r === radius ? 'btn--primary' : ''}`} onClick={() => setRadius(r)}>{r} km</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="type">Type</label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {noCoords ? (
        <div className="faint">This incident has no resolved coordinates, so a nearby search cannot run automatically.</div>
      ) : loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : error ? (
        <ErrorMessage error={error} title="Could not load resources" onRetry={load} />
      ) : !rows.length ? (
        <div className="faint">No resources within {radius} km. Try widening the radius.</div>
      ) : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="card__body" style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{r.name}</strong> <span className="chip">{r.type}</span>
                  <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                    {r.location?.label || '—'}
                    {typeof r.location?.latitude === 'number' ? ` · ${r.location.latitude.toFixed(4)}, ${r.location.longitude.toFixed(4)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div><strong>{formatDistance(r.distanceKm)}</strong></div>
                  {r.capacity ? <div className="faint" style={{ fontSize: 12 }}>capacity {r.capacity}</div> : null}
                </div>
              </div>
              {r.notes ? <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>{r.notes}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
