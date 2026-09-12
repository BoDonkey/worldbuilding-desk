import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CURRENT_PROJECT_SCHEMA_VERSION} from '../services/storage/projectSchemaMigrations';

describe('Cypress smoke seed schema version', () => {
  it('seeds projects at the current storage schema so no load-time migration races spec DB writes', () => {
    const commands = readFileSync(join(__dirname, '..', '..', 'cypress', 'support', 'commands.ts'), 'utf8');
    const match = commands.match(/const SEED_PROJECT_STORAGE_SCHEMA_VERSION = (\d+);/);
    expect(match, 'SEED_PROJECT_STORAGE_SCHEMA_VERSION constant missing from cypress/support/commands.ts').not.toBeNull();
    expect(Number(match?.[1])).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
  });
});
