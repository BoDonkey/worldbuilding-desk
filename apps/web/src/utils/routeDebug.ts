import {useEffect, useRef} from 'react';

declare global {
  interface Window {
    __wbdLastRoute?: string;
    __wbdHistoryDebugInstalled?: boolean;
  }
}

interface RouteDebugEntry {
  ts: number;
  from: string | null;
  to: string;
}

const ROUTE_DEBUG_KEY = 'wbd.routeDebugLog';
const ROUTE_EVENT_KEY = 'wbd.routeEventLog';

const appendRouteDebug = (entry: RouteDebugEntry) => {
  try {
    const raw = localStorage.getItem(ROUTE_DEBUG_KEY);
    const parsed = raw ? (JSON.parse(raw) as RouteDebugEntry[]) : [];
    const next = [...parsed.slice(-119), entry];
    localStorage.setItem(ROUTE_DEBUG_KEY, JSON.stringify(next));
  } catch {
    // Ignore debug logging errors.
  }
};

const appendRouteEvent = (entry: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(ROUTE_EVENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
    const next = [...parsed.slice(-199), entry];
    localStorage.setItem(ROUTE_EVENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore debug logging errors.
  }
};

export const useRouteDebug = (pathname: string) => {
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const from = previousPathRef.current;
    appendRouteDebug({ts: Date.now(), from, to: pathname});
    window.__wbdLastRoute = pathname;
    previousPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    if (window.__wbdHistoryDebugInstalled) return;
    window.__wbdHistoryDebugInstalled = true;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState(...args);
      appendRouteEvent({
        ts: Date.now(),
        type: 'pushState',
        href: window.location.href,
        pathname: window.location.pathname,
        args: String(args[2] ?? '')
      });
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState(...args);
      appendRouteEvent({
        ts: Date.now(),
        type: 'replaceState',
        href: window.location.href,
        pathname: window.location.pathname,
        args: String(args[2] ?? '')
      });
      return result;
    };

    const onPopState = () => {
      appendRouteEvent({
        ts: Date.now(),
        type: 'popstate',
        href: window.location.href,
        pathname: window.location.pathname
      });
    };

    const onHashChange = () => {
      appendRouteEvent({
        ts: Date.now(),
        type: 'hashchange',
        href: window.location.href,
        pathname: window.location.pathname
      });
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.__wbdHistoryDebugInstalled = false;
    };
  }, []);
};
