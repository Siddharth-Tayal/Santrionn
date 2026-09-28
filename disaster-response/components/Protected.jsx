'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/auth-context';

/**
 * Wraps children behind an authenticated (and optionally role-gated) session.
 * Not a security boundary — the API rejects unauthorised requests independently.
 * This exists so a signed-out user is bounced to /login instead of hitting an
 * empty state.
 */
export default function Protected({ children, requireRole }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const signedOut = !loading && !user;

  useEffect(() => {
    if (!signedOut) return;
    router.replace(`/login?next=${encodeURIComponent(pathname || '/disasters')}`);
  }, [signedOut, router, pathname]);

  if (loading || signedOut) {
    return (
      <div className="card card__body" aria-busy="true">
        <div className="stack stack--tight">
          <div className="skeleton" style={{ width: '40%' }} />
          <div className="skeleton" style={{ width: '100%', height: 60 }} />
        </div>
      </div>
    );
  }

  if (requireRole && !requireRole.includes(user.role)) {
    return (
      <div className="alert alert--warn" role="alert">
        <div>
          <div className="alert__title">Not permitted</div>
          <div>Your role ({user.role}) cannot use this page. The API enforces the same rule.</div>
        </div>
      </div>
    );
  }

  return children;
}
