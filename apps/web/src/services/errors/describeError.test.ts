import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {classifyError, describeError} from './describeError';
import {listDiagnostics, resetDiagnosticsForTests} from './diagnostics';
import {ProjectMigrationError} from '../storage/projectSchemaMigrations';

describe('describeError', () => {
  beforeEach(() => {
    resetDiagnosticsForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps app-authored validation messages verbatim', () => {
    expect(describeError(new Error('This character already has a mechanics sheet.'), 'Unable to save.')).toBe(
      'This character already has a mechanics sheet.'
    );
    expect(classifyError(new Error('Scene is required.'))).toBe('app-message');
    expect(classifyError(new Error('Chapter 3 has 500 words and 429 quoted lines.'))).toBe('app-message');
    expect(classifyError(new Error('Ollama responded with 503 Service Unavailable.'))).toBe('provider-unavailable');
    expect(classifyError(new Error('Ollama model lookup failed: 429 Too Many Requests'))).toBe('quota');
  });

  it('falls back for non-Error throws and technical runtime failures', () => {
    expect(describeError(undefined, 'Unable to save scene.')).toBe('Unable to save scene.');
    expect(describeError('boom', 'Unable to save scene.')).toBe('Unable to save scene.');
    expect(describeError(new TypeError("Cannot read properties of undefined (reading 'id')"), 'Unable to load.')).toBe(
      'Unable to load.'
    );
    expect(describeError(new SyntaxError('Unexpected token < in JSON at position 0'), 'Unable to parse backup zip.')).toBe(
      'Unable to parse backup zip.'
    );
    expect(describeError(new Error(''), 'Unable to save.')).toBe('Unable to save.');
    expect(describeError(new Error('OpenAI API error: '), 'The assistant could not answer.')).toBe(
      'The assistant could not answer.'
    );
  });

  it('maps network failures to plain language, naming the provider when known', () => {
    expect(describeError(new TypeError('Failed to fetch'), 'x')).toBe(
      'Could not reach the network. Check your connection and try again.'
    );
    expect(describeError(new Error('Ollama API error: fetch failed'), 'x')).toBe(
      'Could not reach Ollama. Check that it is running on this computer, then try again.'
    );
    expect(describeError(new Error('Anthropic API error: ECONNREFUSED'), 'x')).toBe(
      'Could not reach Anthropic. Check your internet connection and try again.'
    );
  });

  it('maps auth, quota, and provider outages', () => {
    expect(describeError(new Error('OpenAI API error: Unauthorized'), 'x')).toBe(
      'OpenAI rejected the API key. Check it under Settings → AI Settings.'
    );
    expect(describeError(new Error('Gemini API error: Too Many Requests'), 'x')).toContain(
      'Google Gemini limited this request'
    );
    expect(describeError(new Error('Anthropic API error: Service Unavailable'), 'x')).toBe(
      'Anthropic is temporarily unavailable. Your work is saved locally; try again in a few minutes.'
    );
    expect(describeError(new Error('Anthropic API key is missing.'), 'x')).toBe('Anthropic API key is missing.');
  });

  it('maps storage-full and schema-too-new failures', () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    expect(classifyError(quota)).toBe('storage-full');
    expect(describeError(quota, 'x')).toContain('local storage for the app is full');

    const newer = new Error(
      'Backup project data uses storage schema 9, but this app supports up to 5. Update the app before importing it.'
    );
    expect(classifyError(newer)).toBe('schema-too-new');
    expect(describeError(newer, 'x')).toBe(
      'This project was saved by a newer version of Worldbuilding Desk. Update the app to open it.'
    );
    const versionError = new DOMException('The requested version (26) is less than the existing version (30).', 'VersionError');
    expect(classifyError(versionError)).toBe('schema-too-new');
  });

  it('keeps the migration error message, which already tells the author what to restore', () => {
    const error = new ProjectMigrationError({projectId: 'p1', backupId: 'b1', cause: new Error('boom')});
    expect(classifyError(error)).toBe('migration');
    expect(describeError(error, 'x')).toContain('Restore backup "b1"');
  });

  it('records every described error in the local diagnostics log', () => {
    describeError(new Error('Failed to fetch'), 'x', {context: 'assistant'});
    describeError(new Error('Scene is required.'), 'x');
    const entries = listDiagnostics();
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({context: 'assistant', failureClass: 'network', message: 'Failed to fetch'});
    expect(entries[0]).toMatchObject({failureClass: 'app-message'});
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('can skip recording for errors already logged upstream', () => {
    describeError(new Error('Failed to fetch'), 'x', {record: false});
    expect(listDiagnostics()).toHaveLength(0);
  });
});
