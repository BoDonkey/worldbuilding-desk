import {useEffect} from 'react';

declare global {
  interface Window {
    __wbdWorkspaceMountedAt?: number;
    __wbdWorkspaceRenderCount?: number;
    __wbdWorkspaceUnmountedAt?: number;
  }
}

/**
 * Lightweight diagnostics for the Workspace route, readable from the browser
 * console: when it mounted and unmounted, and how many times it rendered.
 * Never updates state.
 */
export function useWorkspaceRenderDiagnostics() {
  useEffect(() => {
    window.__wbdWorkspaceMountedAt = Date.now();
    window.__wbdWorkspaceRenderCount = 0;
    return () => {
      window.__wbdWorkspaceUnmountedAt = Date.now();
    };
  }, []);

  useEffect(() => {
    window.__wbdWorkspaceRenderCount = (window.__wbdWorkspaceRenderCount ?? 0) + 1;
  });
}
