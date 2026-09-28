'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth-context';
import { safeNextPath } from '@/lib/client/format';
import ErrorMessage from '@/components/ErrorMessage';

const DEMO_PASSWORDS = {
  admin:       'Admin@12345',
  contributor: 'Contrib@12345',
  reliefops:   'Relief@12345',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);

  const nextPath = safeNextPath(params.get('next'));

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [loading, user, router, nextPath]);

  useEffect(() => {
    apiFetch('/api/auth/demo-users').then(setDemoUsers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace(nextPath);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function useDemo(u) {
    setUsername(u);
    if (DEMO_PASSWORDS[u]) setPassword(DEMO_PASSWORDS[u]);
  }

  return (
    <div className="stack" style={{ maxWidth: 440, margin: '0 auto' }}>
      <div>
        <h1>Sign in</h1>
        <p className="page-head__sub">Reading incidents is public; creating or updating requires a session.</p>
      </div>

      <ErrorMessage error={error} title="Could not sign in" />

      <form className="card card__body" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="username">Username</label>
          <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {demoUsers.length ? (
        <div className="card card__body">
          <h3 style={{ marginBottom: 8 }}>Demo accounts</h3>
          <div className="stack stack--tight">
            {demoUsers.map((u) => (
              <button key={u.username} type="button" className="btn btn--secondary btn--sm" onClick={() => useDemo(u.username)} style={{ textAlign: 'left' }}>
                <strong>{u.username}</strong> <span className={`badge badge--${u.role}`}>{u.role}</span>
                <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{u.description}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <LoginForm />
    </Suspense>
  );
}
