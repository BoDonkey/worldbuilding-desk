import type {
  CanonicalFact,
  Character,
  LoreFactProposal,
  WritingDocument,
  WorldEntity
} from '../../entityTypes';
import {
  CANONICAL_FACT_STORE_NAME,
  CHARACTER_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME
} from '../../db';
import {getCharactersByProject, putCharacterInTransaction} from '../../characterStorage';
import {getEntitiesByProject, putEntityInTransaction} from '../../entityStorage';
import {
  deleteAliasInTransaction,
  getAliasesByProject,
  planAliasSave,
  putAliasInTransaction
} from '../consistency/aliasStorage';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {
  runProjectWriteTransaction,
  type ProjectWriteTransaction
} from '../storage/projectWriteTransaction';
import {
  deleteCanonicalFactInTransaction,
  putCanonicalFactInTransaction,
  putLoreFactProposalInTransaction
} from './loreFactStorage';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {
  formatCanonicalFactValidity,
  getCanonicalFactValidityTags
} from './canonicalFactValidity';

function canonicalFactValueText(fact: CanonicalFact | LoreFactProposal): string {
  return typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`;
}

const normalizeFactValue = (fact: CanonicalFact | LoreFactProposal): string =>
  canonicalFactValueText(fact).trim().toLowerCase();

const hasEquivalentRemainingFact = (
  fact: CanonicalFact,
  remainingFacts: CanonicalFact[]
): boolean => remainingFacts.some((entry) =>
  entry.id !== fact.id &&
  entry.targetType === fact.targetType &&
  entry.targetId === fact.targetId &&
  entry.factType === fact.factType &&
  normalizeFactValue(entry) === normalizeFactValue(fact)
);

export function getCanonicalFactMemoryDocumentId(factId: string): string {
  return `canon-fact:${factId}`;
}

export function buildCanonicalFactSummary(
  fact: CanonicalFact,
  documents: WritingDocument[] = []
): string {
  const label = fact.targetName ?? fact.targetId;
  const validity = formatCanonicalFactValidity(fact, documents);
  return `${label} ${fact.factType.replace(/_/g, ' ')}: ${canonicalFactValueText(fact)}` +
    (validity ? ` (${validity})` : '');
}

export function prependUniqueCanonicalFact(
  current: CanonicalFact[],
  fact: CanonicalFact
): CanonicalFact[] {
  return [fact, ...current.filter((entry) => entry.id !== fact.id)];
}

export function buildCanonicalFactMemoryContent(
  fact: CanonicalFact,
  documents: WritingDocument[] = []
): string {
  return [
    buildCanonicalFactSummary(fact, documents),
    fact.sourceLoreDocumentTitle
      ? `Accepted from Source Note: ${fact.sourceLoreDocumentTitle}`
      : null,
    fact.evidenceText ? `Evidence: ${fact.evidenceText}` : null
  ]
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .join('\n');
}

export async function captureCanonicalFactMemory(
  shodhService: ShodhMemoryProvider,
  fact: CanonicalFact,
  documents: WritingDocument[] = []
): Promise<void> {
  await shodhService.captureAutoMemory({
    projectId: fact.projectId,
    documentId: getCanonicalFactMemoryDocumentId(fact.id),
    title: `Canon fact: ${fact.targetName ?? fact.targetId}`,
    content: buildCanonicalFactMemoryContent(fact, documents),
    tags: ['canon_fact', fact.factType, ...getCanonicalFactValidityTags(fact)]
  });
}

export async function deleteCanonicalFactMemory(
  shodhService: ShodhMemoryProvider,
  factId: string
): Promise<void> {
  await shodhService.deleteMemoriesForDocument(getCanonicalFactMemoryDocumentId(factId));
}

/** Records a fact's side effects change, with no storage access. */
export interface CanonicalFactSideEffectPlan {
  aliasToPut?: ConsistencyAlias;
  aliasIdToDelete?: string;
  characterToPut?: Character;
  entityToPut?: WorldEntity;
}

interface SideEffectSnapshot {
  aliases: ConsistencyAlias[];
  characters: Character[];
  entities: WorldEntity[];
}

/**
 * What accepting a fact changes besides the fact itself: an alias fact adds
 * an alias; a character occupation or age fills an empty field. Entity facts
 * stay in the accepted-fact surface: earlier builds copied several fact types
 * into free-form Notes without recording ownership, which left hidden
 * canon-like residue after removal.
 */
export function planCanonicalFactSideEffects(
  projectId: string,
  fact: CanonicalFact,
  snapshot: SideEffectSnapshot,
  now: number = Date.now()
): CanonicalFactSideEffectPlan {
  if (fact.factType === 'alias') {
    return {
      aliasToPut: planAliasSave(snapshot.aliases, {
        projectId,
        targetId: fact.targetId,
        targetType: fact.targetType,
        alias: typeof fact.value === 'string' ? fact.value : fact.value.value
      }, now)
    };
  }
  if (fact.targetType !== 'character') return {};
  const character = snapshot.characters.find((entry) => entry.id === fact.targetId);
  if (!character) return {};
  return {
    characterToPut: {
      ...character,
      fields: {
        ...character.fields,
        ...(fact.factType === 'occupation' && !character.fields.role
          ? {role: canonicalFactValueText(fact)}
          : {}),
        ...(fact.factType === 'age' && !character.fields.age
          ? {age: canonicalFactValueText(fact)}
          : {})
      },
      updatedAt: now
    }
  };
}

/**
 * What removing (or superseding) a fact undoes: only side effects the fact
 * itself created, and only when no equivalent fact remains.
 */
export function planRevertCanonicalFactSideEffects(
  fact: CanonicalFact,
  remainingFacts: CanonicalFact[],
  snapshot: SideEffectSnapshot,
  now: number = Date.now()
): CanonicalFactSideEffectPlan {
  if (hasEquivalentRemainingFact(fact, remainingFacts)) return {};

  if (fact.factType === 'alias') {
    const normalizedAlias = normalizeFactValue(fact);
    const ownedAlias = snapshot.aliases.find((alias) =>
      alias.targetType === fact.targetType &&
      alias.targetId === fact.targetId &&
      alias.alias.trim().toLowerCase() === normalizedAlias &&
      alias.createdAt >= fact.acceptedAt
    );
    return ownedAlias ? {aliasIdToDelete: ownedAlias.id} : {};
  }

  if (fact.targetType === 'character') {
    const character = snapshot.characters.find((entry) => entry.id === fact.targetId);
    if (!character) return {};
    const fields = {...character.fields};
    let changed = false;
    if (
      fact.factType === 'occupation' &&
      typeof fields.role === 'string' &&
      fields.role.trim().toLowerCase() === normalizeFactValue(fact)
    ) {
      delete fields.role;
      changed = true;
    }
    if (
      fact.factType === 'age' &&
      typeof fields.age === 'string' &&
      fields.age.trim().toLowerCase() === normalizeFactValue(fact)
    ) {
      delete fields.age;
      changed = true;
    }
    return changed ? {characterToPut: {...character, fields, updatedAt: now}} : {};
  }

  if (!['background', 'trait', 'ability', 'appearance'].includes(fact.factType)) {
    return {};
  }
  const entity = snapshot.entities.find((entry) => entry.id === fact.targetId);
  const notes = typeof entity?.fields.notes === 'string' ? entity.fields.notes : '';
  if (!entity || !notes) return {};
  const addition = `${fact.factType}: ${canonicalFactValueText(fact)}`;
  const lines = notes.split('\n');
  let ownedLineIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim() === addition) {
      ownedLineIndex = index;
      break;
    }
  }
  if (ownedLineIndex < 0) return {};
  lines.splice(ownedLineIndex, 1);
  const fields = {...entity.fields};
  const nextNotes = lines.join('\n').trim();
  if (nextNotes) fields.notes = nextNotes;
  else delete fields.notes;
  return {entityToPut: {...entity, fields, updatedAt: now}};
}

/** Applies a plan to the working snapshot so a later plan in the same commit sees it. */
function applyPlanToSnapshot(snapshot: SideEffectSnapshot, plan: CanonicalFactSideEffectPlan): SideEffectSnapshot {
  return {
    aliases: [
      ...snapshot.aliases.filter(
        (alias) => alias.id !== plan.aliasIdToDelete && alias.id !== plan.aliasToPut?.id
      ),
      ...(plan.aliasToPut ? [plan.aliasToPut] : [])
    ],
    characters: plan.characterToPut
      ? snapshot.characters.map((entry) => (entry.id === plan.characterToPut!.id ? plan.characterToPut! : entry))
      : snapshot.characters,
    entities: plan.entityToPut
      ? snapshot.entities.map((entry) => (entry.id === plan.entityToPut!.id ? plan.entityToPut! : entry))
      : snapshot.entities
  };
}

async function readSideEffectSnapshot(projectId: string): Promise<SideEffectSnapshot> {
  const [aliases, characters, entities] = await Promise.all([
    getAliasesByProject(projectId),
    getCharactersByProject(projectId),
    getEntitiesByProject(projectId)
  ]);
  return {aliases, characters, entities};
}

const FACT_STORES = [
  CANONICAL_FACT_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  CHARACTER_STORE_NAME,
  ENTITY_STORE_NAME
];

async function putSideEffects(tx: ProjectWriteTransaction, plans: CanonicalFactSideEffectPlan[]) {
  // Later plans already saw earlier ones (applyPlanToSnapshot); write the final record per key.
  const aliases = new Map<string, ConsistencyAlias | null>();
  const characters = new Map<string, Character>();
  const entities = new Map<string, WorldEntity>();
  for (const plan of plans) {
    if (plan.aliasIdToDelete) aliases.set(plan.aliasIdToDelete, null);
    if (plan.aliasToPut) aliases.set(plan.aliasToPut.id, plan.aliasToPut);
    if (plan.characterToPut) characters.set(plan.characterToPut.id, plan.characterToPut);
    if (plan.entityToPut) entities.set(plan.entityToPut.id, plan.entityToPut);
  }
  for (const [id, alias] of aliases) {
    if (alias) await putAliasInTransaction(tx, alias);
    else await deleteAliasInTransaction(tx, id);
  }
  for (const character of characters.values()) await putCharacterInTransaction(tx, character);
  for (const entity of entities.values()) await putEntityInTransaction(tx, entity);
}

/**
 * Accepts a fact: the fact, its proposal's accepted status, and its side
 * effects commit together. Derived indexes (memory, retrieval) are the
 * caller's job after this resolves.
 */
export async function acceptCanonicalFact(params: {
  projectId: string;
  fact: CanonicalFact;
  proposal: LoreFactProposal;
}): Promise<void> {
  const snapshot = await readSideEffectSnapshot(params.projectId);
  const plan = planCanonicalFactSideEffects(params.projectId, params.fact, snapshot);
  await runProjectWriteTransaction(FACT_STORES, async (tx) => {
    await putCanonicalFactInTransaction(tx, params.fact);
    await putLoreFactProposalInTransaction(tx, params.proposal);
    await putSideEffects(tx, [plan]);
  });
}

/**
 * Replaces a fact from a scene onward: the bounded previous fact, the new
 * fact, the proposal, and the side-effect hand-over commit together.
 */
export async function supersedeCanonicalFact(params: {
  projectId: string;
  previousFact: CanonicalFact;
  nextFact: CanonicalFact;
  proposal: LoreFactProposal;
  /** Facts that remain after the supersession, used to keep shared side effects. */
  remainingFacts: CanonicalFact[];
}): Promise<void> {
  const snapshot = await readSideEffectSnapshot(params.projectId);
  const revert = planRevertCanonicalFactSideEffects(params.previousFact, params.remainingFacts, snapshot);
  const apply = planCanonicalFactSideEffects(
    params.projectId,
    params.nextFact,
    applyPlanToSnapshot(snapshot, revert)
  );
  await runProjectWriteTransaction(FACT_STORES, async (tx) => {
    await putCanonicalFactInTransaction(tx, params.previousFact);
    await putCanonicalFactInTransaction(tx, params.nextFact);
    await putLoreFactProposalInTransaction(tx, params.proposal);
    await putSideEffects(tx, [revert, apply]);
  });
}

/**
 * Removes an accepted fact: its side effects are undone, the fact deleted,
 * and its source proposal reopened, all in one commit.
 */
export async function removeCanonicalFact(params: {
  projectId: string;
  fact: CanonicalFact;
  remainingFacts: CanonicalFact[];
  reopenedProposal?: LoreFactProposal;
}): Promise<void> {
  const snapshot = await readSideEffectSnapshot(params.projectId);
  const revert = planRevertCanonicalFactSideEffects(params.fact, params.remainingFacts, snapshot);
  await runProjectWriteTransaction(FACT_STORES, async (tx) => {
    await putSideEffects(tx, [revert]);
    await deleteCanonicalFactInTransaction(tx, params.fact.id);
    if (params.reopenedProposal) await putLoreFactProposalInTransaction(tx, params.reopenedProposal);
  });
}
