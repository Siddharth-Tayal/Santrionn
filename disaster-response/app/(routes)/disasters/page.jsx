'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetchWithMeta } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth-context';
import { useEventStream } from '@/lib/client/useEventStream';
import DisasterList from '@/components/DisasterList';
import FilterBar from '@/components/FilterBar';
import ErrorMessage from '@/components/ErrorMessage';

function DisastersInner() {
  const { user, can } = useAuth();
  const params = useSearchParams();
  const [disasters, setDisasters] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      ['status', 'tag', 'q', 'sort'].forEach((k) => {
        const v = params.get(k);
        if (v) qs.set(k, v);
      });
      qs.set('limit', '20');
      const { data, meta } = await apiFetchWithMeta(`/api/disasters?${qs}`);
      setDisasters(data || []);
      setMeta(meta || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const onEvent = useCallback((event) => {
    if (event.startsWith('disaster.')) load();
  }, [load]);
  useEventStream({ enabled: !!user, onEvent });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <p className="page-head__sub">
            {meta ? `${meta.total} incident${meta.total === 1 ? '' : 's'} recorded` : ' '}
          </p>
        </div>
        {can('create') ? (
          <Link href="/disasters/new" className="btn btn--primary btn--sm">Report incident</Link>
        ) : null}
      </div>

      <FilterBar />
      <ErrorMessage error={error} title="Could not load incidents" onRetry={load} />
      <DisasterList disasters={disasters} loading={loading} />
    </div>
  );
}

export default function DisastersPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <DisastersInner />
    </Suspense>
  );
}
