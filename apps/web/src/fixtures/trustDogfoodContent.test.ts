import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildTrustDogfoodContent} from '../../scripts/build-trust-dogfood-content.mjs';
import {TRUST_DOGFOOD_CHAPTERS, TRUST_DOGFOOD_LORE_DOCUMENTS, TRUST_DOGFOOD_RULESET} from './trustDogfoodContent.generated';

describe('trust-dogfood generated content', () => {
  it('matches the fixture files on disk (run pnpm --filter web dogfood-fixture:build after editing them)', async () => {
    const current = readFileSync(join(__dirname, 'trustDogfoodContent.generated.ts'), 'utf8');
    expect(current).toBe(await buildTrustDogfoodContent());
  });

  it('carries the runbook inventory: five chapters, four lore documents, the Ember Ledger ruleset', () => {
    expect(TRUST_DOGFOOD_CHAPTERS.map((chapter) => chapter.fileName)).toEqual([
      '01-the-salt-door.md',
      '02-the-ledgerbound.md',
      '03-the-weighing-house.md',
      '04-sorrowsteel.md',
      '05-the-hollow-court.md'
    ]);
    expect(TRUST_DOGFOOD_LORE_DOCUMENTS.map((doc) => doc.kind)).toEqual([
      'character_dossier',
      'faction_notes',
      'place_history',
      'general_lore'
    ]);
    expect(TRUST_DOGFOOD_RULESET.id).toBe('ember-ledger-fixture-v1');
    // Escaped, paragraph-wrapped scene HTML with no raw markdown headings.
    for (const chapter of TRUST_DOGFOOD_CHAPTERS) {
      expect(chapter.content.startsWith('<p>')).toBe(true);
      expect(chapter.content).not.toMatch(/^#|<p># /);
    }
  });
});
