#!/usr/bin/env node
// Checks that every file path and code symbol named in docs/code-tour.md still
// exists (slice 3.33). Node built-ins only, so CI's tooling job can run it
// without installing dependencies.
//
// - A backticked token that looks like a path (contains "/" or ends in a known
//   extension) must exist, from the repository root or from apps/web/src/.
//   `<name>` placeholders and `:line` suffixes are not allowed in paths.
// - A backticked identifier with an uppercase letter, or starting with "use",
//   must appear as a whole word in a non-test source file under apps/ or
//   packages/. Lowercase words, commands, and channel names are not checked.
// - Fenced code blocks (the diagram) are skipped.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tourPath = path.join(root, 'docs/code-tour.md');
const pathBases = [root, path.join(root, 'apps/web/src')];
const sourceRoots = ['apps', 'packages'].map((dir) => path.join(root, dir));
const skipDirs = new Set(['node_modules', 'dist', 'build', 'release', 'out', 'coverage', '.vite']);
const sourceFile = /\.(ts|tsx|mjs|js)$/;
const testFile = /\.(test|spec)\.[cm]?[jt]sx?$/;
const pathLike = /\/|\.(ts|tsx|mjs|js|json|md|css|ya?ml)$/;
const identifier = /^[A-Za-z_$][\w$]*$/;

export function extractTokens(markdown) {
  const tokens = [];
  let fenced = false;
  markdown.split('\n').forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    for (const match of line.matchAll(/`([^`]+)`/g)) tokens.push({token: match[1], line: index + 1});
  });
  return tokens;
}

export const isPathToken = (token) => !/\s/.test(token) && pathLike.test(token) && !token.includes(':');
export const isSymbolToken = (token) =>
  identifier.test(token) && (/[A-Z]/.test(token) || /^use[A-Z]/.test(token));

function listSources(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry) || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) listSources(full, out);
    else if (sourceFile.test(entry) && !testFile.test(entry)) out.push(full);
  }
  return out;
}

function main() {
  const tokens = extractTokens(readFileSync(tourPath, 'utf8'));
  const source = sourceRoots.flatMap((dir) => listSources(dir)).map((file) => readFileSync(file, 'utf8')).join('\n');
  const problems = [];
  let paths = 0;
  let symbols = 0;
  for (const {token, line} of tokens) {
    if (isPathToken(token)) {
      paths += 1;
      const clean = token.replace(/\/$/, '');
      if (/[<>*]/.test(clean) || !pathBases.some((base) => existsSync(path.join(base, clean)))) {
        problems.push(`line ${line}: path not found: ${token}`);
      }
    } else if (isSymbolToken(token)) {
      symbols += 1;
      if (!new RegExp(`\\b${token.replace(/\$/g, '\\$')}\\b`).test(source)) {
        problems.push(`line ${line}: symbol not found in apps/ or packages/ sources: ${token}`);
      }
    }
  }
  if (problems.length) {
    console.error(`docs/code-tour.md names ${problems.length} thing(s) that no longer exist:`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('Update the tour in the same change that moved or renamed them.');
    process.exit(1);
  }
  console.log(`Code tour check passed (${paths} paths, ${symbols} symbols).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
