'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import ErrorMessage from './ErrorMessage';

const STATUSES = ['active', 'monitoring', 'resolved'];

export default function DisasterForm({ initial, mode = 'create' }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [status, setStatus] = useState(initial?.status || 'active');
  const [lat, setLat] = useState(initial?.location?.latitude ?? '');
  const [lng, setLng] = useState(initial?.location?.longitude ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const body = {
      title: title.trim(),
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
    };
    const hasLat = lat !== '' && lat !== null;
    const hasLng = lng !== '' && lng !== null;
    if (hasLat && hasLng) body.location = { latitude: Number(lat), longitude: Number(lng) };

    try {
      const url = mode === 'create' ? '/api/disasters' : `/api/disasters/${initial.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const disaster = await apiFetch(url, { method, body });
      router.push(`/disasters/${disaster.id}`);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <form className="card card__body" onSubmit={handleSubmit}>
      <ErrorMessage error={error} title="Could not save incident" />

      <div className="field">
        <label className="field__label" htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="description">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={3} maxLength={2000} />
        <span className="field__hint">
          Name the place if you can, e.g. “Heavy flooding has affected Manhattan, NYC”.
          The server extracts and resolves it to coordinates. ({description.length}/2000)
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="tags">Tags</label>
        <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="flood, urban, storm" />
        <span className="field__hint">Comma separated, up to 10.</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="status">Initial status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field__label">Exact coordinates (optional)</label>
        <span className="field__hint" style={{ marginBottom: 4 }}>Leave blank to let the server resolve from the description.</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="Latitude"  value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          <input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create incident' : 'Save changes'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => router.back()} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}
