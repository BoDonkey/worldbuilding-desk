import {describe, expect, it, vi} from 'vitest';
import type {CanonicalFact} from '../../entityTypes';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {
  buildCanonicalFactMemoryContent,
  captureCanonicalFactMemory,
  deleteCanonicalFactMemory,
  getCanonicalFactMemoryDocumentId,
  planCanonicalFactSideEffects,
  planRevertCanonicalFactSideEffects,
  prependUniqueCanonicalFact
} from './canonicalFactActions';

const emptySnapshot = () => ({aliases: [], characters: [], entities: []});

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
  it('keeps new entity facts out of untracked free-form notes', () => {
    const plan = planCanonicalFactSideEffects('project-1', buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'background',
      value: 'Compact service: twenty years'
    }), emptySnapshot());

    expect(plan).toEqual({});
  });

  it('removes one exact legacy materialized note while preserving author prose', () => {
    const fact = buildFact({
      targetType: 'entity',
      targetId: 'sera',
      factType: 'background',
      value: 'Compact service: twenty years'
    });

    const plan = planRevertCanonicalFactSideEffects(fact, [], {
      ...emptySnapshot(),
      entities: [{
        id: 'sera',
        projectId: 'project-1',
        categoryId: 'characters',
        name: 'Sera Kestrel',
        fields: {notes: 'Author note.\nbackground: Compact service: twenty years'},
        links: [],
        createdAt: 1,
        updatedAt: 1
      }]
    });

    expect(plan.entityToPut).toEqual(expect.objectContaining({id: 'sera', fields: {notes: 'Author note.'}}));
  });

  it('does not remove a pre-existing manual alias when its fact is removed', () => {
    const fact = buildFact({targetType: 'entity', targetId: 'sera', factType: 'alias', value: 'Ash', acceptedAt: 10});

    const plan = planRevertCanonicalFactSideEffects(fact, [], {
      ...emptySnapshot(),
      aliases: [{
        id: 'alias-1', projectId: 'project-1', targetType: 'entity', targetId: 'sera', entityId: 'sera',
        alias: 'Ash', createdAt: 1, updatedAt: 20
      }]
    });

    expect(plan).toEqual({});
  });

  it('removes an alias created by the accepted fact when no equivalent fact remains', () => {
    const fact = buildFact({targetType: 'entity', targetId: 'sera', factType: 'alias', value: 'Ash', acceptedAt: 10});
    const snapshot = {
      ...emptySnapshot(),
      aliases: [{
        id: 'alias-2', projectId: 'project-1', targetType: 'entity' as const, targetId: 'sera', entityId: 'sera',
        alias: 'Ash', createdAt: 10, updatedAt: 10
      }]
    };

    expect(planRevertCanonicalFactSideEffects(fact, [], snapshot)).toEqual({aliasIdToDelete: 'alias-2'});
    expect(planRevertCanonicalFactSideEffects(fact, [{...fact, id: 'fact-2'}], snapshot)).toEqual({});
  });

  it('fills an empty character field from an occupation fact without overwriting author text', () => {
    const character = {
      id: 'character-1', projectId: 'project-1', name: 'Moreland', fields: {}, createdAt: 1, updatedAt: 1
    };
    const plan = planCanonicalFactSideEffects('project-1', buildFact(), {...emptySnapshot(), characters: [character]} as never, 5);
    expect(plan.characterToPut?.fields).toEqual({role: 'Detective'});

    const kept = planCanonicalFactSideEffects(
      'project-1',
      buildFact(),
      {...emptySnapshot(), characters: [{...character, fields: {role: 'Inspector'}}]} as never,
      5
    );
    expect(kept.characterToPut?.fields).toEqual({role: 'Inspector'});
  });
});
