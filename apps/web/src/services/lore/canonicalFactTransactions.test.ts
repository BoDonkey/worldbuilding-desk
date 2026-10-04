import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {CanonicalFact, Character, LoreFactProposal} from '../../entityTypes';
import {getCharactersByProject, saveCharacter} from '../../characterStorage';
import {getAliasesByProject} from '../consistency/aliasStorage';
import {acceptCanonicalFact, removeCanonicalFact, supersedeCanonicalFact} from './canonicalFactActions';
import {getCanonicalFactsByProject, getLoreFactProposalsByProject} from './loreFactStorage';

let counter = 0;
const newProjectId = () => `fact-tx-${Date.now()}-${counter++}`;

const fact = (projectId: string, overrides: Partial<CanonicalFact> = {}): CanonicalFact => ({
  id: `fact-${projectId}`,
  projectId,
  targetType: 'entity',
  targetId: 'sera',
  targetName: 'Sera',
  loreDocumentId: 'lore-1',
  factType: 'alias',
  value: 'Ash',
  evidenceText: 'They called her Ash.',
  acceptedAt: 1,
  updatedAt: 1,
  ...overrides
});

const factProposal = (projectId: string, overrides: Partial<LoreFactProposal> = {}): LoreFactProposal => ({
  id: `fact-proposal-${projectId}`,
  projectId,
  loreDocumentId: 'lore-1',
  factType: 'alias',
  value: 'Ash',
  evidence: {text: 'They called her Ash.', start: 0, end: 5},
  confidence: 0.9,
  status: 'accepted',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
} as LoreFactProposal);

const brokenProposal = (projectId: string) =>
  ({...factProposal(projectId), id: undefined}) as unknown as LoreFactProposal;

async function snapshot(projectId: string) {
  const [facts, proposals, aliases, characters] = await Promise.all([
    getCanonicalFactsByProject(projectId),
    getLoreFactProposalsByProject(projectId),
    getAliasesByProject(projectId),
    getCharactersByProject(projectId)
  ]);
  return {facts, proposals, aliases, characters};
}

describe('canonical fact transactions', () => {
  it('accepts a fact with its proposal and alias together', async () => {
    const projectId = newProjectId();
    await acceptCanonicalFact({projectId, fact: fact(projectId), proposal: factProposal(projectId)});
    const after = await snapshot(projectId);

    expect(after.facts.map((entry) => entry.id)).toEqual([`fact-${projectId}`]);
    expect(after.proposals).toEqual([expect.objectContaining({status: 'accepted'})]);
    expect(after.aliases).toEqual([expect.objectContaining({alias: 'Ash', targetId: 'sera'})]);
  });

  it('keeps nothing when acceptance fails part-way', async () => {
    const projectId = newProjectId();
    await expect(
      acceptCanonicalFact({projectId, fact: fact(projectId), proposal: brokenProposal(projectId)})
    ).rejects.toThrow();

    expect(await snapshot(projectId)).toEqual({facts: [], proposals: [], aliases: [], characters: []});
  });

  it('removes a fact, its own alias, and reopens the proposal together — or not at all', async () => {
    const projectId = newProjectId();
    const accepted = fact(projectId, {acceptedAt: 0});
    await acceptCanonicalFact({projectId, fact: accepted, proposal: factProposal(projectId)});
    const before = await snapshot(projectId);

    await expect(
      removeCanonicalFact({projectId, fact: accepted, remainingFacts: [], reopenedProposal: brokenProposal(projectId)})
    ).rejects.toThrow();
    expect(await snapshot(projectId)).toEqual(before);

    await removeCanonicalFact({
      projectId,
      fact: accepted,
      remainingFacts: [],
      reopenedProposal: {...factProposal(projectId), status: 'proposed'}
    });
    const after = await snapshot(projectId);
    expect(after.facts).toEqual([]);
    expect(after.aliases).toEqual([]);
    expect(after.proposals).toEqual([expect.objectContaining({status: 'proposed'})]);
  });

  it('hands a character field over from the superseded fact to the new one atomically', async () => {
    const projectId = newProjectId();
    const character: Character = {
      id: `char-${projectId}`, projectId, name: 'Moreland', entityId: `entity-${projectId}`,
      fields: {}, createdAt: 1, updatedAt: 1
    };
    await saveCharacter(character);
    const previous = fact(projectId, {
      id: `old-${projectId}`, targetType: 'character', targetId: character.id, factType: 'occupation', value: 'Detective'
    });
    await acceptCanonicalFact({projectId, fact: previous, proposal: factProposal(projectId, {factType: 'occupation'})});
    expect((await getCharactersByProject(projectId))[0]?.fields).toEqual({role: 'Detective'});
    const before = await snapshot(projectId);

    const next = {...previous, id: `new-${projectId}`, value: 'Inspector'};
    const bounded = {...previous, validUntilSceneId: 'scene-3'};
    await expect(
      supersedeCanonicalFact({projectId, previousFact: bounded, nextFact: next, proposal: brokenProposal(projectId), remainingFacts: [next]})
    ).rejects.toThrow();
    expect(await snapshot(projectId)).toEqual(before);

    await supersedeCanonicalFact({
      projectId, previousFact: bounded, nextFact: next, proposal: factProposal(projectId), remainingFacts: [next]
    });
    const after = await snapshot(projectId);
    expect(after.facts.map((entry) => entry.id).sort()).toEqual([`new-${projectId}`, `old-${projectId}`].sort());
    expect(after.facts.find((entry) => entry.id === `old-${projectId}`)?.validUntilSceneId).toBe('scene-3');
    expect(after.characters[0]?.fields).toEqual({role: 'Inspector'});
  });
});
