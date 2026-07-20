import {describe, expect, it} from 'vitest';
import type {LoreDocument} from '../../entityTypes';
import {extractLoreEntityProposals} from './loreEntityExtraction';

function makeDocument(content: string): LoreDocument {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Faction notes',
    kind: 'faction_notes',
    format: 'plain_text',
    content,
    source: {type: 'manual'},
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  };
}

describe('extractLoreEntityProposals', () => {
  it('keeps named clan factions without promoting sentence fragments', () => {
    const proposals = extractLoreEntityProposals({
      projectId: 'project-1',
      document: makeDocument(
        [
          'Ensure that the clan histories remain unresolved.',
          'Mira is a member of the Lantern Guild clan.'
        ].join('\n')
      ),
      links: [],
      characters: [],
      entities: []
    });

    expect(proposals.map((proposal) => proposal.name)).toEqual(['Lantern Guild Clan']);
  });
});
