import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Slice 5.10: internal codenames and ML jargon must never appear as
 * author-facing rendered text again ("Shodh" is an internal service name,
 * "RAG" is an ML-engineering term, "Rubber-Duck" was an internal codename
 * for canon-decision consultation). Internal service, type, and identifier
 * names are unchanged and out of scope here — the regexes below require the
 * word to stand alone (surrounded by non-word characters), which compound
 * identifiers like `ShodhMemoryService`, `getRAGService`, or `inheritShodh`
 * never satisfy, so this only catches the token appearing as a standalone
 * word the way rendered prose would use it.
 */

const SRC_DIR = join(__dirname);
const RETIRED_TOKEN_PATTERNS: Array<{name: string; pattern: RegExp}> = [
  {name: 'Shodh', pattern: /\bShodh\b/},
  {name: 'RAG', pattern: /\bRAG\b/},
  {name: 'Rubber-Duck', pattern: /\bRubber-Duck\b/}
];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    if (fullPath === __filename) continue;
    files.push(fullPath);
  }
  return files;
}

describe('author-facing vocabulary', () => {
  const sourceFiles = collectSourceFiles(SRC_DIR);

  it('scans a non-trivial number of source files', () => {
    // A sanity check on the scan itself: if this collapses to a handful of
    // files, the retired-token assertions below would be passing for the
    // wrong reason.
    expect(sourceFiles.length).toBeGreaterThan(200);
  });

  for (const {name, pattern} of RETIRED_TOKEN_PATTERNS) {
    it(`never uses the retired standalone word "${name}" in source`, () => {
      const offenders: string[] = [];
      for (const filePath of sourceFiles) {
        const content = readFileSync(filePath, 'utf-8');
        if (pattern.test(content)) {
          offenders.push(filePath.replace(SRC_DIR, 'src'));
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
