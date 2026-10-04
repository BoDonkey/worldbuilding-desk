/**
 * True when a main-window navigation stays on the app's own renderer: the
 * dev server origin in development, or the packaged index.html file. Hash and
 * query changes on that page are allowed; anything else is not.
 */
export function isRendererNavigation(target: string, rendererUrl: string): boolean {
  let next: URL;
  let current: URL;
  try {
    next = new URL(target);
    current = new URL(rendererUrl);
  } catch {
    return false;
  }
  if (current.protocol === 'file:') {
    return next.protocol === 'file:' && next.pathname === current.pathname;
  }
  return next.origin === current.origin;
}

/**
 * Content-Security-Policy sent as a response header when the window loads the
 * Vite dev server. Vite injects inline module scripts for React refresh and
 * uses a websocket for hot reload, so this is looser than the packaged
 * policy (a meta tag added by the web build), but it still keeps the renderer
 * from loading code or sending requests anywhere other than its own origin,
 * loopback (Ollama), and the embedding-model hosts.
 */
export function buildDevContentSecurityPolicy(devServerUrl: string): string {
  const origin = new URL(devServerUrl).origin;
  const websocket = origin.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${websocket} http://localhost:* http://127.0.0.1:* https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
}
