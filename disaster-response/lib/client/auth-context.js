'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, isUnauthorised } from './api';

export const PERMISSIONS = {
  create: ['admin', 'contributor'],
  update: ['admin', 'contributor'],
  delete: ['admin'],
  reopen: ['admin'],
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data ? data.user : null);
    } catch (err) {
      if (!isUnauthorised(err)) console.warn('session check failed', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: { username, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); }
    catch (err) { console.warn('logout failed', err.message); }
    finally { setUser(null); }
  }, []);

  const can = useCallback(
    (action) => {
      if (!user) return false;
      const allowed = PERMISSIONS[action];
      return allowed ? allowed.includes(user.role) : false;
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, can, isAdmin: user?.role === 'admin' }),
    [user, loading, login, logout, refresh, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
