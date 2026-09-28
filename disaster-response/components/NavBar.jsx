'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/client/auth-context';
import { useEventStream } from '@/lib/client/useEventStream';

export default function NavBar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { status } = useEventStream({ enabled: !!user });

  return (
    <nav className="nav">
      <div className="nav__inner">
        <div className="nav__brand">
          <span className="nav__logo">DR</span>
          <span>Disaster Response</span>
        </div>
        <div className="nav__links">
          <Link href="/disasters" className="nav__link" aria-current={pathname === '/disasters' ? 'page' : undefined}>Incidents</Link>
          <Link href="/disasters/new" className="nav__link" aria-current={pathname === '/disasters/new' ? 'page' : undefined}>Report incident</Link>
        </div>
        <div className="nav__spacer" />
        <div className="nav__user">
          {user ? (
            <>
              <span className={`dot ${status === 'open' ? 'dot--ok' : status === 'reconnecting' ? 'dot--warn' : 'dot--muted'}`} title={`Live: ${status}`} />
              <span className="sr-only">Live connection: {status}</span>
              <span className="faint">{user.displayName || user.username}</span>
              <span className={`badge badge--${user.role}`}>{user.role}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>Sign out</button>
            </>
          ) : (
            <Link href="/login" className="btn btn--secondary btn--sm">
              {loading ? 'Checking session' : 'Sign in'}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
