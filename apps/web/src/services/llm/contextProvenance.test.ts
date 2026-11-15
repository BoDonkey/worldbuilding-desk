import {describe, expect, it} from 'vitest';
import type {LoreDocumentLink} from '../../entityTypes';
import type {RAGSearchResult} from '../rag/types';
import {
  appendContextTrustInstructions,
  buildRagContextChunk,
  getLoreDocumentIdFromRagDocumentId,
  getRagContextSource
} from './contextProvenance';
import {sectionForContextSource} from './contextBudget';

function makeResult(
  type: RAGSearchResult['chunk']['metadata']['type'],
  documentId: string,
  documentTitle: string
): RAGSearchResult {
  return {
    score: 0.75,
    chunk: {
      id: `${documentId}-0`,
      documentId,
      documentTitle,
      content: 'Context excerpt.',
      metadata: {type}
    }
  };
}

const linkedSourceNote: LoreDocumentLink = {
  id: 'link-1',
  projectId: 'project-1',
  loreDocumentId: 'lore-1',
  targetType: 'entity',
  targetId: 'entity-1',
  relationship: 'primary_subject',
  createdAt: 1
};

describe('context provenance labels', () => {
  it('labels accepted canon and canon facts as trusted canon context', () => {
    expect(
      getRagContextSource(makeResult('worldbible', 'entity-1', 'Camila Garcia deTerra'))
    ).toBe('Accepted canon: World Bible record - Camila Garcia deTerra');

    expect(
      getRagContextSource(makeResult('canon_fact', 'canon-fact:fact-1', 'Camila Garcia deTerra'))
    ).toBe('Accepted canon fact - Camila Garcia deTerra');
  });

  it('uses Source Note links to distinguish linked notes from general project notes', () => {
    expect(getLoreDocumentIdFromRagDocumentId('lore:lore-1')).toBe('lore-1');

    expect(
      getRagContextSource(
        makeResult('lore', 'lore:lore-1', 'Camila Dossier'),
        [linkedSourceNote]
      )
    ).toBe(
      'Linked Source Note: source material, not automatically canon - Camila Dossier'
    );

    expect(
      getRagContextSource(
        makeResult('lore', 'lore:lore-2', 'Founding Myths'),
        [linkedSourceNote]
      )
    ).toBe(
      'General Source Note: project reference, not automatically canon - Founding Myths'
    );
  });

  it('says when a Source Note was saved from an AI session, keeping the words the budget sorts by', () => {
    const aiSessionNoteIds = new Set(['lore-1', 'lore-2']);
    expect(
      getRagContextSource(makeResult('lore', 'lore:lore-1', 'Character lab: Mara'), [linkedSourceNote], aiSessionNoteIds)
    ).toBe(
      'Linked Source Note (saved from an AI session, may be model-written): source material, not automatically canon - Character lab: Mara'
    );
    const general = buildRagContextChunk(makeResult('lore', 'lore:lore-2', 'Assistant note'), [], aiSessionNoteIds);
    expect(general.source).toBe(
      'General Source Note (saved from an AI session, may be model-written): project reference, not automatically canon - Assistant note'
    );
    expect(sectionForContextSource(general.source)).toBe('source-note');
    expect(
      sectionForContextSource(
        getRagContextSource(makeResult('lore', 'lore:lore-1', 'X'), [linkedSourceNote], aiSessionNoteIds)
      )
    ).toBe('linked-source-note');
    // A note the author typed is unchanged, and other record types never take the wording.
    expect(getRagContextSource(makeResult('lore', 'lore:lore-3', 'Myths'), [], aiSessionNoteIds)).toBe(
      'General Source Note: project reference, not automatically canon - Myths'
    );
    expect(getRagContextSource(makeResult('worldbible', 'lore-1', 'Mara'), [], aiSessionNoteIds)).toBe(
      'Accepted canon: World Bible record - Mara'
    );
  });

  it('preserves provider context shape while replacing generic titles with trust labels', () => {
    expect(
      buildRagContextChunk(makeResult('scene', 'scene-1', 'Chapter One'))
    ).toEqual({
      content: 'Context excerpt.',
      source: 'Scene draft - Chapter One',
      relevance: 0.75
    });
  });

  it('appends context trust rules to existing prompts without replacing user text', () => {
    const prompt = appendContextTrustInstructions('Custom author prompt.');

    expect(prompt).toContain('Custom author prompt.');
    expect(prompt).toContain('Treat accepted canon and accepted canon facts');
    expect(prompt).toContain('Treat Source Notes as evidence and background material');
    expect(prompt).toContain('"saved from an AI session" may hold text a model wrote');
  });

  it('names the record a Source Note or World Bible chunk came from, and no record for others', () => {
    expect(buildRagContextChunk(makeResult('lore', 'lore:note-7', 'Salt Roads')).sourceRef).toEqual({
      kind: 'source-note',
      id: 'note-7'
    });
    expect(buildRagContextChunk(makeResult('worldbible', 'entity-3', 'Mira')).sourceRef).toEqual({
      kind: 'world-bible',
      id: 'entity-3'
    });
    expect(buildRagContextChunk(makeResult('canon_fact', 'fact-1', 'Mira')).sourceRef).toBeUndefined();
  });
});
