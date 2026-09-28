import Link from 'next/link';
import StatusBadge from './StatusBadge';
import { relativeTime, locationSourceLabel } from '@/lib/client/format';

export default function DisasterCard({ disaster }) {
  const location = disaster.location || {};
  return (
    <Link href={`/disasters/${disaster.id}`} className="disaster-card card--hover">
      <div className="disaster-card__head">
        <div>
          <div className="disaster-card__title">{disaster.title}</div>
          <div className="disaster-card__loc">
            {location.label || 'Location not recorded'}
            {typeof location.latitude === 'number' ? ` · ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : ''}
          </div>
        </div>
        <StatusBadge status={disaster.status} />
      </div>
      <p className="disaster-card__desc">{disaster.description}</p>
      {Array.isArray(disaster.tags) && disaster.tags.length ? (
        <div className="chip-row" style={{ margin: '8px 0' }}>
          {disaster.tags.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
      ) : null}
      <div className="disaster-card__foot">
        <span>{locationSourceLabel(location.source)}</span>
        <span>{relativeTime(disaster.createdAt)}</span>
      </div>
    </Link>
  );
}
