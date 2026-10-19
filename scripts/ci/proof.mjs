import {appendFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertResults, validProof} from './plan.mjs';

// Reuse only successful results. In particular, a cancelled/failed/pending code
// run followed by a documentation update must not yield an untested green PR.
export async function verifiedRun(proof, {fingerprint, force, repository, branch, event,
  runId, runNumber, token, headRepository = repository, api = 'https://api.github.com', fetcher = fetch}) {
  if (force || !validProof(proof, fingerprint) || !token) return false;
  const get = async (suffix) => {
    const response = await fetcher(`${api}/repos/${repository}/actions/${suffix}`, {
      headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'},
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Verification history unavailable');
    return response.json();
  };
  try {
    const [source, history] = await Promise.all([
      get(`runs/${proof.runId}`),
      get(`workflows/web-ci.yml/runs?branch=${encodeURIComponent(branch)}&event=${encodeURIComponent(event)}&per_page=30`)
    ]);
    const previous = history.workflow_runs.filter((run) => run.id !== runId && run.run_number < runNumber &&
      run.head_repository?.full_name === headRepository)
      .sort((a, b) => b.run_number - a.run_number)[0];
    return source.path === '.github/workflows/web-ci.yml' && source.status === 'completed' && source.conclusion === 'success' &&
      previous?.status === 'completed' && previous.conclusion === 'success';
  } catch {
    // A cache or API failure costs another test run; it never waives testing.
    return false;
  }
}

async function main() {
  const fingerprint = process.env.CI_FINGERPRINT;
  const file = path.join(process.env.RUNNER_TEMP, 'ci-verified', 'proof.json');
  if (process.argv.includes('--check')) {
    let proof;
    try { proof = JSON.parse(readFileSync(file, 'utf8')); } catch { /* Cache miss or corrupt proof. */ }
    const verified = await verifiedRun(proof, {fingerprint, force: process.env.CI_FORCE === 'true',
      repository: process.env.GITHUB_REPOSITORY, branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
      event: process.env.GITHUB_EVENT_NAME, runId: Number(process.env.GITHUB_RUN_ID),
      runNumber: Number(process.env.GITHUB_RUN_NUMBER), token: process.env.GH_TOKEN,
      headRepository: process.env.CI_HEAD_REPOSITORY, api: process.env.GITHUB_API_URL});
    console.log(verified ? 'Reusing successful verification of this exact code and coverage.' : 'Fresh verification required.');
    appendFileSync(process.env.GITHUB_OUTPUT, `verified=${verified}\n`);
    return;
  }
  const needs = JSON.parse(process.env.CI_RESULTS);
  assertResults(needs);
  if (needs.changes.outputs.application === 'true' && needs.changes.outputs.verified !== 'true') {
    if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Invalid application fingerprint.');
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, JSON.stringify({version: 1, fingerprint, runId: Number(process.env.GITHUB_RUN_ID)}));
  }
  console.log('All selected checks passed or reused a verified identical code tree.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
