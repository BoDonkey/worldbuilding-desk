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
    targetType: 'entity',
    targetId: 'character-entity-1',
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
      knownTargets: [{type: 'entity', id: 'character-entity-1', name: 'Mira Voss'}],
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
        {type: 'entity', id: 'sera', name: 'Sera Kestrel'},
        {type: 'entity', id: 'tam', name: 'Tam'},
        {type: 'entity', id: 'grayharbor', name: 'Grayharbor'},
        {type: 'entity', id: 'compact', name: 'Cinder Compact'},
        {type: 'entity', id: 'brannic', name: 'Brannic Halloway'}
      ],
      existingFacts: []
    });

    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({targetId: 'sera', factType: 'occupation', value: 'cartographer'}),
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

  it('extracts section-scoped aliases and treatment from the dogfood place notes', () => {
    const content = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/places-grayharbor-undervault.md', import.meta.url),
      'utf8'
    );
    const knownTargets = [
      {type: 'entity' as const, id: 'grayharbor', name: 'Grayharbor'},
      {type: 'entity' as const, id: 'undervault', name: 'Undervault'},
      {type: 'character' as const, id: 'odessa', name: 'Odessa Vane-Kir'}
    ];
    const proposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: {
        ...makeDocument(content),
        title: 'Place Notes — Grayharbor and the Undervault',
        kind: 'place_history'
      },
      links: [
        {...links[0]!, targetType: 'entity', targetId: 'grayharbor'},
        {...links[0]!, id: 'link-2', targetType: 'entity', targetId: 'undervault', relationship: 'secondary_subject'}
      ],
      knownTargets,
      existingFacts: []
    });

    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({targetId: 'odessa', factType: 'alias', value: 'Dess'}),
        expect.objectContaining({targetId: 'undervault', factType: 'alias', value: 'the Vault'}),
        expect.objectContaining({
          targetId: 'undervault',
          factType: 'background',
          value: expect.stringContaining('Vaultburn treatment: salt, cedar oil, and whitethorn ash')
        })
      ])
    );
  });

  it('leaves an explicit sibling subject unresolved until its entity exists', () => {
    const content = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/places-grayharbor-undervault.md', import.meta.url),
      'utf8'
    );
    const proposals = extractLoreFactProposals({
      projectId: 'project-1',
      document: {
        ...makeDocument(content),
        title: 'Place Notes — Grayharbor and the Undervault',
        kind: 'place_history'
      },
      links: [
        {...links[0]!, targetId: 'grayharbor'},
        {...links[0]!, id: 'link-2', targetId: 'undervault', relationship: 'secondary_subject'}
      ],
      knownTargets: [
        {type: 'entity', id: 'grayharbor', name: 'Grayharbor'},
        {type: 'entity', id: 'undervault', name: 'Undervault'}
      ],
      existingFacts: []
    });

    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: undefined,
          targetName: undefined,
          factType: 'alias',
          value: 'Dess'
        })
      ])
    );
  });
});
