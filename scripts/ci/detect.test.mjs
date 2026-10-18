import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const detector = fileURLToPath(new URL('./detect.mjs', import.meta.url));
const runner = fileURLToPath(new URL('./run-cypress.mjs', import.meta.url));
const cleanEnv = () => Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !key.startsWith('GITHUB_') && !key.startsWith('CI_') && key !== 'GH_TOKEN'));

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wbd-ci-policy-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const repo = path.join(dir, 'repo');
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8'}).trim();
  git('init', '--quiet');
  git('config', 'user.email', 'ci-fixture@example.invalid');
  git('config', 'user.name', 'CI Fixture');
  const put = (file, text) => { mkdirSync(path.dirname(path.join(repo, file)), {recursive: true}); writeFileSync(path.join(repo, file), text); };
  put('apps/web/cypress/e2e/first.cy.ts', '// first\n');
  put('apps/web/cypress/e2e/nested/Second_test.cy.ts', '// second\n');
  put('apps/web/src/projectStorage.ts', '// storage\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'fixture base');
  const base = git('rev-parse', 'HEAD');
  const detect = (extra = {}) => {
    const output = path.join(dir, 'outputs');
    const result = spawnSync(process.execPath, [detector], {cwd: repo, encoding: 'utf8',
      env: {...cleanEnv(), CI_BASE_SHA: base, GITHUB_OUTPUT: output, ...extra}});
    return {...result, plan: result.status === 0 ? JSON.parse(result.stdout) : null, output};
  };
  return {dir, repo, git, put, base, detect};
}

test('local pre-commit plans include untracked runtime files and reject reusable fingerprints', (t) => {
  const {put, detect} = fixture(t);
  put('apps/web/src/services/new-service.ts', '// uncommitted\n');
  const {status, plan} = detect();
  assert.equal(status, 0);
  assert.equal(plan.mode, 'full');
  assert.equal(plan.fingerprint, null);
  assert(plan.files.includes('apps/web/src/services/new-service.ts'));
  assert.equal(detect({GITHUB_ACTIONS: 'true'}).status, 1);
});

test('committed PR documentation uses the cumulative base diff and a merge-tree fingerprint', (t) => {
  const {put, git, detect, dir, base} = fixture(t);
  put('docs/status.md', 'updated\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'docs');
  const event = path.join(dir, 'event.json');
  writeFileSync(event, JSON.stringify({pull_request: {base: {sha: base}, labels: []}}));
  const {status, plan, output} = detect({GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: event});
  assert.equal(status, 0);
  assert.equal(plan.mode, 'none');
  assert.equal(plan.application, false);
  assert.match(readFileSync(output, 'utf8'), /application=false/);
  const hash = plan.fingerprint;
  put('docs/status.md', 'another documentation update\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'more docs');
  assert.equal(detect().plan.fingerprint, hash);
});

test('a deleted runtime file cannot disappear from classification; invalid bases fail conservatively', (t) => {
  const {git, detect} = fixture(t);
  git('rm', 'apps/web/src/projectStorage.ts');
  git('commit', '--quiet', '-m', 'remove storage');
  const result = detect({GITHUB_ACTIONS: 'true'});
  assert.equal(result.plan.mode, 'full');
  assert(result.plan.files.includes('apps/web/src/projectStorage.ts'));
  assert.equal(result.plan.specs.length, 2);
  assert.equal(detect({CI_BASE_SHA: 'missing-ref'}).plan.mode, 'full');
});

test('new specs are discovered locally; explicit reruns and manual runs request the full suite', (t) => {
  const {put, detect} = fixture(t);
  put('apps/web/cypress/e2e/new.cy.ts', '// new\n');
  assert.deepEqual(detect().plan.specs, ['cypress/e2e/new.cy.ts']);
  assert.equal(detect({GITHUB_EVENT_NAME: 'workflow_dispatch'}).plan.mode, 'full');
  assert.equal(detect({GITHUB_RUN_ATTEMPT: '2'}).plan.mode, 'full');
});

test('Cypress wrapper rejects empty selections and passes a selected group as one argument without retries', (t) => {
  const {dir} = fixture(t);
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const capture = path.join(dir, 'args.json');
  writeFileSync(path.join(bin, 'pnpm'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.CAPTURE, JSON.stringify(process.argv.slice(2)));\n`, {mode: 0o755});
  const env = {...cleanEnv(), PATH: `${bin}${path.delimiter}${process.env.PATH}`, CAPTURE: capture};
  assert.equal(spawnSync(process.execPath, [runner], {env, encoding: 'utf8'}).status, 1);
  assert.equal(spawnSync(process.execPath, [runner], {env: {...env, CI_CYPRESS_SPECS: 'bad;path'}, encoding: 'utf8'}).status, 1);
  const specs = 'cypress/e2e/first.cy.ts,cypress/e2e/nested/Second_test.cy.ts';
  assert.equal(spawnSync(process.execPath, [runner], {env: {...env, CI_CYPRESS_SPECS: specs}}).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(capture, 'utf8')), ['--filter', 'web', 'e2e:run', '--config', 'retries=0', '--spec', specs]);
});
