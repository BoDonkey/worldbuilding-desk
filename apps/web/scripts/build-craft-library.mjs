import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '../../..');
const sourcePath = path.join(workspaceRoot, 'content/craft-library/published/library.json');
const outputTsPath = path.join(scriptDirectory, '../src/generated/craftLibrary.generated.ts');
const outputDataPath = path.join(scriptDirectory, '../src/generated/craftLibrary.generated.data.json');
const checkOnly = process.argv.includes('--check');
const allowModelDownload = process.argv.includes('--allow-model-download');

const sourceText = await readFile(sourcePath, 'utf8');
const source = JSON.parse(sourceText);
validateSource(source);
const sourceDigest = createHash('sha256').update(sourceText).digest('hex');

if (checkOnly) {
  const generatedText = await readFile(outputDataPath, 'utf8');
  const generated = JSON.parse(generatedText);
  const matches =
    generated.contentVersion === source.contentVersion &&
    generated.sourceDigest === sourceDigest &&
    generated.embedding.model === source.embedding.model &&
    generated.embedding.version === source.embedding.version &&
    generated.embedding.dimensions === source.embedding.dimensions &&
    generated.embedding.normalization === source.embedding.normalization;
  if (!matches) {
    throw new Error(
      'Bundled craft library is stale. Run pnpm --filter web craft-library:build.'
    );
  }
  process.stdout.write('Bundled craft library matches its reviewed source.\n');
  process.exit(0);
}

const sourceChunks = source.records.flatMap(toSourceChunks);
let embed = null;
if (sourceChunks.length > 0) {
  const transformers = await import('@huggingface/transformers');
  const pipeline = await transformers.pipeline(
    'feature-extraction',
    source.embedding.model,
    {
      revision: source.embedding.version,
      local_files_only: !allowModelDownload
    }
  );
  embed = async (text) => {
    const output = await pipeline(text, {
      pooling: 'mean',
      normalize: source.embedding.normalization === 'l2'
    });
    const vector = Array.from(output.data ?? []);
    if (
      vector.length !== source.embedding.dimensions ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        `Embedding output does not match ${source.embedding.dimensions} dimensions`
      );
    }
    return vector;
  };
}

const chunks = [];
for (const sourceChunk of sourceChunks) {
  const embeddingText = [sourceChunk.title, sourceChunk.section, sourceChunk.content].join('\n');
  chunks.push({...sourceChunk, embedding: await embed(embeddingText)});
}

const manifest = {
  schemaVersion: 1,
  contentVersion: source.contentVersion,
  sourceDigest,
  embedding: source.embedding,
  chunks
};
await writeFile(outputDataPath, JSON.stringify(manifest), 'utf8');

// The manifest is data loaded at runtime, not a TS object literal: at full-corpus size a
// literal this large overflows TypeScript's structural checker (TS2590), whether written
// as a plain literal, a `satisfies` expression, or an explicit type annotation. The loader
// below is small and stable — it does not change across rebuilds — so it is hand-written
// once rather than regenerated; only craftLibrary.generated.data.json is produced by this
// script. Shape correctness of the data is enforced by validateSource/validateRecord above.
await writeFile(
  outputTsPath,
  [
    "import type {CraftLibraryManifest} from '../services/craft/types';",
    "import rawManifest from './craftLibrary.generated.data.json?raw';",
    '',
    '// Loader for craftLibrary.generated.data.json, produced by scripts/build-craft-library.mjs.',
    '// Do not hand-edit the data file. This loader is hand-written and stable; it need not',
    '// be regenerated when the data changes.',
    'export const bundledCraftLibrary = JSON.parse(rawManifest) as CraftLibraryManifest;',
    ''
  ].join('\n'),
  'utf8'
);
process.stdout.write(`Built ${chunks.length} craft chunks from ${source.records.length} records.\n`);

function validateSource(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || !isNonEmptyString(value.contentVersion)) {
    throw new Error('Craft library must have schemaVersion 1 and a contentVersion');
  }
  validateEmbedding(value.embedding);
  if (!Array.isArray(value.records)) {
    throw new Error('Craft library records must be an array');
  }
  const recordIds = new Set();
  for (const record of value.records) {
    validateRecord(record);
    if (recordIds.has(record.id)) {
      throw new Error(`Duplicate craft record id: ${record.id}`);
    }
    recordIds.add(record.id);
  }
}

function validateEmbedding(value) {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.model) ||
    !isNonEmptyString(value.version) ||
    !Number.isInteger(value.dimensions) ||
    value.dimensions <= 0 ||
    !['l2', 'none'].includes(value.normalization)
  ) {
    throw new Error('Invalid craft embedding contract');
  }
}

function validateRecord(record) {
  const requiredStrings = ['id', 'title', 'summary', 'family'];
  if (!isObject(record) || requiredStrings.some((key) => !isNonEmptyString(record[key]))) {
    throw new Error('Craft records require an id, title, and summary');
  }
  if (!Number.isInteger(record.version) || record.version < 1 || record.authorVetted !== true) {
    throw new Error(`Craft record ${record.id} must be versioned and author-vetted`);
  }
  if (!['pattern', 'comparison', 'profile'].includes(record.documentType)) {
    throw new Error(`Craft record ${record.id} has invalid document type`);
  }
  if (!['deterministic', 'model-assisted', 'practice'].includes(record.detectability)) {
    throw new Error(`Craft record ${record.id} has invalid detectability`);
  }
  validateStringArray(record.scopes, `${record.id}.scopes`, true);
  const validScopes = new Set(['selection', 'scene', 'chapter', 'manuscript', 'series', 'practice']);
  if (record.scopes.some((scope) => !validScopes.has(scope))) {
    throw new Error(`Craft record ${record.id} has invalid scopes`);
  }
  if (!isObject(record.applicability)) {
    throw new Error(`Craft record ${record.id} requires applicability`);
  }
  for (const key of ['genres', 'subgenres', 'exclusions']) {
    validateStringArray(record.applicability[key], `${record.id}.applicability.${key}`);
  }
  for (const key of ['modifiers', 'aliases', 'tags']) {
    validateStringArray(record[key], `${record.id}.${key}`);
  }
  if (!['high', 'medium', 'limited'].includes(record.sourceConfidence)) {
    throw new Error(`Craft record ${record.id} has invalid source confidence`);
  }
  if (!Array.isArray(record.citations) || record.citations.length === 0) {
    throw new Error(`Craft record ${record.id} requires at least one citation`);
  }
  for (const citation of record.citations) {
    if (!isObject(citation) || !isNonEmptyString(citation.id) || !isNonEmptyString(citation.label)) {
      throw new Error(`Craft record ${record.id} has an invalid citation`);
    }
    if (citation.url !== undefined && !isNonEmptyString(citation.url)) {
      throw new Error(`Craft record ${record.id} has an invalid citation URL`);
    }
  }
  if (!Array.isArray(record.sections) || record.sections.length === 0) {
    throw new Error(`Craft record ${record.id} requires at least one content section`);
  }
  for (const section of record.sections) {
    if (
      !isObject(section) ||
      !isNonEmptyString(section.id) ||
      !isNonEmptyString(section.title) ||
      !isNonEmptyString(section.content)
    ) {
      throw new Error(`Craft record ${record.id} has an invalid content section`);
    }
  }
  const sectionIds = new Set(record.sections.map((section) => section.id));
  const requiredSectionIds = ['what-it-is', 'present', 'absence', 'actions'];
  const missingSections = requiredSectionIds.filter((id) => !sectionIds.has(id));
  if (missingSections.length > 0) {
    throw new Error(
      `Craft record ${record.id} is missing required sections: ${missingSections.join(', ')}`
    );
  }
}

function toSourceChunks(record) {
  const shared = {
    recordId: record.id,
    recordVersion: record.version,
    title: record.title,
    metadata: {
      type: 'craft',
      authorVetted: true,
      documentType: record.documentType,
      family: record.family,
      detectability: record.detectability,
      scopes: record.scopes,
      genres: record.applicability.genres,
      subgenres: record.applicability.subgenres,
      exclusions: record.applicability.exclusions,
      modifiers: record.modifiers,
      tags: record.tags,
      aliases: record.aliases,
      sourceConfidence: record.sourceConfidence,
      citations: record.citations
    }
  };
  const sections = [{id: 'summary', title: 'Summary', content: record.summary}, ...record.sections];
  return sections.flatMap((section) =>
    chunkText(section.content).map((content, index) => ({
      id: `${record.id}@${record.version}:${section.id}:${index}`,
      ...shared,
      section: section.title,
      content
    }))
  );
}

function chunkText(text, maxLength = 1400) {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxLength) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function validateStringArray(value, label, requireValue = false) {
  if (
    !Array.isArray(value) ||
    (requireValue && value.length === 0) ||
    value.some((item) => !isNonEmptyString(item))
  ) {
    throw new Error(`${label} must be an array of strings`);
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
