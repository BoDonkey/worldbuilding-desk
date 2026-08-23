import type {
  CanonicalFact,
  Character,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';
import {getCharactersByProject, saveCharacter} from '../../characterStorage';
import {getEntitiesByProject, saveEntity} from '../../entityStorage';
import {
  deleteAliasById,
  getAliasesByProject,
  saveAlias
} from '../consistency';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';

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

export function buildCanonicalFactSummary(fact: CanonicalFact): string {
  const label = fact.targetName ?? fact.targetId;
  return `${label} ${fact.factType.replace(/_/g, ' ')}: ${canonicalFactValueText(fact)}`;
}

export function prependUniqueCanonicalFact(
  current: CanonicalFact[],
  fact: CanonicalFact
): CanonicalFact[] {
  return [fact, ...current.filter((entry) => entry.id !== fact.id)];
}

export function buildCanonicalFactMemoryContent(fact: CanonicalFact): string {
  return [
    buildCanonicalFactSummary(fact),
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
  fact: CanonicalFact
): Promise<void> {
  await shodhService.captureAutoMemory({
    projectId: fact.projectId,
    documentId: getCanonicalFactMemoryDocumentId(fact.id),
    title: `Canon fact: ${fact.targetName ?? fact.targetId}`,
    content: buildCanonicalFactMemoryContent(fact),
    tags: ['canon_fact', fact.factType]
  });
}

export async function deleteCanonicalFactMemory(
  shodhService: ShodhMemoryProvider,
  factId: string
): Promise<void> {
  await shodhService.deleteMemoriesForDocument(getCanonicalFactMemoryDocumentId(factId));
}

export async function applyCanonicalFactSideEffects(
  projectId: string,
  fact: CanonicalFact
): Promise<void> {
  if (fact.factType === 'alias') {
    await saveAlias({
      projectId,
      targetId: fact.targetId,
      targetType: fact.targetType,
      alias: typeof fact.value === 'string' ? fact.value : fact.value.value
    });
    return;
  }

  if (fact.targetType === 'character') {
    const characters = await getCharactersByProject(projectId);
    const character = characters.find((entry) => entry.id === fact.targetId);
    if (!character) return;
    const nextCharacter: Character = {
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
      updatedAt: Date.now()
    };
    await saveCharacter(nextCharacter);
    return;
  }

  // CanonicalFact is the authoritative record. Earlier builds copied several
  // fact types into free-form Notes without recording ownership, which made a
  // later removal leave hidden canon-like residue. Entity facts now remain in
  // the accepted-fact surface instead of mutating untracked prose fields.
}

export async function revertCanonicalFactSideEffects(
  projectId: string,
  fact: CanonicalFact,
  remainingFacts: CanonicalFact[]
): Promise<void> {
  if (hasEquivalentRemainingFact(fact, remainingFacts)) return;

  if (fact.factType === 'alias') {
    const normalizedAlias = normalizeFactValue(fact);
    const aliases = await getAliasesByProject(projectId);
    const ownedAlias = aliases.find((alias) =>
      alias.targetType === fact.targetType &&
      alias.targetId === fact.targetId &&
      alias.alias.trim().toLowerCase() === normalizedAlias &&
      alias.createdAt >= fact.acceptedAt
    );
    if (ownedAlias) await deleteAliasById(ownedAlias.id);
    return;
  }

  if (fact.targetType === 'character') {
    const characters = await getCharactersByProject(projectId);
    const character = characters.find((entry) => entry.id === fact.targetId);
    if (!character) return;
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
    if (changed) {
      await saveCharacter({...character, fields, updatedAt: Date.now()});
    }
    return;
  }

  if (!['background', 'trait', 'ability', 'appearance'].includes(fact.factType)) {
    return;
  }
  const entities = await getEntitiesByProject(projectId);
  const entity = entities.find((entry) => entry.id === fact.targetId);
  const notes = typeof entity?.fields.notes === 'string' ? entity.fields.notes : '';
  if (!entity || !notes) return;
  const addition = `${fact.factType}: ${canonicalFactValueText(fact)}`;
  const lines = notes.split('\n');
  let ownedLineIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim() === addition) {
      ownedLineIndex = index;
      break;
    }
  }
  if (ownedLineIndex < 0) return;
  lines.splice(ownedLineIndex, 1);
  const fields = {...entity.fields};
  const nextNotes = lines.join('\n').trim();
  if (nextNotes) fields.notes = nextNotes;
  else delete fields.notes;
  const nextEntity: WorldEntity = {
    ...entity,
    fields,
    updatedAt: Date.now()
  };
  await saveEntity(nextEntity);
}
