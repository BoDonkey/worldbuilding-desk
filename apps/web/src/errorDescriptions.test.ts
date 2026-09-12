import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

/**
 * Slice 5.6: raw exception text must not be rendered as the error UX. Every
 * call site that used to do `error instanceof Error ? error.message : '...'`
 * now goes through `describeError`, which keeps app-authored validation
 * messages, maps known failure classes to plain language, and sends the raw
 * text to the local diagnostics log instead of the screen. This guard keeps
 * the old pattern from creeping back into rendered code.
 */

const SRC_DIR = join(__dirname);
const RAW_MESSAGE_PATTERN = /(\w+) instanceof Error\s*\?\s*\1\.message\s*:/;
const ALLOWED_FILES = new Set([
  'services/errors/describeError.ts',
  'services/errors/diagnostics.ts',
  // Provider connection tests own a purpose-built mapper with provider-specific wording.
  'services/llm/connectionTest.ts',
  // Wraps the cause message into an author-facing migration error, not rendered raw.
  'services/storage/projectSchemaMigrations.ts'
]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue;
    if (fullPath === __filename) continue;
    files.push(fullPath);
  }
  return files;
}

describe('author-facing error descriptions', () => {
  it('routes raw error messages through describeError outside the allowlisted helpers', () => {
    const offenders = collectSourceFiles(SRC_DIR)
      .filter((file) => !ALLOWED_FILES.has(relative(SRC_DIR, file)))
      .filter((file) => RAW_MESSAGE_PATTERN.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });
});
