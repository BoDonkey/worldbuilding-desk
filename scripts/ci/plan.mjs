import {createHash} from 'node:crypto';

// These files cannot affect the application. Everything unknown is treated as code.
export const isDocumentation = (file) => /^(README\.md|PROJECT_STATUS\.md|AGENTS\.md|docs\/.*\.md)$/.test(file);
export const isTooling = (file) => ['scripts/check-file-sizes.mjs', 'scripts/file-size-baseline.json'].includes(file);
const isUnitTest = (file) => /^(apps|packages)\//.test(file) && /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const specPrefix = 'apps/web/';

// Narrow UI scopes only. Shared routes, hooks, services, state, IPC, imports,
// dependencies, CI policy, and unmapped paths always get the complete suite.
const uiScopes = [
  [/^apps\/web\/src\/(components\/Settings\/|assets\/components\/(Settings\/|AISettings\.module\.css$)|styles\/SettingsRoute\.module\.css$)/,
    ['ai-provider-setup', 'consultation-budget', 'scene-drafts', 'character-lab']],
  [/^apps\/web\/src\/(components\/SourceNotes\/)/,
    ['lore-documents', 'world-bible-import', 'world-canvas', 'canon-decisions', 'ask-project']],
  [/^apps\/web\/src\/(components\/Corkboard\/|styles\/CorkboardRoute\.module\.css$)/,
    ['corkboard-route', 'workspace-corkboard-links', 'post-merge-smoke', 'world-canvas']],
  [/^apps\/web\/src\/styles\/ProjectsRoute\.module\.css$/,
    ['project-deletion', 'portable-data', 'onboarding', 'post-merge-smoke', 'project-vault', 'encrypted-backup']]
];

export function createPlan(files, allSpecs, {forceFull = false, main = false} = {}) {
  const specs = [...new Set(allSpecs)].sort();
  if (!specs.length || specs.some((spec) => !/^cypress\/e2e\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.cy\.ts$/.test(spec))) {
    throw new Error('Expected a nonempty list of supported Cypress spec paths.');
  }
  let application = main || forceFull;
  let full = main || forceFull;
  const selected = new Set();
  for (const file of files) {
    if (isDocumentation(file) || isTooling(file)) continue;
    application = true;
    if (isUnitTest(file)) continue;
    if (file.startsWith(`${specPrefix}cypress/e2e/`)) {
      const spec = file.slice(specPrefix.length);
      if (specs.includes(spec)) selected.add(spec);
      else full = true; // A deleted spec changes coverage; run all remaining specs.
      continue;
    }
    const scope = /\.(tsx|css)$/.test(file) && uiScopes.find(([pattern]) => pattern.test(file));
    if (!scope) { full = true; continue; }
    for (const name of scope[1]) {
      const spec = `cypress/e2e/${name}.cy.ts`;
      if (specs.includes(spec)) selected.add(spec);
      else full = true; // A stale mapping must never silently narrow coverage.
    }
  }
  const browserSpecs = full ? specs : [...selected].sort();
  const mode = full ? 'full' : browserSpecs.length ? 'focused' : 'none';
  const groups = Array.from({length: Math.min(3, browserSpecs.length)}, () => []);
  browserSpecs.forEach((spec, index) => groups[index % groups.length].push(spec));
  const matrix = {include: groups.length
    ? groups.map((group, index) => ({shard: index + 1, specs: group.join(',')}))
    : [{shard: 0, specs: ''}]};
  return {application, mode, specs: browserSpecs, matrix};
}

export function fingerprintTree(entries, plan) {
  const relevant = entries.filter(({path}) => !isDocumentation(path) && !isTooling(path))
    .sort((a, b) => a.path.localeCompare(b.path));
  return createHash('sha256').update(JSON.stringify({version: 1, entries: relevant,
    application: plan.application, mode: plan.mode, specs: plan.specs})).digest('hex');
}

export function validProof(proof, fingerprint) {
  return /^[a-f0-9]{64}$/.test(fingerprint ?? '') && proof?.version === 1 && proof.fingerprint === fingerprint &&
    Number.isSafeInteger(proof.runId) && proof.runId > 0;
}

// A skipped dependency must not turn a failed planner or an unexpectedly skipped
// selected test job into a successful required check.
export function assertResults(needs) {
  for (const job of ['changes', 'tooling-verify']) {
    if (needs[job]?.result !== 'success') throw new Error(`${job} did not succeed.`);
  }
  const {application, mode, verified} = needs.changes.outputs;
  if (!['true', 'false'].includes(application) || !['none', 'focused', 'full'].includes(mode) ||
      !['true', 'false'].includes(verified)) throw new Error('Invalid verification plan.');
  if (application === 'false' && (mode !== 'none' || verified !== 'false')) {
    throw new Error('Non-application changes cannot request or reuse application checks.');
  }
  const runApplication = application === 'true' && verified !== 'true';
  for (const job of ['web-verify', 'desktop-verify', 'desktop-e2e', 'cypress-run']) {
    const required = job === 'web-verify' ? application === 'true'
      : runApplication && (job !== 'cypress-run' || mode !== 'none');
    const expected = required ? 'success' : 'skipped';
    if (needs[job]?.result !== expected) throw new Error(`${job}: expected ${expected}, got ${needs[job]?.result}.`);
  }
}
