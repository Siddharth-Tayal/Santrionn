'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth-context';
import { useEventStream } from '@/lib/client/useEventStream';
import { relativeTime, formatDateTime, formatCoordinates, locationSourceLabel } from '@/lib/client/format';
import StatusBadge from '@/components/StatusBadge';
import ResourceList from '@/components/ResourceList';
import ReportList from '@/components/ReportList';
import EventFeed from '@/components/EventFeed';
import ErrorMessage from '@/components/ErrorMessage';

const STATUSES = ['active', 'monitoring', 'resolved'];

export default function DisasterDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { user, can } = useAuth();

  const [disaster, setDisaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/api/disasters/${id}`);
      setDisaster(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onEvent = useCallback((event, data) => {
    const payload = data && data.disaster ? data.disaster : data;
    const eventId = payload ? payload.id : data ? data.id : null;
    if (eventId !== id) return;
    setEvents((cur) => [
      { key: `${Date.now()}-${event}`, event, summary: event === 'disaster.deleted' ? 'this incident was deleted' : `${event} · ${relativeTime(new Date())}` },
      ...cur,
    ].slice(0, 25));
    if (event === 'disaster.deleted') { router.push('/disasters'); return; }
    load();
  }, [id, load, router]);
  const { status } = useEventStream({ enabled: !!user, onEvent });

  async function changeStatus(next) {
    setBusy(true); setActionError(null);
    try {
      const updated = await apiFetch(`/api/disasters/${id}`, { method: 'PATCH', body: { status: next } });
      setDisaster(updated);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this incident and its cached reports?')) return;
    setBusy(true); setActionError(null);
    try {
      await apiFetch(`/api/disasters/${id}`, { method: 'DELETE' });
      router.push('/disasters');
    } catch (err) {
      setActionError(err); setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="card card__body" aria-busy="true">
        <div className="stack stack--tight">
          <div className="skeleton" style={{ width: '50%' }} />
          <div className="skeleton" style={{ width: '100%', height: 80 }} />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="stack">
        <ErrorMessage error={error} title="Could not load this incident" onRetry={load} />
        <button className="btn btn--secondary" onClick={() => router.push('/disasters')}>Back to incidents</button>
      </div>
    );
  }
  if (!disaster) return null;

  const location = disaster.location || {};
  const author = disaster.createdByUser;
  const reopenBlocked = disaster.status === 'resolved' && !can('reopen');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1>{disaster.title}</h1>
            <StatusBadge status={disaster.status} />
          </div>
          <p className="page-head__sub">
            Reported {relativeTime(disaster.createdAt)} · updated {relativeTime(disaster.updatedAt)}
            {author ? ` · by ${author.displayName || author.username}` : ''}
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => router.push('/disasters')}>All incidents</button>
      </div>

      <ErrorMessage error={actionError} title="Action failed" />

      <div className="card card__body">
        <div className="stack">
          <div>
            <h3 style={{ marginBottom: 4 }}>Description</h3>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{disaster.description}</p>
          </div>
          <div className="meta-line">
            <span className="meta-line__item"><strong>Location:</strong> {location.label || 'not recorded'}</span>
            <span className="meta-line__item"><strong>Coordinates:</strong> {formatCoordinates(location)}</span>
            <span className="meta-line__item">{locationSourceLabel(location.source)}{location.provider ? ` via ${location.provider}` : ''}</span>
            <span className="meta-line__item"><strong>Created:</strong> {formatDateTime(disaster.createdAt)}</span>
          </div>
          {Array.isArray(disaster.tags) && disaster.tags.length ? (
            <div className="chip-row">
              {disaster.tags.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
          ) : null}
        </div>
      </div>

      {user ? (
        <div className="card card__body">
          <h3 style={{ marginBottom: 12 }}>Actions</h3>
          <div className="btn-row">
            {STATUSES.filter((s) => s !== disaster.status).map((next) => {
              const blocked = next === 'active' && disaster.status === 'resolved' && !can('reopen');
              return (
                <button key={next} type="button" className="btn btn--secondary btn--sm" disabled={busy || blocked} onClick={() => changeStatus(next)}>
                  Mark {next}
                </button>
              );
            })}
            {can('delete') ? (
              <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={handleDelete}>Delete incident</button>
            ) : null}
          </div>
          {reopenBlocked ? (
            <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>Reopening a resolved incident requires the admin role.</p>
          ) : null}
        </div>
      ) : null}

      <ResourceList disaster={disaster} />
      <ReportList disasterId={disaster.id} />
      <EventFeed events={events} status={status} />
    </div>
  );
}
