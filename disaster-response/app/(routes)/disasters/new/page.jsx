'use client';

import DisasterForm from '@/components/DisasterForm';
import Protected from '@/components/Protected';

export default function NewDisasterPage() {
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>Report an incident</h1>
          <p className="page-head__sub">Name the place in the description and the server will resolve it to coordinates.</p>
        </div>
      </div>
      <Protected requireRole={['admin', 'contributor']}>
        <DisasterForm />
      </Protected>
    </div>
  );
}
