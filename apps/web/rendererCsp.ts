/**
 * Content-Security-Policy for the packaged desktop renderer, written into
 * index.html by the production build (the dev server is covered by a header
 * the desktop main process adds). The renderer may load code only from the
 * app itself; network requests may go only to loopback (local Ollama) and to
 * the hosts the in-app embedding model is downloaded from. Hosted AI
 * providers are deliberately absent: those requests run in the main process.
 */
export const PACKAGED_RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');
