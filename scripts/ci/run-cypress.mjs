import {spawnSync} from 'node:child_process';

const specs = process.env.CI_CYPRESS_SPECS;
if (!specs || specs.split(',').some((spec) => !/^cypress\/e2e\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.cy\.ts$/.test(spec))) {
  throw new Error('Refusing an empty or invalid Cypress spec selection.');
}
const result = spawnSync('pnpm', ['--filter', 'web', 'e2e:run', '--config', 'retries=0', '--spec', specs], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
