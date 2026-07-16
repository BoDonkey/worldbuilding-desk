import {describe, expect, it} from 'vitest';
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
});
