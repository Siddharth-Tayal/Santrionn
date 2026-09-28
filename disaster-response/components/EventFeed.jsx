'use client';

import { relativeTime } from '@/lib/client/format';

export default function EventFeed({ events, status }) {
  if (!events?.length) return null;
  return (
    <div className="card card__body">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3>Live events</h3>
        <span className="faint" style={{ fontSize: 12 }}>SSE: {status}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {events.map((e) => (
          <li key={e.key}>
            <strong>{e.event}</strong>: {e.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}
