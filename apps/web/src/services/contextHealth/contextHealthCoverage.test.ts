import {describe, expect, it} from 'vitest';
import type {RAGDiagnostics} from '../rag/types';
import {
  hasIndexableContextContent,
  summarizeMissingContextDocuments
} from './contextHealthCoverage';

const diagnostics: RAGDiagnostics = {
  chunkCount: 1,
  documentCount: 1,
  countsByType: {
    scene: 1,
    worldbible: 0,
    lore: 0,
    rule: 0,
    canon_fact: 0
  },
  documents: [
    {
      documentId: 'scene-1',
      documentTitle: 'Opening',
      type: 'scene',
      chunkCount: 1,
      tags: [],
      entityIds: []
    }
  ]
};

describe('contextHealthCoverage', () => {
  it('matches expected source ids instead of raw type counts', () => {
    expect(
      summarizeMissingContextDocuments({
        diagnostics,
        expectedDocuments: [
          {documentId: 'scene-1', type: 'scene'},
          {documentId: 'scene-2', type: 'scene'}
        ]
      })
    ).toMatchObject({scene: 1});
  });

  it('treats empty rendered content as not indexable', () => {
    expect(hasIndexableContextContent('<p><br></p>')).toBe(false);
    expect(hasIndexableContextContent('<p>Glass Harbor</p>')).toBe(true);
  });
});
