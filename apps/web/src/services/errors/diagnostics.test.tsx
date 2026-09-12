import {beforeEach, describe, expect, it} from 'vitest';
import {
  buildDiagnosticReport,
  clearDiagnostics,
  DIAGNOSTIC_ENTRY_LIMIT,
  DIAGNOSTIC_STORAGE_KEY,
  listDiagnostics,
  recordDiagnostic,
  redactDiagnosticText,
  registerDiagnosticSecrets,
  resetDiagnosticsForTests
} from './diagnostics';
import {installGlobalDiagnosticCapture} from './globalCapture';

const MANUSCRIPT =
  'Sera pressed the salt door shut and listened for Brannic on the stair, counting each breath until the lantern guttered out.';
const OPENAI_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';
const ANTHROPIC_KEY = 'sk-ant-api03-ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210';
const GEMINI_KEY = 'AIzaSyD-0123456789abcdefghijklmnopqrstuv';

describe('diagnostics', () => {
  beforeEach(() => {
    resetDiagnosticsForTests();
    clearDiagnostics();
  });

  it('redacts API keys of known and unknown shapes', () => {
    const text = `Authorization: Bearer ${OPENAI_KEY}; x-api-key=${ANTHROPIC_KEY}; url https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_KEY}`;
    const redacted = redactDiagnosticText(text);
    expect(redacted).not.toContain(OPENAI_KEY);
    expect(redacted).not.toContain(ANTHROPIC_KEY);
    expect(redacted).not.toContain(GEMINI_KEY);
    expect(redacted).toContain('https://generativelanguage.googleapis.com/v1/models?[redacted query]');
  });

  it('redacts exact configured secrets regardless of shape', () => {
    const redacted = redactDiagnosticText('provider said key "my-odd-key-1234" is invalid', ['my-odd-key-1234']);
    expect(redacted).not.toContain('my-odd-key-1234');
  });

  it('redacts local file paths on macOS, Linux, and Windows', () => {
    const redacted = redactDiagnosticText(
      'at /Users/someone/Documents/novel/backup.zip and /home/someone/x.json and C:\\Users\\Someone\\novel.docx and file:///Volumes/T7/x.txt'
    );
    expect(redacted).not.toContain('/Users/someone');
    expect(redacted).not.toContain('/home/someone');
    expect(redacted).not.toContain('C:\\Users');
    expect(redacted).not.toContain('/Volumes/T7');
  });

  it('redacts prose-length quoted text and leaves short labels alone', () => {
    const redacted = redactDiagnosticText(`Could not resolve "Salt Door" in "${MANUSCRIPT}"`);
    expect(redacted).toContain('"Salt Door"');
    expect(redacted).not.toContain('Brannic');
    expect(redacted).toContain('[redacted text]');
    expect(redactDiagnosticText('Did you mean this? Try again.')).toBe('Did you mean this? Try again.');
  });

  it('never serializes provider payloads, causes, or manuscript text attached to an error', () => {
    registerDiagnosticSecrets([OPENAI_KEY]);
    const error = new Error(`OpenAI API error: Unauthorized (${OPENAI_KEY})`, {
      cause: {request: {messages: [{role: 'user', content: MANUSCRIPT}]}, apiKey: ANTHROPIC_KEY}
    });
    (error as Error & {payload?: unknown}).payload = {prompt: MANUSCRIPT, path: '/Users/author/novel'};
    recordDiagnostic(error, {context: 'assistant reply', failureClass: 'auth'});

    const report = buildDiagnosticReport();
    expect(report).toContain('OpenAI API error: Unauthorized');
    expect(report).toContain('Where: assistant reply');
    expect(report).not.toContain(OPENAI_KEY);
    expect(report).not.toContain(ANTHROPIC_KEY);
    expect(report).not.toContain('Sera pressed');
    expect(report).not.toContain('/Users/author');
    expect(report).not.toContain('/Volumes/');
    expect(report).toContain('Manuscript text, project data, API keys, and file paths are not included.');

    const stored = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY) ?? '';
    expect(stored).not.toContain(OPENAI_KEY);
    expect(stored).not.toContain('Sera pressed');
  });

  it('keeps a bounded, persisted, newest-first log', () => {
    for (let index = 0; index < DIAGNOSTIC_ENTRY_LIMIT + 5; index += 1) {
      recordDiagnostic(new Error(`failure ${index}`));
    }
    expect(listDiagnostics()).toHaveLength(DIAGNOSTIC_ENTRY_LIMIT);
    expect(listDiagnostics()[0]?.message).toBe(`failure ${DIAGNOSTIC_ENTRY_LIMIT + 4}`);

    resetDiagnosticsForTests();
    expect(listDiagnostics()).toHaveLength(DIAGNOSTIC_ENTRY_LIMIT);

    clearDiagnostics();
    expect(listDiagnostics()).toHaveLength(0);
    expect(localStorage.getItem(DIAGNOSTIC_STORAGE_KEY)).toBeNull();
    expect(buildDiagnosticReport()).toContain('No errors recorded.');
  });

  it('captures uncaught errors and unhandled rejections from the target', () => {
    const target = new EventTarget();
    const uninstall = installGlobalDiagnosticCapture(target);
    target.dispatchEvent(new ErrorEvent('error', {error: new TypeError('x is not a function'), message: 'x is not a function'}));
    const rejection = new Event('unhandledrejection') as Event & {reason?: unknown};
    rejection.reason = new Error('Failed to fetch');
    target.dispatchEvent(rejection);
    uninstall();
    target.dispatchEvent(new ErrorEvent('error', {error: new Error('after uninstall'), message: 'after uninstall'}));

    const entries = listDiagnostics();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.context)).toEqual(['unhandled promise rejection', 'uncaught error']);
    expect(entries.map((entry) => entry.failureClass)).toEqual(['network', 'unknown']);
  });
});
