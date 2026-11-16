import type {
  CanonDecisionCluster,
  CanonicalFact,
  Character,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityProposal,
  LoreFactProposal,
  Project,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {
  buildEntityDecisionSuppressionKey,
  buildFactDecisionSuppressionKey,
  saveCanonDecisionCluster,
  saveCanonDecisionSuppression,
  saveLoreEntityProposal,
  saveLoreFactProposal
} from '../storage';
import type {RAGProvider} from '../rag/RAGService';
import {getShodhService} from '../shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../shodh/shodhEvents';
import {
  buildCanonicalFactFromProposal,
  captureCanonicalFactMemory,
  indexCanonicalFact,
  supersedeCanonicalFact
} from './canonicalFactActions';
import {buildCanonicalFactSupersession} from './canonicalFactValidity';
import {acceptLoreEntityProposal} from './entityProposalActions';

/*
 * One function per Canon Decisions resolution (slice 3.43). Each writes canon
 * through the transactional actions, then does the cluster bookkeeping (the
 * suppression record and the resolved cluster), and returns the message the
 * author sees. A failure throws; the caller reports it. Busy and feedback
 * state live in useCanonDecisionActions.
 */

/** The project records a decision reads, keyed the way the route holds them. */
export interface CanonDecisionRecords {
  documentsById: Map<string, LoreDocument>;
  entityProposalsById: Map<string, LoreEntityProposal>;
  factProposalsById: Map<string, LoreFactProposal>;
  canonicalFactsById: Map<string, CanonicalFact>;
  charactersById: Map<string, Character>;
  entitiesById: Map<string, WorldEntity>;
  documentLinksById: Map<string, LoreDocumentLink[]>;
  canonicalFacts: CanonicalFact[];
  scenes: WritingDocument[];
}

export interface CanonDecisionContext {
  project: Pick<Project, 'id' | 'inheritShodh' | 'parentProjectId'>;
  records: CanonDecisionRecords;
  ragService: RAGProvider | null;
}

export type CanonDecisionTargetRef = {type: 'character' | 'world_entity'; id: string};

/** The records a cluster's member refs point at; null where a ref or its record is missing. */
export interface CanonDecisionMembers {
  entityProposal: LoreEntityProposal | null;
  factProposal: LoreFactProposal | null;
  canonicalFact: CanonicalFact | null;
  targetRef: CanonDecisionTargetRef | null;
  targetCharacter: Character | null;
  targetEntity: WorldEntity | null;
  targetName: string | null;
  sourceDocument: LoreDocument | null;
}

export function findCanonDecisionMembers(
  records: CanonDecisionRecords,
  cluster: CanonDecisionCluster
): CanonDecisionMembers {
  const refOf = (type: CanonDecisionCluster['memberRefs'][number]['type']) =>
    cluster.memberRefs.find((ref) => ref.type === type);
  const entityProposalRef = refOf('lore_entity_proposal');
  const factProposalRef = refOf('lore_fact_proposal');
  const canonicalFactRef = refOf('canonical_fact');
  const target = cluster.memberRefs.find(
    (ref) => ref.type === 'character' || ref.type === 'world_entity'
  );
  const targetRef = target ? ({type: target.type, id: target.id} as CanonDecisionTargetRef) : null;
  const entityProposal = entityProposalRef
    ? records.entityProposalsById.get(entityProposalRef.id) ?? null
    : null;
  const factProposal = factProposalRef
    ? records.factProposalsById.get(factProposalRef.id) ?? null
    : null;
  const targetCharacter =
    targetRef?.type === 'character' ? records.charactersById.get(targetRef.id) ?? null : null;
  const targetEntity =
    targetRef?.type === 'world_entity' ? records.entitiesById.get(targetRef.id) ?? null : null;
  const sourceDocumentId = entityProposal?.loreDocumentId ?? factProposal?.loreDocumentId;
  return {
    entityProposal,
    factProposal,
    canonicalFact: canonicalFactRef
      ? records.canonicalFactsById.get(canonicalFactRef.id) ?? null
      : null,
    targetRef,
    targetCharacter,
    targetEntity,
    targetName: targetCharacter?.name ?? targetEntity?.name ?? null,
    sourceDocument: sourceDocumentId ? records.documentsById.get(sourceDocumentId) ?? null : null
  };
}

const factValueText = (fact: CanonicalFact | LoreFactProposal): string =>
  typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`;

const resolveCluster = async (
  cluster: CanonDecisionCluster,
  resolution: CanonDecisionCluster['resolution'],
  status: CanonDecisionCluster['status']
) => {
  await saveCanonDecisionCluster({...cluster, resolution, status, updatedAt: Date.now()});
};

/** Remembers an identity decision so the same pair is not proposed again. */
const persistEntitySuppression = async (
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster,
  resolution: 'alias' | 'keep_separate'
) => {
  const {entityProposal, targetRef, targetName} = findCanonDecisionMembers(context.records, cluster);
  if (!entityProposal || !targetRef || !targetName) return;
  await saveCanonDecisionSuppression({
    id: crypto.randomUUID(),
    projectId: context.project.id,
    kind: 'entity_identity',
    key: buildEntityDecisionSuppressionKey({proposalName: entityProposal.name, targetName}),
    resolution,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
};

/** Remembers a fact-conflict decision so the same pair of values is not proposed again. */
const persistFactSuppression = async (
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster,
  resolution: 'reject' | 'accept_update' | 'keep_separate'
) => {
  const {factProposal, canonicalFact} = findCanonDecisionMembers(context.records, cluster);
  if (!factProposal || !canonicalFact || !factProposal.targetType || !factProposal.targetId) return;
  await saveCanonDecisionSuppression({
    id: crypto.randomUUID(),
    projectId: context.project.id,
    kind: 'fact_conflict',
    key: buildFactDecisionSuppressionKey({
      targetType: factProposal.targetType,
      targetId: factProposal.targetId,
      factType: factProposal.factType,
      canonicalValue: factValueText(canonicalFact),
      proposalValue: factValueText(factProposal)
    }),
    resolution,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
};

/** Alias the candidate to the existing record it matched. */
export async function aliasEntityToExisting(
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster,
  proposal: LoreEntityProposal,
  targetRef: CanonDecisionTargetRef
): Promise<string> {
  const targetType = targetRef.type === 'character' ? 'character' : 'entity';
  const nextProposal: LoreEntityProposal = {
    ...proposal,
    targetType,
    targetId: targetRef.id,
    status: 'accepted',
    updatedAt: Date.now()
  };
  // Canon links, the alias, and the proposal commit together; cluster bookkeeping follows.
  await acceptLoreEntityProposal({
    proposal: nextProposal,
    existingLinks: context.records.documentLinksById.get(proposal.loreDocumentId) ?? [],
    indexing: {ragService: context.ragService, shodhService: null},
    alias: {targetId: targetRef.id, targetType, alias: proposal.name},
    acceptedProposal: () => nextProposal
  });
  await persistEntitySuppression(context, cluster, 'alias');
  await resolveCluster(cluster, 'alias', 'resolved');
  return `"${proposal.name}" aliased to existing canon.`;
}

/** Create the candidate as a new canon record. */
export async function acceptNewEntity(
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster,
  proposal: LoreEntityProposal
): Promise<string> {
  await acceptLoreEntityProposal({
    proposal: {...proposal, targetType: undefined, targetId: undefined},
    existingLinks: context.records.documentLinksById.get(proposal.loreDocumentId) ?? [],
    indexing: {ragService: context.ragService, shodhService: null}
  });
  await resolveCluster(cluster, 'accept_new', 'resolved');
  return `"${proposal.name}" created as new canon.`;
}

/**
 * Supersede the current fact with the proposed one from `asOfSceneId` on.
 * The proposal must name its target. Memory and the retrieval index follow
 * the transaction; a memory failure is logged and does not undo canon.
 */
export async function supersedeFactAsOfScene(
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster,
  params: {proposal: LoreFactProposal; previousFact: CanonicalFact; asOfSceneId: string}
): Promise<string> {
  const {project, records, ragService} = context;
  const {proposal, previousFact, asOfSceneId} = params;
  if (!proposal.targetType || !proposal.targetId) {
    throw new Error('The proposed fact has no target.');
  }
  const supersession = buildCanonicalFactSupersession({
    previousFact,
    nextFact: buildCanonicalFactFromProposal({
      projectId: project.id,
      proposal,
      target: {targetType: proposal.targetType, targetId: proposal.targetId, targetName: proposal.targetName},
      sourceLoreDocumentTitle: records.documentsById.get(proposal.loreDocumentId)?.title
    }),
    asOfSceneId,
    documents: records.scenes
  });
  const nextFact = supersession.nextFact;
  // Both facts, the proposal, and the side-effect hand-over commit together.
  await supersedeCanonicalFact({
    projectId: project.id,
    previousFact: supersession.previousFact,
    nextFact,
    proposal: {...proposal, status: 'accepted', updatedAt: Date.now()},
    remainingFacts: [...records.canonicalFacts.filter((fact) => fact.id !== previousFact.id), nextFact]
  });
  try {
    const shodh = await getShodhService({
      projectId: project.id,
      inheritFromParent: project.inheritShodh,
      parentProjectId: project.parentProjectId
    });
    await captureCanonicalFactMemory(shodh, supersession.previousFact, records.scenes);
    await captureCanonicalFactMemory(shodh, nextFact, records.scenes);
    emitShodhMemoriesUpdated(await shodh.listMemories());
  } catch (error) {
    console.warn('Failed to refresh canonical fact memory', error);
  }
  if (ragService) {
    await indexCanonicalFact(ragService, supersession.previousFact, records.scenes);
    await indexCanonicalFact(ragService, nextFact, records.scenes);
  }
  await resolveCluster(cluster, 'accept_update', 'resolved');
  await persistFactSuppression(context, cluster, 'accept_update');
  const sceneTitle = records.scenes.find((scene) => scene.id === asOfSceneId)?.title ?? 'that scene';
  return `Canon superseded as of ${sceneTitle}.`;
}

/** Both stay as they are, and the pair is not proposed again. */
export async function keepClusterSeparate(
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster
): Promise<string> {
  if (cluster.kind === 'entity_identity') {
    await persistEntitySuppression(context, cluster, 'keep_separate');
  }
  if (cluster.kind === 'fact_conflict') {
    await persistFactSuppression(context, cluster, 'keep_separate');
  }
  await resolveCluster(cluster, 'keep_separate', 'resolved');
  return 'Cluster marked keep separate.';
}

/** Reject the cluster's proposals; canon is unchanged. */
export async function rejectCluster(
  context: CanonDecisionContext,
  cluster: CanonDecisionCluster
): Promise<string> {
  const {entityProposal, factProposal} = findCanonDecisionMembers(context.records, cluster);
  if (entityProposal) {
    await saveLoreEntityProposal({...entityProposal, status: 'rejected', updatedAt: Date.now()});
  }
  if (factProposal) {
    await saveLoreFactProposal({...factProposal, status: 'rejected', updatedAt: Date.now()});
  }
  if (cluster.kind === 'fact_conflict') {
    await persistFactSuppression(context, cluster, 'reject');
  }
  await resolveCluster(cluster, 'reject', 'resolved');
  return 'Cluster rejected.';
}

/** Set the cluster aside for later. */
export async function deferCluster(cluster: CanonDecisionCluster): Promise<string> {
  await resolveCluster(cluster, 'defer', 'deferred');
  return 'Cluster deferred.';
}
