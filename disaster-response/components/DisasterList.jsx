import DisasterCard from './DisasterCard';

export default function DisasterList({ disasters, loading }) {
  if (loading) {
    return (
      <div className="stack">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card card__body" aria-busy="true">
            <div className="stack stack--tight">
              <div className="skeleton" style={{ width: '60%' }} />
              <div className="skeleton" style={{ width: '90%' }} />
              <div className="skeleton" style={{ width: '30%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!disasters || !disasters.length) {
    return <div className="card card__body faint">No incidents match the current filters.</div>;
  }
  return (
    <div className="list">
      {disasters.map((d) => <DisasterCard key={d.id} disaster={d} />)}
    </div>
  );
}
