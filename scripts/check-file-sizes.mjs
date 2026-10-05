#!/usr/bin/env node
// Hotspot freeze (Slice 3.14): fails when a non-test source file over
// LIMIT lines grows past its recorded baseline, or a new file crosses LIMIT.
// Shrinking is always allowed; run with --update to record the new sizes.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const LIMIT = 1500;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'scripts', 'file-size-baseline.json');
const SOURCE = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const TEST = /\.(test|spec|cy)\.[^/]+$|\/(test|__tests__)\//;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8'
})
  .split('\n')
  .filter((file) => SOURCE.test(file) && !TEST.test(file) && existsSync(path.join(root, file)));

const countLines = (file) => {
  const text = readFileSync(path.join(root, file), 'utf8');
  if (!text) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
};

const sizes = Object.fromEntries(
  files.map((file) => [file, countLines(file)]).filter(([, lines]) => lines > LIMIT).sort(([a], [b]) => a.localeCompare(b))
);

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, `${JSON.stringify(sizes, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(sizes).length} files over ${LIMIT} lines in scripts/file-size-baseline.json.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const failures = [];
for (const [file, lines] of Object.entries(sizes)) {
  const allowed = baseline[file] ?? LIMIT;
  if (lines > allowed) {
    failures.push(
      baseline[file]
        ? `${file}: ${lines} lines, baseline ${allowed}. Extract code instead of growing it.`
        : `${file}: ${lines} lines, over the ${LIMIT}-line limit. Split it before it grows further.`
    );
  }
}
const shrunk = Object.entries(baseline).filter(([file, allowed]) => (sizes[file] ?? 0) < allowed);

if (failures.length > 0) {
  console.error(`File size check failed:\n${failures.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`File size check passed (${Object.keys(sizes).length} files over ${LIMIT} lines, none grew).`);
if (shrunk.length > 0) {
  console.log(
    `Smaller than baseline (run "pnpm check:file-sizes --update" to lock in): ${shrunk
      .map(([file]) => file)
      .join(', ')}`
  );
}
