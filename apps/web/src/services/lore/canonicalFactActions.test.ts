import {describe, expect, it, vi} from 'vitest';
import type {CanonicalFact} from '../../entityTypes';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {getCharactersByProject, saveCharacter} from '../../characterStorage';
import {getEntitiesByProject, saveEntity} from '../../entityStorage';
import {deleteAliasById, getAliasesByProject, saveAlias} from '../consistency';
import {
  applyCanonicalFactSideEffects,
  buildCanonicalFactMemoryContent,
  captureCanonicalFactMemory,
  deleteCanonicalFactMemory,
  getCanonicalFactMemoryDocumentId,
  prependUniqueCanonicalFact,
  revertCanonicalFactSideEffects
} from './canonicalFactActions';

vi.mock('../../characterStorage', () => ({
  getCharactersByProject: vi.fn().mockResolvedValue([]),
  saveCharacter: vi.fn()
}));

vi.mock('../../entityStorage', () => ({
  getEntitiesByProject: vi.fn().mockResolvedValue([]),
  saveEntity: vi.fn()
}));

vi.mock('../consistency', () => ({
  deleteAliasById: vi.fn(),
  getAliasesByProject: vi.fn().mockResolvedValue([]),
  saveAlias: vi.fn()
}));

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

describe('canonical fact materialization ownership', () => {
  it('keeps new entity facts out of untracked free-form notes', async () => {
    await applyCanonicalFactSideEffects('project-1', buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'background',
      value: 'Compact service: twenty years'
    }));

    expect(getEntitiesByProject).not.toHaveBeenCalled();
    expect(saveEntity).not.toHaveBeenCalled();
  });

  it('removes one exact legacy materialized note while preserving author prose', async () => {
    vi.mocked(getEntitiesByProject).mockResolvedValueOnce([{
      id: 'sera',
      projectId: 'project-1',
      categoryId: 'characters',
      name: 'Sera Kestrel',
      fields: {notes: 'Author note.\nbackground: Compact service: twenty years'},
      links: [],
      createdAt: 1,
      updatedAt: 1
    }]);
    const fact = buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'background',
      value: 'Compact service: twenty years'
    });

    await revertCanonicalFactSideEffects('project-1', fact, []);

    expect(saveEntity).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sera',
      fields: {notes: 'Author note.'}
    }));
  });

  it('does not remove a pre-existing manual alias when its fact is removed', async () => {
    vi.mocked(getAliasesByProject).mockResolvedValueOnce([{
      id: 'alias-1',
      projectId: 'project-1',
      targetType: 'entity',
      targetId: 'sera',
      entityId: 'sera',
      alias: 'Ash',
      createdAt: 1,
      updatedAt: 20
    }]);
    const fact = buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'alias',
      value: 'Ash',
      acceptedAt: 10
    });

    await revertCanonicalFactSideEffects('project-1', fact, []);

    expect(deleteAliasById).not.toHaveBeenCalled();
  });

  it('removes an alias created by the accepted fact when no equivalent fact remains', async () => {
    vi.mocked(getAliasesByProject).mockResolvedValueOnce([{
      id: 'alias-2',
      projectId: 'project-1',
      targetType: 'entity',
      targetId: 'sera',
      entityId: 'sera',
      alias: 'Ash',
      createdAt: 10,
      updatedAt: 10
    }]);
    const fact = buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'alias',
      value: 'Ash',
      acceptedAt: 10
    });

    await revertCanonicalFactSideEffects('project-1', fact, []);

    expect(deleteAliasById).toHaveBeenCalledWith('alias-2');
    expect(saveAlias).not.toHaveBeenCalled();
    expect(getCharactersByProject).not.toHaveBeenCalled();
    expect(saveCharacter).not.toHaveBeenCalled();
  });
});
