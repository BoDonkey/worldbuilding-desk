import {recordDiagnostic, type DiagnosticFailureClass} from './diagnostics';

/**
 * Author-facing error description (roadmap slice 5.6).
 *
 * The app deliberately throws plain-language validation errors from its own
 * services ("This character already has a mechanics sheet."). Those must keep
 * reaching the author unchanged. What must *not* reach the author is the raw
 * text of a provider SDK, `fetch`, IndexedDB, or JSON parser failure. So:
 *
 *   1. Known failure classes (network, auth, quota, storage-full,
 *      schema-too-new, provider outage, cancellation) map to fixed
 *      author-facing sentences.
 *   2. Messages that read as technical noise fall back to the caller's text.
 *   3. Everything else is treated as an app-authored message and shown as-is.
 *
 * The raw error is always recorded in the local diagnostics log (redacted) and
 * echoed to the console, never to the UI.
 */

const PROVIDER_NAME_PATTERN = /\b(Anthropic|OpenAI|Google Gemini|Gemini|Ollama)\b/i;

const NETWORK_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|network error|load failed|econnrefused|econnreset|enotfound|etimedout|ehostunreach|socket hang up|net::err_|could not connect|connection refused/i;
const STATUS_PREFIX = String.raw`(?:api error|responded with|status(?: code)?|http)\s*:?\s*`;
const AUTH_PATTERN = new RegExp(
  `${STATUS_PREFIX}(401|403)\\b|unauthorized|forbidden|invalid[_ ]?api[_ ]?key|incorrect api key|authentication|permission denied|api key is missing`,
  'i'
);
const QUOTA_PATTERN = new RegExp(
  `${STATUS_PREFIX}429\\b|rate.?limit|too many requests|quota exceeded|insufficient_quota|insufficient quota|billing|credit balance`,
  'i'
);
const PROVIDER_UNAVAILABLE_PATTERN = new RegExp(
  `${STATUS_PREFIX}(500|502|503|504|529)\\b|internal server error|bad gateway|service unavailable|gateway timeout|overloaded|temporarily unavailable`,
  'i'
);
const STORAGE_FULL_PATTERN = /quotaexceedederror|quota exceeded|storage is full|not enough space|disk full|enospc/i;
const SCHEMA_TOO_NEW_PATTERN =
  /newer version|uses storage schema \d+, but this app supports|supports up to \d+|versionerror|requested version .* less than the existing version/i;
const ABORTED_PATTERN = /aborterror|the operation was aborted|\baborted\b|request was cancelled|request was canceled/i;

const TECHNICAL_NAMES = new Set([
  'TypeError',
  'SyntaxError',
  'RangeError',
  'ReferenceError',
  'EvalError',
  'URIError',
  'DOMException',
  'InvalidStateError',
  'DataError',
  'ConstraintError',
  'TransactionInactiveError',
  'ReadOnlyError',
  'UnknownError',
  'NotFoundError',
  'DataCloneError',
  'InvalidAccessError'
]);

const TECHNICAL_MESSAGE_PATTERN =
  /unexpected token|unexpected end of (json|input)|json\.parse|is not a function|cannot read propert|cannot set propert|cannot access|undefined is not|null is not|is not defined|is not iterable|is not an object|\[object [A-Za-z]+\]|maximum call stack|out of memory|^\s*at\s+\S+\s+\(|^error:?\s*$|^\s*$|api error:\s*$|responded with \d{3}\s*\.?$|\bECONN/i;
// Node-style errno codes (ENOENT, ETIMEDOUT). Case-sensitive on purpose: under /i this would match
// ordinary words such as "empty" or "every" and hide a plain-language app message.
const ERRNO_CODE_PATTERN = /\bE[A-Z]{4,}\b/;

export type ErrorFailureClass = DiagnosticFailureClass;

export interface DescribeErrorOptions {
  /** Short label for where the error happened, stored with the diagnostic entry. */
  context?: string;
  /** Skip the diagnostics log (for errors already recorded upstream). */
  record?: boolean;
}

function providerLabel(message: string): string {
  const match = PROVIDER_NAME_PATTERN.exec(message);
  if (!match) return 'The AI provider';
  const name = match[1];
  return /^gemini$/i.test(name) ? 'Google Gemini' : name;
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  if (error && typeof error === 'object' && typeof (error as {name?: unknown}).name === 'string') {
    return (error as {name: string}).name;
  }
  return '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message ?? '';
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as {message?: unknown}).message === 'string') {
    return (error as {message: string}).message;
  }
  return '';
}

/** Classifies an unknown thrown value into a known failure class. */
export function classifyError(error: unknown): ErrorFailureClass {
  const name = errorName(error);
  const message = errorMessage(error);
  const haystack = `${name} ${message}`;

  if (name === 'ProjectMigrationError') return 'migration';
  if (name === 'QuotaExceededError' || STORAGE_FULL_PATTERN.test(haystack)) return 'storage-full';
  if (name === 'VersionError' || SCHEMA_TOO_NEW_PATTERN.test(haystack)) return 'schema-too-new';
  if (name === 'AbortError' || ABORTED_PATTERN.test(haystack)) return 'aborted';
  if (AUTH_PATTERN.test(haystack)) return 'auth';
  if (QUOTA_PATTERN.test(haystack)) return 'quota';
  if (NETWORK_PATTERN.test(haystack)) return 'network';
  if (PROVIDER_UNAVAILABLE_PATTERN.test(haystack)) return 'provider-unavailable';
  if (!(error instanceof Error) && !(error && typeof error === 'object' && typeof (error as {message?: unknown}).message === 'string')) {
    return 'unknown';
  }
  if (
    TECHNICAL_NAMES.has(name) ||
    TECHNICAL_MESSAGE_PATTERN.test(message) ||
    ERRNO_CODE_PATTERN.test(message)
  ) {
    return 'unknown';
  }
  return 'app-message';
}

const MAX_APP_MESSAGE_LENGTH = 320;

/**
 * Returns text safe to render to the author for `error`; `fallback` is used
 * whenever the error carries nothing an author could act on.
 */
export function describeError(error: unknown, fallback: string, options: DescribeErrorOptions = {}): string {
  const failureClass = classifyError(error);
  const message = errorMessage(error);

  if (options.record !== false) {
    recordDiagnostic(error, {context: options.context, failureClass});
    if (failureClass !== 'app-message' && typeof console !== 'undefined') {
      console.error(options.context ? `[${options.context}]` : '[error]', error);
    }
  }

  switch (failureClass) {
    case 'network':
      return /ollama/i.test(message)
        ? 'Could not reach Ollama. Check that it is running on this computer, then try again.'
        : PROVIDER_NAME_PATTERN.test(message)
          ? `Could not reach ${providerLabel(message)}. Check your internet connection and try again.`
          : 'Could not reach the network. Check your connection and try again.';
    case 'auth':
      return /api key is missing/i.test(message)
        ? message
        : `${providerLabel(message)} rejected the API key. Check it under Settings → AI Settings.`;
    case 'quota':
      return `${providerLabel(message)} limited this request (rate limit or quota). Wait a moment and try again, or check your plan with the provider.`;
    case 'provider-unavailable':
      return `${providerLabel(message)} is temporarily unavailable. Your work is saved locally; try again in a few minutes.`;
    case 'storage-full':
      return "This computer's local storage for the app is full, so the change could not be saved. Export a backup, then remove projects you no longer need.";
    case 'schema-too-new':
      return 'This project was saved by a newer version of Worldbuilding Desk. Update the app to open it.';
    case 'aborted':
      return 'The request was cancelled before it finished.';
    case 'migration':
    case 'app-message':
      return message.length > MAX_APP_MESSAGE_LENGTH ? fallback : message.trim() || fallback;
    case 'unknown':
    default:
      return fallback;
  }
}
