import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createPlan, fingerprintTree, assertResults, validProof} from './plan.mjs';
import {verifiedRun} from './proof.mjs';

const specs = execFileSync('git', ['ls-files', 'apps/web/cypress/e2e'], {encoding: 'utf8'})
  .trim().split('\n').filter((file) => file.endsWith('.cy.ts')).map((file) => file.slice('apps/web/'.length));
const full = (files) => assert.equal(createPlan(files, specs).mode, 'full');

test('documentation and known tooling never require application checks', () => {
  for (const file of ['docs/road-to-market.md', 'README.md', 'PROJECT_STATUS.md', 'AGENTS.md',
    'scripts/check-file-sizes.mjs', 'scripts/file-size-baseline.json']) {
    const plan = createPlan([file], specs);
    assert.equal(plan.application, false, file);
    assert.equal(plan.mode, 'none', file);
  }
});

test('high-risk, broad, shared, and unknown changes always select full coverage', () => {
  for (const file of ['apps/web/src/projectStorage.ts', 'apps/web/src/db.ts',
    'apps/web/src/services/storage/projectBackupImport.ts', 'apps/web/src/services/canonDecisions/accept.ts',
    'apps/web/src/hooks/useWorkspaceSceneRoster.ts', 'apps/web/src/routes/CompendiumRoute.tsx',
    'apps/desktop/src/main/apiHandler.ts', 'packages/rules-engine/src/index.ts',
    'apps/web/src/styles/theme.css', 'pnpm-lock.yaml', 'package.json',
    '.github/workflows/web-ci.yml', 'scripts/ci/plan.mjs', 'scripts/new-build-step.mjs',
    'apps/web/cypress/support/commands.ts', 'fixtures/trust-dogfood/manuscript.md',
    'apps/web/src/data/reference.md', 'unknown']) full([file]);
});

test('unit-only changes get the fast application checks without browser tests', () => {
  const plan = createPlan(['apps/web/src/services/state/replay.test.ts'], specs);
  assert.equal(plan.application, true);
  assert.equal(plan.mode, 'none');
});

test('localized Source Notes UI selects its explicit downstream workflows', () => {
  const plan = createPlan(['apps/web/src/components/SourceNotes/SourceNoteStarterPanel.tsx'], specs);
  assert.equal(plan.mode, 'focused');
  assert.deepEqual(plan.specs, ['ask-project', 'canon-decisions', 'lore-documents', 'world-bible-import', 'world-canvas']
    .map((name) => `cypress/e2e/${name}.cy.ts`).sort());
  full(['apps/web/src/components/SourceNotes/SourceNoteStarterPanel.tsx', 'apps/web/src/loreStorage.ts']);
});

test('spec changes select that spec; deleted specs and stale mappings widen coverage', () => {
  const plan = createPlan(['apps/web/cypress/e2e/project-deletion.cy.ts'], specs);
  assert.deepEqual(plan.specs, ['cypress/e2e/project-deletion.cy.ts']);
  full(['apps/web/cypress/e2e/removed.cy.ts']);
  assert.equal(createPlan(['apps/web/src/components/SourceNotes/Note.tsx'],
    specs.filter((spec) => !spec.includes('lore-documents'))).mode, 'full');
});

test('every full-suite spec appears once across at most three nonempty groups', () => {
  const plan = createPlan(['unknown'], specs);
  const selected = plan.matrix.include.flatMap(({specs}) => specs.split(','));
  assert.equal(plan.matrix.include.length, 3);
  assert.deepEqual(selected.sort(), [...specs].sort());
  assert.equal(new Set(selected).size, specs.length);
  assert.throws(() => createPlan([], []));
  assert.throws(() => createPlan([], ['cypress/e2e/bad;name.cy.ts']));
});

test('main and explicit full requests cannot narrow coverage to a documentation diff', () => {
  for (const options of [{main: true}, {forceFull: true}]) {
    const plan = createPlan(['docs/road-to-market.md'], specs, options);
    assert.equal(plan.application, true);
    assert.equal(plan.mode, 'full');
    assert.equal(plan.specs.length, specs.length);
  }
});

test('fingerprints ignore only approved docs/tooling; include base changes, modes, policy and coverage', () => {
  const plan = createPlan(['unknown'], specs);
  const entries = [{path: 'apps/web/src/App.tsx', object: '100644 blob a'},
    {path: 'docs/road-to-market.md', object: '100644 blob d'},
    {path: 'scripts/check-file-sizes.mjs', object: '100644 blob t'}];
  const hash = fingerprintTree(entries, plan);
  assert.equal(hash, fingerprintTree([entries[0], {...entries[1], object: 'new'}, {...entries[2], object: 'new'}], plan));
  assert.notEqual(hash, fingerprintTree([{...entries[0], object: '100644 blob base-changed'}], plan));
  assert.notEqual(hash, fingerprintTree([{...entries[0], object: '100755 blob a'}], plan));
  assert.notEqual(hash, fingerprintTree([...entries, {path: 'scripts/ci/plan.mjs', object: '100644 blob c'}], plan));
  assert.notEqual(hash, fingerprintTree(entries, createPlan(['apps/web/cypress/e2e/project-deletion.cy.ts'], specs)));
});

const needsFor = ({application = 'true', mode = 'full', verified = 'false'} = {}) => ({
  changes: {result: 'success', outputs: {application, mode, verified}},
  'tooling-verify': {result: 'success'},
  'web-verify': {result: application === 'true' ? 'success' : 'skipped'},
  'desktop-verify': {result: application === 'true' && verified === 'false' ? 'success' : 'skipped'},
  'desktop-e2e': {result: application === 'true' && verified === 'false' ? 'success' : 'skipped'},
  'cypress-run': {result: application === 'true' && verified === 'false' && mode !== 'none' ? 'success' : 'skipped'}
});

test('the required check accepts only intentional skips and fails on failed planning or selected jobs', () => {
  for (const options of [{}, {application: 'false', mode: 'none'}, {mode: 'focused'}, {mode: 'none'}, {verified: 'true'}]) {
    assert.doesNotThrow(() => assertResults(needsFor(options)));
  }
  for (const job of Object.keys(needsFor())) {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      const needs = needsFor();
      needs[job].result = result;
      assert.throws(() => assertResults(needs), undefined, `${job}: ${result}`);
    }
  }
  assert.throws(() => assertResults(needsFor({verified: ''})));
  assert.throws(() => assertResults(needsFor({application: 'false', mode: 'full'})));
  assert.throws(() => assertResults(needsFor({application: 'false', mode: 'none', verified: 'true'})));
});

const proof = {version: 1, fingerprint: 'f'.repeat(64), runId: 10};
const options = {fingerprint: proof.fingerprint, force: false, repository: 'owner/repo', branch: 'codex/task',
  event: 'pull_request', runId: 12, runNumber: 12, token: 'test-token'};
const apiFor = (conclusion = 'success', status = 'completed', sourceConclusion = 'success') => async (url) => ({
  ok: true, json: async () => url.includes('/runs?')
    ? {workflow_runs: [{id: 12, run_number: 12, status: 'in_progress'},
        {id: 11, run_number: 11, status, conclusion, head_repository: {full_name: 'owner/repo'}}]}
    : {path: '.github/workflows/web-ci.yml', status: 'completed', conclusion: sourceConclusion}
});

test('verified identical content may reuse a successful proof after a successful previous run', async () => {
  assert.equal(await verifiedRun(proof, {...options, fetcher: apiFor()}), true);
  assert.equal(validProof({...proof, runId: '../other'}, proof.fingerprint), false);
});

test('cancelled, failed, pending, corrupt, missing, stale, manual, and unavailable proofs cannot waive tests', async () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out']) {
    assert.equal(await verifiedRun(proof, {...options, fetcher: apiFor(conclusion)}), false);
  }
  assert.equal(await verifiedRun(proof, {...options, fetcher: apiFor('', 'in_progress')}), false);
  assert.equal(await verifiedRun(proof, {...options, fetcher: apiFor('success', 'completed', 'failure')}), false);
  for (const candidate of [undefined, {}, {...proof, fingerprint: 'wrong'}]) {
    assert.equal(await verifiedRun(candidate, {...options, fetcher: apiFor()}), false);
  }
  assert.equal(await verifiedRun(proof, {...options, force: true, fetcher: apiFor()}), false);
  assert.equal(await verifiedRun(proof, {...options, token: undefined, fetcher: apiFor()}), false);
  assert.equal(await verifiedRun(proof, {...options, headRepository: 'different/fork', fetcher: apiFor()}), false);
  assert.equal(await verifiedRun(proof, {...options, fetcher: async () => { throw new Error('API unavailable'); }}), false);
});
