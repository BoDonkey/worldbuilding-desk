import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {CanonicalFact, LoreDocument, LoreDocumentLink} from '../../entityTypes';
import {extractLoreFactProposals} from './loreFactExtraction';

function makeDocument(content: string): LoreDocument {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Mira Voss',
    kind: 'character_dossier',
    format: 'plain_text',
    content,
    source: {type: 'manual'},
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  };
}

const links: LoreDocumentLink[] = [
  {
    id: 'link-1',
    projectId: 'project-1',
    loreDocumentId: 'doc-1',
    targetType: 'character',
    targetId: 'character-1',
    relationship: 'primary_subject',
    createdAt: 1
  }
];

describe('extractLoreFactProposals', () => {
  it('keeps education age ranges out of character age facts', () => {
    const proposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: makeDocument(['Education:', '- Age: 6-10: Glass Harbor Primary'].join('\n')),
      links,
      knownTargets: [{type: 'character', id: 'character-1', name: 'Mira Voss'}],
      existingFacts: [] as CanonicalFact[]
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      factType: 'background',
      value: 'Age: 6-10: Glass Harbor Primary'
    });
  });

  it('extracts reviewable natural-prose facts from the trust dogfood dossier', () => {
    const content = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/dossier-sera-kestrel.md', import.meta.url),
      'utf8'
    );
    const proposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: {...makeDocument(content), title: 'Character Dossier — Sera Kestrel'},
      links,
      knownTargets: [
        {type: 'character', id: 'character-1', name: 'Sera Kestrel'},
        {type: 'character', id: 'character-tam', name: 'Tam'}
      ],
      existingFacts: []
    });

    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({factType: 'occupation', value: 'cartographer'}),
        expect.objectContaining({factType: 'alias', value: 'Ash'}),
        expect.objectContaining({factType: 'alias', value: 'the Ledgerbound'}),
        expect.objectContaining({factType: 'appearance', value: 'gray eyes'}),
        expect.objectContaining({
          factType: 'relationship',
          value: {label: 'brother', value: 'Tam'}
        })
      ])
    );
  });

  it('keeps contradictory and speculative dogfood claims as proposals for author review', () => {
    const factionContent = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/faction-cinder-compact.md', import.meta.url),
      'utf8'
    );
    const workingContent = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/working-notes-book2.md', import.meta.url),
      'utf8'
    );
    const knownTargets = [
      {type: 'character' as const, id: 'sera', name: 'Sera Kestrel'},
      {type: 'character' as const, id: 'brannic', name: 'Brannic Halloway'},
      {type: 'character' as const, id: 'tam', name: 'Tam'},
      {type: 'entity' as const, id: 'compact', name: 'Cinder Compact'}
    ];
    const factionProposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: {...makeDocument(factionContent), title: 'Faction Notes — The Cinder Compact', kind: 'faction_notes'},
      links: [{...links[0]!, targetType: 'entity', targetId: 'compact'}],
      knownTargets,
      existingFacts: []
    });
    const workingProposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: {...makeDocument(workingContent), title: 'Working Notes — Book Two Brainstorm'},
      links: [],
      knownTargets,
      existingFacts: []
    });

    expect(factionProposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: 'brannic',
          factType: 'background',
          value: 'Compact service: twenty years'
        })
      ])
    );
    expect(workingProposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({targetId: 'sera', factType: 'occupation', value: 'smuggler'}),
        expect.objectContaining({
          targetId: 'brannic',
          factType: 'background',
          value: 'Compact service: a decade'
        }),
        expect.objectContaining({
          targetId: 'tam',
          factType: 'membership',
          value: 'Hollow Court',
          confidence: 0.51
        })
      ])
    );
  });
});
