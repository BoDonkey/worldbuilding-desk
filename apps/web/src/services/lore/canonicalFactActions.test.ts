import {describe, expect, it, vi} from 'vitest';
import type {CanonicalFact} from '../../entityTypes';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {
  buildCanonicalFactMemoryContent,
  captureCanonicalFactMemory,
  deleteCanonicalFactMemory,
  getCanonicalFactMemoryDocumentId,
  prependUniqueCanonicalFact
} from './canonicalFactActions';

function buildFact(overrides: Partial<CanonicalFact> = {}): CanonicalFact {
  return {
    id: 'fact-1',
    projectId: 'project-1',
    targetType: 'character',
    targetId: 'character-1',
    targetName: 'Detective Moreland',
    loreDocumentId: 'lore-1',
    sourceLoreDocumentTitle: 'Case Notes',
    factType: 'occupation',
    value: 'Detective',
    evidenceText: 'Moreland introduced herself as a detective.',
    acceptedAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function buildShodhProvider(): ShodhMemoryProvider {
  return {
    init: vi.fn(),
    addMemory: vi.fn(),
    listMemories: vi.fn().mockResolvedValue([]),
    deleteMemory: vi.fn(),
    deleteMemoriesForDocument: vi.fn(),
    captureAutoMemory: vi.fn()
  };
}

describe('canonical fact Shodh memory helpers', () => {
  it('uses a stable canonical fact memory document id', () => {
    expect(getCanonicalFactMemoryDocumentId('fact-1')).toBe('canon-fact:fact-1');
  });

  it('builds memory content from the accepted fact and its evidence', () => {
    expect(buildCanonicalFactMemoryContent(buildFact())).toBe(
      [
        'Detective Moreland occupation: Detective',
        'Accepted from Source Note: Case Notes',
        'Evidence: Moreland introduced herself as a detective.'
      ].join('\n')
    );
  });

  it('captures accepted facts as tagged Shodh memory', async () => {
    const provider = buildShodhProvider();

    await captureCanonicalFactMemory(provider, buildFact());

    expect(provider.captureAutoMemory).toHaveBeenCalledWith({
      projectId: 'project-1',
      documentId: 'canon-fact:fact-1',
      title: 'Canon fact: Detective Moreland',
      content: [
        'Detective Moreland occupation: Detective',
        'Accepted from Source Note: Case Notes',
        'Evidence: Moreland introduced herself as a detective.'
      ].join('\n'),
      tags: ['canon_fact', 'occupation']
    });
  });

  it('deletes the Shodh memory for a canonical fact document id', async () => {
    const provider = buildShodhProvider();

    await deleteCanonicalFactMemory(provider, 'fact-1');

    expect(provider.deleteMemoriesForDocument).toHaveBeenCalledWith('canon-fact:fact-1');
  });

  it('reconciles an accepted fact without duplicating an event-loaded record', () => {
    const existing = buildFact();
    const updated = buildFact({updatedAt: 2});

    expect(prependUniqueCanonicalFact([existing], updated)).toEqual([updated]);
  });
});
