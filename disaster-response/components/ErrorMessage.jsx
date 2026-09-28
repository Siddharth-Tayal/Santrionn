'use client';

export default function ErrorMessage({ error, title = 'Something went wrong', onRetry }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details : null;
  return (
    <div className="alert alert--error" role="alert">
      <div>
        <div className="alert__title">{title}</div>
        <div>{error.message || String(error)}</div>
        {details ? (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {details.map((d, i) => (
              <li key={i}>
                <strong>{d.field}:</strong> {d.message}
              </li>
            ))}
          </ul>
        ) : null}
        {error.requestId ? (
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
            Request id: <code>{error.requestId}</code>
          </div>
        ) : null}
        {onRetry ? (
          <button type="button" className="btn btn--secondary btn--sm" style={{ marginTop: 8 }} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
