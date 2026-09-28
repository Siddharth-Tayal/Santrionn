export default function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge badge--${status}`}>{status[0].toUpperCase() + status.slice(1)}</span>;
}
