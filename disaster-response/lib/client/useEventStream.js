'use client';

import { useEffect, useRef, useState } from 'react';
import { eventStreamUrl } from './api';

const RECONNECT_MIN_MS = 200;
const RECONNECT_MAX_MS = 30_000;

/**
 * Subscribe to the /api/events SSE stream.
 * @param {{enabled?: boolean, onEvent?: (event, data)=>void}} opts
 */
export function useEventStream({ enabled = true, onEvent } = {}) {
  const [status, setStatus] = useState('idle');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return undefined;

    let closed = false;
    let source;
    let attempt = 0;
    let timer;

    const connect = () => {
      if (closed) return;
      setStatus('connecting');
      source = new EventSource(eventStreamUrl(), { withCredentials: true });

      source.onopen = () => {
        attempt = 0;
        setStatus('open');
      };

      const dispatch = (evt) => {
        let data = null;
        try { data = JSON.parse(evt.data); } catch { data = evt.data; }
        onEventRef.current?.(evt.type, data);
      };

      // Register the small, known set of event types we publish.
      ['disaster.created', 'disaster.updated', 'disaster.deleted',
        'resource.created', 'resource.updated', 'resource.deleted']
        .forEach((t) => source.addEventListener(t, dispatch));

      source.onerror = () => {
        if (closed) return;
        source.close();
        setStatus('reconnecting');
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempt) *
          (0.75 + Math.random() * 0.5);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
    };

    const onVisibility = () => {
      if (document.hidden) return;
      if (!source || source.readyState === EventSource.CLOSED) {
        clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (source) source.close();
      setStatus('idle');
    };
  }, [enabled]);

  return { status };
}
