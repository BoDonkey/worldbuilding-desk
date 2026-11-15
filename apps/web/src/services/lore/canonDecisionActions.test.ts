import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import type {
  CanonDecisionCluster,
  CanonicalFact,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {
  getAliasesByProject,
  getCanonDecisionClustersByProject,
  getCanonDecisionSuppressionsByProject,
  getCanonicalFactsByProject,
  getEntitiesByProject,
  getLoreEntityProposalsByProject,
  getLoreFactProposalsByProject,
  saveCanonDecisionCluster,
  saveLoreFactProposal
} from '../storage';
import {
  acceptNewEntity,
  aliasEntityToExisting,
  deferCluster,
  findCanonDecisionMembers,
  keepClusterSeparate,
  rejectCluster,
  supersedeFactAsOfScene,
  type CanonDecisionContext,
  type CanonDecisionRecords
} from './canonDecisionActions';
import {acceptCanonicalFact} from './canonicalFactActions';
import {acceptLoreEntityProposal} from './entityProposalActions';

const shodh = vi.hoisted(() => ({
  captureAutoMemory: vi.fn(async () => undefined),
  listMemories: vi.fn(async () => [])
}));
vi.mock('../shodh/getShodhService', () => ({getShodhService: async () => shodh}));

let counter = 0;
const newProjectId = () => `canon-decision-${Date.now()}-${counter++}`;

const entityProposal = (projectId: string, overrides: Partial<LoreEntityProposal> = {}): LoreEntityProposal => ({
  id: `entity-proposal-${projectId}`,
  projectId,
  loreDocumentId: `lore-${projectId}`,
  entityKind: 'character',
  name: 'Mira',
  confidence: 0.9,
  evidence: {text: 'Mira drew the map.', start: 0, end: 4},
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const factProposal = (projectId: string, targetId: string): LoreFactProposal => ({
  id: `fact-proposal-${projectId}`,
  projectId,
  loreDocumentId: `lore-${projectId}`,
  targetType: 'entity',
  targetId,
  targetName: 'Mira',
  factType: 'occupation',
  value: 'captain',
  evidence: {text: 'Captain Mira', start: 0, end: 12},
  confidence: 0.9,
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1
});

const cluster = (
  projectId: string,
  kind: CanonDecisionCluster['kind'],
  memberRefs: CanonDecisionCluster['memberRefs']
): CanonDecisionCluster => ({
  id: `cluster-${projectId}`,
  projectId,
  kind,
  title: 'Decision',
  summary: '',
  memberRefs,
  status: 'open',
  reasonCodes: [],
  createdAt: 1,
  updatedAt: 1
});

const records = (overrides: Partial<CanonDecisionRecords> = {}): CanonDecisionRecords => ({
  documentsById: new Map(),
  entityProposalsById: new Map(),
  factProposalsById: new Map(),
  canonicalFactsById: new Map(),
  charactersById: new Map(),
  entitiesById: new Map(),
  documentLinksById: new Map(),
  canonicalFacts: [],
  scenes: [],
  ...overrides
});

const contextFor = (projectId: string, decisionRecords: CanonDecisionRecords): CanonDecisionContext => ({
  project: {id: projectId},
  records: decisionRecords,
  ragService: null
});

async function storedCluster(projectId: string) {
  return (await getCanonDecisionClustersByProject(projectId))[0];
}

/** A world entity named Mira, created through the real accept path. */
async function seedMira(projectId: string): Promise<WorldEntity> {
  const target = await acceptLoreEntityProposal({
    proposal: entityProposal(projectId, {id: `seed-${projectId}`}),
    existingLinks: []
  });
  return (await getEntitiesByProject(projectId)).find((entity) => entity.id === target.targetId)!;
}

describe('findCanonDecisionMembers', () => {
  it('resolves each member ref to its record and names the target', () => {
    const projectId = 'p';
    const proposal = entityProposal(projectId);
    const mira = {id: 'mira', name: 'Mira'} as WorldEntity;
    const members = findCanonDecisionMembers(
      records({entityProposalsById: new Map([[proposal.id, proposal]]), entitiesById: new Map([['mira', mira]])}),
      cluster(projectId, 'entity_identity', [
        {type: 'lore_entity_proposal', id: proposal.id},
        {type: 'world_entity', id: 'mira'}
      ])
    );
    expect(members.entityProposal).toBe(proposal);
    expect(members.targetRef).toEqual({type: 'world_entity', id: 'mira'});
    expect(members.targetName).toBe('Mira');
    expect(members.factProposal).toBeNull();
  });
});

describe('Canon Decisions resolutions', () => {
  it('accept new creates canon and resolves the cluster', async () => {
    const projectId = newProjectId();
    const proposal = entityProposal(projectId);
    const decision = cluster(projectId, 'entity_identity', [{type: 'lore_entity_proposal', id: proposal.id}]);
    await saveCanonDecisionCluster(decision);

    const message = await acceptNewEntity(contextFor(projectId, records()), decision, proposal);

    expect(message).toBe('"Mira" created as new canon.');
    expect(await getEntitiesByProject(projectId)).toEqual([expect.objectContaining({name: 'Mira'})]);
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'accept_new', status: 'resolved'});
  });

  it('alias records the alias, remembers the pair, and resolves the cluster', async () => {
    const projectId = newProjectId();
    const mira = await seedMira(projectId);
    const proposal = entityProposal(projectId, {name: 'Captain Mira'});
    const decision = cluster(projectId, 'entity_identity', [
      {type: 'lore_entity_proposal', id: proposal.id},
      {type: 'world_entity', id: mira.id}
    ]);
    await saveCanonDecisionCluster(decision);
    const decisionRecords = records({
      entityProposalsById: new Map([[proposal.id, proposal]]),
      entitiesById: new Map([[mira.id, mira]])
    });

    const message = await aliasEntityToExisting(contextFor(projectId, decisionRecords), decision, proposal, {
      type: 'world_entity',
      id: mira.id
    });

    expect(message).toBe('"Captain Mira" aliased to existing canon.');
    expect(await getAliasesByProject(projectId)).toEqual([
      expect.objectContaining({alias: 'Captain Mira', targetId: mira.id})
    ]);
    expect(await getCanonDecisionSuppressionsByProject(projectId)).toEqual([
      expect.objectContaining({kind: 'entity_identity', resolution: 'alias'})
    ]);
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'alias', status: 'resolved'});
  });

  it('supersede splits canon at the chosen scene and remembers the conflict', async () => {
    const projectId = newProjectId();
    const mira = await seedMira(projectId);
    const scenes = [
      {id: 'scene-1', projectId, title: 'Harbor', content: '', order: 0},
      {id: 'scene-2', projectId, title: 'Storm', content: '', order: 1}
    ] as unknown as WritingDocument[];
    const previousFact: CanonicalFact = {
      id: `fact-${projectId}`,
      projectId,
      targetType: 'entity',
      targetId: mira.id,
      targetName: 'Mira',
      loreDocumentId: `lore-${projectId}`,
      factType: 'occupation',
      value: 'first mate',
      evidenceText: 'First mate Mira',
      acceptedAt: 1,
      updatedAt: 1
    };
    await acceptCanonicalFact({
      projectId,
      fact: previousFact,
      proposal: {...factProposal(projectId, mira.id), id: `seed-fact-${projectId}`, value: 'first mate', status: 'accepted'}
    });
    const proposal = factProposal(projectId, mira.id);
    await saveLoreFactProposal(proposal);
    const decision = cluster(projectId, 'fact_conflict', [
      {type: 'lore_fact_proposal', id: proposal.id},
      {type: 'canonical_fact', id: previousFact.id}
    ]);
    await saveCanonDecisionCluster(decision);
    const decisionRecords = records({
      factProposalsById: new Map([[proposal.id, proposal]]),
      canonicalFactsById: new Map([[previousFact.id, previousFact]]),
      canonicalFacts: [previousFact],
      scenes
    });

    const message = await supersedeFactAsOfScene(contextFor(projectId, decisionRecords), decision, {
      proposal,
      previousFact,
      asOfSceneId: 'scene-2'
    });

    expect(message).toBe('Canon superseded as of Storm.');
    const facts = await getCanonicalFactsByProject(projectId);
    expect(facts).toHaveLength(2);
    expect(facts.find((fact) => fact.value === 'captain')).toMatchObject({
      sourceProposalId: proposal.id,
      validFromSceneId: 'scene-2'
    });
    expect(shodh.captureAutoMemory).toHaveBeenCalledTimes(2);
    expect((await getLoreFactProposalsByProject(projectId)).find((entry) => entry.id === proposal.id)).toMatchObject({
      status: 'accepted'
    });
    expect(await getCanonDecisionSuppressionsByProject(projectId)).toEqual([
      expect.objectContaining({kind: 'fact_conflict', resolution: 'accept_update'})
    ]);
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'accept_update', status: 'resolved'});
  });

  it('keep separate on a fact conflict remembers the pair and leaves canon alone', async () => {
    const projectId = newProjectId();
    const proposal = factProposal(projectId, 'mira');
    const fact = {id: 'fact', value: 'first mate'} as CanonicalFact;
    const decision = cluster(projectId, 'fact_conflict', [
      {type: 'lore_fact_proposal', id: proposal.id},
      {type: 'canonical_fact', id: fact.id}
    ]);
    await saveCanonDecisionCluster(decision);
    const decisionRecords = records({
      factProposalsById: new Map([[proposal.id, proposal]]),
      canonicalFactsById: new Map([[fact.id, fact]])
    });

    expect(await keepClusterSeparate(contextFor(projectId, decisionRecords), decision)).toBe(
      'Cluster marked keep separate.'
    );
    expect(await getCanonDecisionSuppressionsByProject(projectId)).toEqual([
      expect.objectContaining({kind: 'fact_conflict', resolution: 'keep_separate'})
    ]);
    expect(await getCanonicalFactsByProject(projectId)).toEqual([]);
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'keep_separate', status: 'resolved'});
  });

  it('reject marks the proposals rejected; defer only sets the cluster aside', async () => {
    const projectId = newProjectId();
    const proposal = entityProposal(projectId);
    const decision = cluster(projectId, 'entity_identity', [{type: 'lore_entity_proposal', id: proposal.id}]);
    await saveCanonDecisionCluster(decision);
    const decisionRecords = records({entityProposalsById: new Map([[proposal.id, proposal]])});

    expect(await deferCluster(decision)).toBe('Cluster deferred.');
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'defer', status: 'deferred'});

    expect(await rejectCluster(contextFor(projectId, decisionRecords), decision)).toBe('Cluster rejected.');
    expect(await getLoreEntityProposalsByProject(projectId)).toEqual([
      expect.objectContaining({id: proposal.id, status: 'rejected'})
    ]);
    expect(await getCanonDecisionSuppressionsByProject(projectId)).toEqual([]);
    expect(await storedCluster(projectId)).toMatchObject({resolution: 'reject', status: 'resolved'});
  });
});
