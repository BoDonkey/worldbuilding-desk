// Generates src/fixtures/trustDogfoodContent.generated.ts from the
// repo's fixtures/trust-dogfood/ files so the dev-only "Load trust-dogfood
// fixture" action on Projects seeds the exact manuscript, Source Notes, and
// ruleset the runbook expects. Run with --check to verify the generated
// module is current (the unit test and prebuild do this).
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const fixtureDir = path.join(repoRoot, 'fixtures', 'trust-dogfood');
const outputPath = path.join(here, '..', 'src', 'fixtures', 'trustDogfoodContent.generated.ts');
const checkOnly = process.argv.includes('--check');

const LORE_KIND_BY_FILE_PREFIX = [
  ['dossier-', 'character_dossier'],
  ['faction-', 'faction_notes'],
  ['places-', 'place_history'],
  ['working-notes-', 'general_lore']
];

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function splitTitleAndBody(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const title = headingIndex >= 0 ? lines[headingIndex].replace(/^#\s+/, '').trim() : '';
  const body = (headingIndex >= 0 ? lines.slice(headingIndex + 1) : lines).join('\n').trim();
  return {title, body};
}

function chapterToHtml(body) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

export async function buildTrustDogfoodContent() {
  const chapterFiles = (await readdir(path.join(fixtureDir, 'chapters'))).filter((f) => f.endsWith('.md')).sort();
  const chapters = [];
  for (const file of chapterFiles) {
    const markdown = await readFile(path.join(fixtureDir, 'chapters', file), 'utf8');
    const {title, body} = splitTitleAndBody(markdown);
    chapters.push({fileName: file, title, content: chapterToHtml(body)});
  }

  const loreFiles = (await readdir(path.join(fixtureDir, 'lore'))).filter((f) => f.endsWith('.md')).sort();
  const loreDocuments = [];
  for (const file of loreFiles) {
    const markdown = await readFile(path.join(fixtureDir, 'lore', file), 'utf8');
    const {title} = splitTitleAndBody(markdown);
    const kind = LORE_KIND_BY_FILE_PREFIX.find(([prefix]) => file.startsWith(prefix))?.[1] ?? 'general_lore';
    loreDocuments.push({fileName: file, title, kind, content: markdown.replace(/\r\n/g, '\n').trim()});
  }

  const rulesetPayload = JSON.parse(await readFile(path.join(fixtureDir, 'ruleset.emberledger.json'), 'utf8'));
  const ruleset = rulesetPayload.data.ruleset;

  const module =
    `// GENERATED FILE — do not edit. Source: fixtures/trust-dogfood/.\n` +
    `// Regenerate with: pnpm --filter web dogfood-fixture:build\n` +
    `import type {WorldRuleset} from '@worldbuilding-desk/rules-engine';\n\n` +
    `export interface TrustDogfoodChapter {\n  fileName: string;\n  title: string;\n  /** Scene HTML: one <p> per source paragraph, text escaped, no markdown interpretation. */\n  content: string;\n}\n\n` +
    `export interface TrustDogfoodLoreDocument {\n  fileName: string;\n  title: string;\n  kind: 'character_dossier' | 'faction_notes' | 'place_history' | 'general_lore';\n  /** Original markdown, unchanged. */\n  content: string;\n}\n\n` +
    `export const TRUST_DOGFOOD_CHAPTERS: TrustDogfoodChapter[] = ${JSON.stringify(chapters, null, 2)};\n\n` +
    `export const TRUST_DOGFOOD_LORE_DOCUMENTS: TrustDogfoodLoreDocument[] = ${JSON.stringify(loreDocuments, null, 2)};\n\n` +
    `export const TRUST_DOGFOOD_RULESET: WorldRuleset = ${JSON.stringify(ruleset, null, 2)} as WorldRuleset;\n`;
  return module;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const next = await buildTrustDogfoodContent();
  if (checkOnly) {
    let current = '';
    try {
      current = await readFile(outputPath, 'utf8');
    } catch {
      current = '';
    }
    if (current !== next) {
      console.error('trustDogfoodContent.generated.ts is out of date. Run: pnpm --filter web dogfood-fixture:build');
      process.exit(1);
    }
    console.log('trust-dogfood fixture content is current.');
  } else {
    await writeFile(outputPath, next);
    console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  }
}
