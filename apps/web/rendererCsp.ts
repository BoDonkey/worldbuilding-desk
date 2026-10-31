/**
 * Content-Security-Policy for the packaged desktop renderer, written into
 * index.html by the production build (the dev server is covered by a header
 * the desktop main process adds). The renderer may load code only from the
 * app itself; network requests may go only to loopback (local Ollama). The
 * search model and its runtime ship in the app (`models/`). Hosted AI
 * providers are deliberately absent: those requests run in the main process.
 */
export const PACKAGED_RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');
