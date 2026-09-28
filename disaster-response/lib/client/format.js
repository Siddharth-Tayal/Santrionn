export function relativeTime(value) {
  if (!value) return '';
  const d = new Date(value);
  const diff = Date.now() - d.getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function formatCoordinates(location) {
  if (!location) return '—';
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return '—';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function locationSourceLabel(source) {
  switch (source) {
    case 'resolved': return 'Resolved from description';
    case 'provided': return 'Provided by reporter';
    case 'seeded': return 'Seeded fixture';
    case 'unresolved': return 'Not resolved';
    default: return source || '—';
  }
}

/** Prevent open-redirects: only accept internal, single-slash paths. */
export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/disasters';
  return value;
}

export function formatDistance(km) {
  if (typeof km !== 'number') return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
