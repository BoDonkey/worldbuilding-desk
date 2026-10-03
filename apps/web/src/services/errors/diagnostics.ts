/**
 * Local-only diagnostics (roadmap slice 5.6).
 *
 * Every entry is redacted *before* it is stored, and the store is a small
 * ring buffer mirrored to `localStorage` on this computer. Nothing here
 * transmits anything: there is no telemetry, crash reporting, or background
 * upload. The author may copy the rendered report into a support request
 * themselves, which is the only way it leaves the machine.
 *
 * Structural guarantee: only an error's `name`, `message`, and the first few
 * `stack` frames are ever serialized. Request payloads, `cause` objects,
 * provider responses, and manuscript text are never read, so they cannot
 * appear in a report even before the text-level redaction below runs.
 */

export type DiagnosticFailureClass =
  | 'network'
  | 'auth'
  | 'quota'
  | 'provider-unavailable'
  | 'storage-full'
  | 'schema-too-new'
  | 'aborted'
  | 'migration'
  | 'app-message'
  | 'unknown';

export interface DiagnosticEntry {
  id: string;
  at: number;
  context: string;
  failureClass: DiagnosticFailureClass;
  name: string;
  message: string;
  stack: string;
}

export const DIAGNOSTIC_STORAGE_KEY = 'worldbuilding-desk:diagnostics';
export const DIAGNOSTIC_ENTRY_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 400;
const MAX_STACK_FRAMES = 8;

const REDACTION_RULES: Array<{pattern: RegExp; replacement: string}> = [
  // Authorization headers and bearer tokens.
  {pattern: /\b(authorization|x-api-key|api[-_ ]?key)\s*[:=]\s*[^\s,;'"]+/gi, replacement: '$1: [redacted key]'},
  {pattern: /\bBearer\s+[^\s,;'"]+/gi, replacement: 'Bearer [redacted key]'},
  // Known provider key shapes (Anthropic, OpenAI, Google).
  {pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{8,}/g, replacement: '[redacted key]'},
  {pattern: /\bAIza[0-9A-Za-z_-]{10,}/g, replacement: '[redacted key]'},
  // Query strings can carry keys (Gemini uses `?key=`); keep host and path only.
  {pattern: /(https?:\/\/[^\s'")?]+)\?[^\s'")]*/g, replacement: '$1?[redacted query]'},
  // Any other long opaque token.
  {pattern: /\b[A-Za-z0-9_-]{32,}\b/g, replacement: '[redacted token]'},
  // Local file paths and file URLs, macOS / Linux / Windows.
  {pattern: /\bfile:\/\/[^\s'")]*/g, replacement: '[path]'},
  {pattern: /(?:\/(?:Users|home|Volumes|private|var|tmp|opt|Applications|root)\/)[^\s'")]*/g, replacement: '[path]'},
  {pattern: /\b[A-Za-z]:\\[^\s'")]*/g, replacement: '[path]'},
  // Quoted runs long enough to be prose rather than an identifier.
  {pattern: /"([^"\n]{61,})"/g, replacement: '"[redacted text]"'},
  {pattern: /'([^'\n]{61,})'/g, replacement: "'[redacted text]'"},
  {pattern: /“([^”\n]{61,})”/g, replacement: '“[redacted text]”'}
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips secrets, local paths, and prose-length quoted text from a string.
 * `secrets` are exact values (for example the configured API keys) that are
 * removed first, regardless of shape.
 */
export function redactDiagnosticText(text: string, secrets: readonly string[] = []): string {
  let result = text;
  for (const secret of secrets) {
    const trimmed = secret.trim();
    if (trimmed.length < 4) continue;
    result = result.replace(new RegExp(escapeRegExp(trimmed), 'g'), '[redacted key]');
  }
  for (const rule of REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)} [truncated]` : text;
}

function readErrorParts(error: unknown): {name: string; message: string; stack: string} {
  if (error instanceof Error) {
    const stackLines = (error.stack ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^at\s/.test(line) || /@/.test(line))
      .slice(0, MAX_STACK_FRAMES);
    return {name: error.name || 'Error', message: error.message ?? '', stack: stackLines.join('\n')};
  }
  if (typeof error === 'string') {
    return {name: 'string', message: error, stack: ''};
  }
  if (error && typeof error === 'object' && 'name' in error && typeof (error as {name: unknown}).name === 'string') {
    const message = 'message' in error && typeof (error as {message: unknown}).message === 'string'
      ? (error as {message: string}).message
      : '';
    return {name: (error as {name: string}).name, message, stack: ''};
  }
  return {name: typeof error, message: '', stack: ''};
}

type Listener = () => void;

let entries: DiagnosticEntry[] | null = null;
const listeners = new Set<Listener>();
let registeredSecrets: string[] = [];

function readStorage(): DiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DiagnosticEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as DiagnosticEntry).id === 'string' &&
        typeof (entry as DiagnosticEntry).at === 'number' &&
        typeof (entry as DiagnosticEntry).message === 'string'
    );
  } catch {
    return [];
  }
}

function writeStorage(next: DiagnosticEntry[]): void {
  try {
    localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may itself be full or blocked; the in-memory copy still serves this session.
  }
}

function ensureLoaded(): DiagnosticEntry[] {
  if (!entries) entries = readStorage();
  return entries;
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Registers exact secret values (configured API keys) so any diagnostic text
 * that happens to contain one is scrubbed. Values are held in memory only.
 */
export function registerDiagnosticSecrets(secrets: readonly (string | undefined | null)[]): void {
  registeredSecrets = secrets.filter((value): value is string => typeof value === 'string' && value.trim().length >= 4);
}

export function recordDiagnostic(
  error: unknown,
  params: {context?: string; failureClass?: DiagnosticFailureClass} = {}
): DiagnosticEntry {
  const parts = readErrorParts(error);
  const entry: DiagnosticEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    context: redactDiagnosticText(truncate(params.context ?? '', 120), registeredSecrets),
    failureClass: params.failureClass ?? 'unknown',
    name: redactDiagnosticText(truncate(parts.name, 80), registeredSecrets),
    message: redactDiagnosticText(truncate(parts.message, MAX_MESSAGE_LENGTH), registeredSecrets),
    stack: redactDiagnosticText(parts.stack, registeredSecrets)
  };
  const current = ensureLoaded();
  const next = [entry, ...current].slice(0, DIAGNOSTIC_ENTRY_LIMIT);
  entries = next;
  writeStorage(next);
  notify();
  return entry;
}

export function listDiagnostics(): readonly DiagnosticEntry[] {
  return ensureLoaded();
}

export function clearDiagnostics(): void {
  entries = [];
  try {
    localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY);
  } catch {
    // Ignore: nothing to remove or storage unavailable.
  }
  notify();
}

export function subscribeDiagnostics(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook: drops the cached copy so the next read comes from storage. */
export function resetDiagnosticsForTests(): void {
  entries = null;
  registeredSecrets = [];
  listeners.clear();
}

function describeRuntime(): string[] {
  const lines: string[] = [];
  if (typeof navigator !== 'undefined') {
    lines.push(`Browser: ${redactDiagnosticText(navigator.userAgent)}`);
    if (navigator.language) lines.push(`Language: ${navigator.language}`);
  }
  const hasDesktopBridge = typeof window !== 'undefined' && Boolean(window.electronAPI);
  lines.push(`Desktop shell: ${hasDesktopBridge ? 'yes' : 'no (browser)'}`);
  return lines;
}

/**
 * Renders the redacted log as plain text the author can paste into a support
 * request. Built on demand from already-redacted entries and scrubbed once
 * more with any secrets registered since they were recorded.
 */
export function buildDiagnosticReport(params: {secrets?: readonly string[]; now?: number} = {}): string {
  const secrets = [...registeredSecrets, ...(params.secrets ?? [])];
  const now = params.now ?? Date.now();
  const list = ensureLoaded();
  const lines: string[] = [
    'SagaSpine diagnostic report',
    `Generated: ${new Date(now).toISOString()}`,
    ...describeRuntime(),
    'Contents: error names, plain descriptions, and code locations only.',
    'Manuscript text, project data, API keys, and file paths are not included.',
    ''
  ];
  if (list.length === 0) {
    lines.push('No errors recorded.');
  }
  list.forEach((entry, index) => {
    lines.push(`--- ${index + 1}. ${new Date(entry.at).toISOString()} [${entry.failureClass}]`);
    if (entry.context) lines.push(`Where: ${entry.context}`);
    lines.push(`${entry.name}: ${entry.message || '(no message)'}`);
    if (entry.stack) lines.push(entry.stack);
    lines.push('');
  });
  return redactDiagnosticText(lines.join('\n').trimEnd(), secrets);
}
