import {execFileSync} from 'node:child_process';
import {appendFileSync, existsSync, readFileSync} from 'node:fs';
import {createPlan, fingerprintTree} from './plan.mjs';

const git = (...args) => execFileSync('git', args, {encoding: 'utf8'});
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
const kind = process.env.GITHUB_EVENT_NAME;
const forceFull = kind === 'workflow_dispatch' || Number(process.env.GITHUB_RUN_ATTEMPT) > 1 || event.pull_request?.labels?.some(({name}) => name === 'ci:full');
const main = kind === 'push';
const base = process.env.CI_BASE_SHA ?? event.pull_request?.base?.sha ?? event.before ?? 'origin/main';
// A missing/zero base fails conservatively: full verification, never an empty diff.
let files;
try {
  if (/^0+$/.test(base)) throw new Error('No previous revision');
  files = git('diff', '--name-only', '--no-renames', '-z', base, 'HEAD', '--').split('\0').filter(Boolean);
} catch {
  files = ['unknown-base'];
}
const dirty = [...git('diff', '--name-only', '--no-renames', '-z', 'HEAD', '--').split('\0'),
  ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean);
if (process.env.GITHUB_ACTIONS === 'true' && dirty.length) throw new Error('CI requires a clean checked-out tree.');
files = [...new Set([...files, ...dirty])];
const specs = git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'apps/web/cypress/e2e')
  .split('\0').filter((file) => file.endsWith('.cy.ts') && existsSync(file)).map((file) => file.slice('apps/web/'.length));
const plan = createPlan(files, specs, {forceFull, main});
// Use the checked-out merge tree, not the PR head alone: base-branch changes
// must invalidate a previously successful proof too. Include paths and modes.
const entries = git('ls-tree', '-r', '-z', 'HEAD').split('\0').filter(Boolean).map((line) => {
  const tab = line.indexOf('\t');
  return {path: line.slice(tab + 1), object: line.slice(0, tab)};
});
// Local plans include uncommitted paths for pre-commit verification, but cannot
// produce reusable proof of a tree that has not been committed.
const fingerprint = dirty.length ? null : fingerprintTree(entries, plan);
const outputs = {application: plan.application, mode: plan.mode, matrix: JSON.stringify(plan.matrix),
  fingerprint, key: `web-ci-verified-v1-${fingerprint}`, force: Boolean(forceFull)};
console.log(JSON.stringify({files, ...plan, fingerprint}, null, 2));
if (process.env.GITHUB_OUTPUT) {
  for (const [key, value] of Object.entries(outputs)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
