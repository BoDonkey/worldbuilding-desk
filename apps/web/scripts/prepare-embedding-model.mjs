#!/usr/bin/env node
/*
 * Puts the search (embedding) model and its WebAssembly runtime into
 * public/models, so the app ships them and never downloads them at run time.
 * Model files come from Hugging Face at the pinned revision and must match
 * the sha256 in embedding-model/manifest.json; files already present and
 * matching are kept. The runtime files are copied from the onnxruntime-web
 * version transformers.js depends on. Notices and licenses are copied too.
 *
 *   node scripts/prepare-embedding-model.mjs          download if needed
 *   node scripts/prepare-embedding-model.mjs --check  verify only, no network
 */
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(webRoot, 'embedding-model');
const manifest = JSON.parse(readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
const outputRoot = path.join(webRoot, 'public', 'models');
const modelDir = path.join(outputRoot, ...manifest.model.split('/'));
const runtimeDir = path.join(outputRoot, 'onnxruntime');
const checkOnly = process.argv.includes('--check');

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const fileMatches = (file, expected) => existsSync(file) && sha256(readFileSync(file)) === expected;

async function download(relativePath, expected) {
  const url = `https://huggingface.co/${manifest.model}/resolve/${manifest.revision}/${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  const actual = sha256(data);
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${relativePath}: expected ${expected}, got ${actual}.`);
  }
  return data;
}

/** Node's lookup for `name`, starting at `fromDir`, without needing the package's exports. */
function findPackageDir(fromDir, name) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(path.join(candidate, 'package.json'))) return realpathSync(candidate);
    if (path.dirname(dir) === dir) throw new Error(`Cannot find ${name} from ${fromDir}. Run pnpm install.`);
  }
}

/** The onnxruntime-web build transformers.js itself depends on. */
function runtimeSourceDir() {
  const transformersDir = findPackageDir(webRoot, '@huggingface/transformers');
  const ortDir = findPackageDir(path.dirname(transformersDir), manifest.runtime.package);
  return path.join(ortDir, 'dist');
}

const problems = [];
for (const [relativePath, expected] of Object.entries(manifest.files)) {
  const target = path.join(modelDir, ...relativePath.split('/'));
  if (fileMatches(target, expected)) continue;
  if (checkOnly) {
    problems.push(`${relativePath} is missing or does not match its checksum`);
    continue;
  }
  mkdirSync(path.dirname(target), {recursive: true});
  const data = await download(relativePath, expected);
  writeFileSync(`${target}.tmp`, data);
  renameSync(`${target}.tmp`, target);
  process.stdout.write(`Downloaded ${relativePath}\n`);
}

const runtimeSource = runtimeSourceDir();
for (const fileName of manifest.runtime.files) {
  const source = path.join(runtimeSource, fileName);
  const target = path.join(runtimeDir, fileName);
  if (!existsSync(source)) throw new Error(`Missing runtime file ${source}. Run pnpm install.`);
  if (existsSync(target) && sha256(readFileSync(source)) === sha256(readFileSync(target))) continue;
  if (checkOnly) {
    problems.push(`runtime ${fileName} is missing or differs from ${runtimeSource}`);
    continue;
  }
  mkdirSync(runtimeDir, {recursive: true});
  copyFileSync(source, target);
}

if (!checkOnly) {
  for (const fileName of ['NOTICE.txt', 'LICENSE-Apache-2.0.txt', 'LICENSE-onnxruntime.txt']) {
    copyFileSync(path.join(sourceDir, fileName), path.join(outputRoot, fileName));
  }
}

if (problems.length > 0) {
  process.stderr.write(`Embedding model is not ready:\n- ${problems.join('\n- ')}\nRun pnpm --filter web embedding-model:prepare.\n`);
  process.exit(1);
}
process.stdout.write(`Embedding model ready in ${path.relative(webRoot, outputRoot)}.\n`);
