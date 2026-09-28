'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STATUSES = ['active', 'monitoring', 'resolved'];
const SORTS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'By status' },
];

export default function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [tag, setTag] = useState(params.get('tag') || '');
  const [sort, setSort] = useState(params.get('sort') || 'recent');

  function apply(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (tag) next.set('tag', tag);
    if (sort && sort !== 'recent') next.set('sort', sort);
    router.push(next.toString() ? `/disasters?${next}` : '/disasters');
  }

  function reset() {
    setQ(''); setStatus(''); setTag(''); setSort('recent');
    router.push('/disasters');
  }

  return (
    <form className="card card__body" onSubmit={apply}>
      <div className="filter-bar">
        <div className="field">
          <label className="field__label" htmlFor="q">Search</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Manhattan, flood…" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tag">Tag</label>
          <input id="tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="flood" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="submit" className="btn btn--primary btn--sm">Apply</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>Reset</button>
      </div>
    </form>
  );
}
