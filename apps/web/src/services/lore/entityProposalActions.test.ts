import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {Character, LoreDocumentLink, LoreEntityProposal} from '../../entityTypes';
import {CHARACTER_STORE_NAME} from '../../db';
import {getCategoriesByProject} from '../../categoryStorage';
import {getCharactersByProject} from '../../characterStorage';
import {getEntitiesByProject} from '../../entityStorage';
import {getLoreDocumentLinksByProject} from '../../loreStorage';
import {getAliasesByProject} from '../consistency/aliasStorage';
import {runProjectWriteTransaction} from '../storage/projectWriteTransaction';
import {acceptLoreEntityProposal} from './entityProposalActions';
import {getLoreEntityProposalsByProject} from './loreEntityProposalStorage';

let projectCounter = 0;
const newProjectId = () => `entity-accept-${Date.now()}-${projectCounter++}`;

const proposal = (projectId: string, overrides: Partial<LoreEntityProposal> = {}): LoreEntityProposal => ({
  id: `proposal-${projectId}`,
  projectId,
  loreDocumentId: `lore-${projectId}`,
  entityKind: 'character',
  name: 'Mira Voss',
  confidence: 0.9,
  evidence: {text: 'Mira Voss drew the map.', start: 0, end: 9},
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

async function snapshot(projectId: string) {
  const [categories, entities, characters, links, aliases, proposals] = await Promise.all([
    getCategoriesByProject(projectId),
    getEntitiesByProject(projectId),
    getCharactersByProject(projectId),
    getLoreDocumentLinksByProject(projectId),
    getAliasesByProject(projectId),
    getLoreEntityProposalsByProject(projectId)
  ]);
  return {categories, entities, characters, links, aliases, proposals};
}

describe('acceptLoreEntityProposal', () => {
  it('accepts a new character as World Bible canon, links the Source Note, and marks the proposal accepted', async () => {
    const projectId = newProjectId();
    const result = await acceptLoreEntityProposal({proposal: proposal(projectId), existingLinks: []});
    const after = await snapshot(projectId);

    expect(result.targetType).toBe('entity');
    expect(after.entities).toEqual([expect.objectContaining({id: result.targetId, name: 'Mira Voss'})]);
    expect(after.characters).toEqual([]);
    expect(after.links).toEqual([
      expect.objectContaining({targetType: 'entity', targetId: result.targetId, relationship: 'primary_subject'})
    ]);
    expect(after.proposals).toEqual([
      expect.objectContaining({status: 'accepted', targetType: 'entity', targetId: result.targetId})
    ]);
  });

  it('canonicalizes an explicitly selected legacy tool record before linking lore', async () => {
    const projectId = newProjectId();
    const legacy: Character = {
      id: `character-${projectId}`,
      projectId,
      name: 'Mira Voss',
      description: 'A cartographer.',
      fields: {role: 'Cartographer'},
      createdAt: 1,
      updatedAt: 1
    };
    // Legacy records predate the canonical link, so seed it below the write validation.
    await runProjectWriteTransaction([CHARACTER_STORE_NAME], (tx) => tx.put(CHARACTER_STORE_NAME, legacy));

    const result = await acceptLoreEntityProposal({
      proposal: proposal(projectId, {targetType: 'character', targetId: legacy.id}),
      existingLinks: []
    });
    const after = await snapshot(projectId);

    expect(result.targetType).toBe('entity');
    expect(after.characters).toEqual([expect.objectContaining({id: legacy.id, entityId: result.targetId})]);
    expect(after.entities).toEqual([
      expect.objectContaining({id: result.targetId, fields: expect.objectContaining({role: 'Cartographer'})})
    ]);
    expect(after.links).toEqual([expect.objectContaining({targetType: 'entity', targetId: result.targetId})]);
  });

  it('creates the kind category once and keeps other links when accepting a location', async () => {
    const projectId = newProjectId();
    const existing: LoreDocumentLink = {
      id: `link-${projectId}`, projectId, loreDocumentId: `lore-${projectId}`,
      targetType: 'entity', targetId: 'other', relationship: 'mentions', createdAt: 1
    };
    const result = await acceptLoreEntityProposal({
      proposal: proposal(projectId, {entityKind: 'location', name: 'Salt Door'}),
      existingLinks: [existing]
    });
    const after = await snapshot(projectId);

    expect(after.categories.map((category) => category.slug)).toContain('locations');
    expect(after.links).toHaveLength(2);
    expect(after.links).toEqual(expect.arrayContaining([
      expect.objectContaining({targetId: 'other'}),
      expect.objectContaining({targetId: result.targetId, relationship: 'primary_subject'})
    ]));
  });

  it('records an alias in the same commit', async () => {
    const projectId = newProjectId();
    const result = await acceptLoreEntityProposal({
      proposal: proposal(projectId, {entityKind: 'faction', name: 'The Compact'}),
      existingLinks: []
    });
    const second = proposal(projectId, {id: `p2-${projectId}`, targetType: 'entity', targetId: result.targetId, name: 'Compact'});
    await acceptLoreEntityProposal({
      proposal: second,
      existingLinks: [],
      alias: {targetType: 'entity', targetId: result.targetId, alias: 'Compact'}
    });

    expect((await snapshot(projectId)).aliases).toEqual([
      expect.objectContaining({alias: 'Compact', targetId: result.targetId})
    ]);
  });

  it('leaves no partial canon behind when a write fails part-way', async () => {
    const projectId = newProjectId();
    const before = await snapshot(projectId);

    await expect(
      acceptLoreEntityProposal({
        proposal: proposal(projectId, {entityKind: 'item', name: 'Echo Blade'}),
        existingLinks: [],
        alias: {targetType: 'entity', targetId: 'whatever', alias: 'Blade'},
        // The last write of the unit has no key, so IndexedDB rejects it after the
        // category, entity, links, and alias were already written in the transaction.
        acceptedProposal: () => ({...proposal(projectId), id: undefined}) as unknown as LoreEntityProposal
      })
    ).rejects.toThrow();

    expect(await snapshot(projectId)).toEqual(before);
  });
});
