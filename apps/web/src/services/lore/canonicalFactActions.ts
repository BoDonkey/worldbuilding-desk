import type {
  CanonicalFact,
  Character,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';
import {getCharactersByProject, saveCharacter} from '../../characterStorage';
import {getEntitiesByProject, saveEntity} from '../../entityStorage';
import {saveAlias} from '../consistency';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';

function canonicalFactValueText(fact: CanonicalFact | LoreFactProposal): string {
  return typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`;
}

export function getCanonicalFactMemoryDocumentId(factId: string): string {
  return `canon-fact:${factId}`;
}

export function buildCanonicalFactSummary(fact: CanonicalFact): string {
  const label = fact.targetName ?? fact.targetId;
  return `${label} ${fact.factType.replace(/_/g, ' ')}: ${canonicalFactValueText(fact)}`;
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

  const entities = await getEntitiesByProject(projectId);
  const entity = entities.find((entry) => entry.id === fact.targetId);
  if (!entity) return;
  if (!['background', 'trait', 'ability', 'appearance'].includes(fact.factType)) {
    return;
  }
  const notes = typeof entity.fields.notes === 'string' ? entity.fields.notes.trim() : '';
  const addition = `${fact.factType}: ${canonicalFactValueText(fact)}`;
  const nextEntity: WorldEntity = {
    ...entity,
    fields: {
      ...entity.fields,
      notes: notes ? `${notes}\n${addition}` : addition
    },
    updatedAt: Date.now()
  };
  await saveEntity(nextEntity);
}
