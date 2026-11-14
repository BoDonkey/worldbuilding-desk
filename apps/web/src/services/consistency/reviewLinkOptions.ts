import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import type {GuardrailIssue, KnownEntityRef} from './types';
import type {ConsistencyReviewItem} from './reviewReadiness';
import {createCharacterLinkResolver, isCharacterCategory} from '../characters/characterIdentity';
import {normalizeNameExact} from '../names/nameMatching';

export interface LinkTargetOption {
  id: string;
  name: string;
  type: 'character' | 'entity';
  label: string;
}

const isLikelyShortFormOfRecord = (
  shortName: string,
  fullName: string
): boolean => {
  const normalizedShort = normalizeNameExact(shortName);
  const normalizedFull = normalizeNameExact(fullName);
  if (!normalizedShort || !normalizedFull || normalizedShort === normalizedFull) {
    return false;
  }
  if (normalizedShort.includes(' ') || !normalizedFull.includes(' ')) {
    return false;
  }
  return normalizedFull.split(/\s+/).filter(Boolean)[0] === normalizedShort;
};

export const namesLikelyReferToSameCharacter = (
  left: string,
  right: string
): boolean => {
  const normalizedLeft = normalizeNameExact(left);
  const normalizedRight = normalizeNameExact(right);
  return (
    normalizedLeft === normalizedRight ||
    isLikelyShortFormOfRecord(normalizedLeft, normalizedRight) ||
    isLikelyShortFormOfRecord(normalizedRight, normalizedLeft)
  );
};

export function buildCharacterCategoryIds(
  categories: EntityCategory[]
): Set<string> {
  return new Set(
    categories
      .filter(isCharacterCategory)
      .map((category) => category.id)
  );
}

export function buildCharacterLoreEntityIdByCharacterId(params: {
  characterCategoryIds: Set<string>;
  characters: Character[];
  entities: WorldEntity[];
}): Map<string, string> {
  const projectId = params.characters[0]?.projectId ?? params.entities[0]?.projectId ?? '';
  const categories: EntityCategory[] = Array.from(params.characterCategoryIds).map((id) => ({
    id,
    projectId,
    kind: 'character',
    name: 'Characters',
    slug: 'characters',
    fieldSchema: [],
    createdAt: 0
  }));
  const resolver = createCharacterLinkResolver({
    categories,
    characters: params.characters,
    entities: params.entities,
    sheets: []
  });
  return new Map(
    params.characters.flatMap((character) => {
      const entityId = resolver.resolveEntityId({characterId: character.id});
      return entityId ? [[character.id, entityId] as const] : [];
    })
  );
}

export function buildKnownConsistencyEntities(params: {
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characterLoreEntityIdByCharacterId: Map<string, string>;
  /** Records in these categories are characters, so prose about them can propose state. */
  characterCategoryIds?: Set<string>;
}): KnownEntityRef[] {
  const entityById = new Map(params.entities.map((entity) => [entity.id, entity]));
  const typeOf = (entity: WorldEntity): KnownEntityRef['type'] =>
    params.characterCategoryIds?.has(entity.categoryId) ? 'character' : 'entity';
  return [
    ...params.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: typeOf(entity)
    })),
    ...params.aliases
      .map((alias) => {
        const targetId =
          alias.targetType === 'character'
            ? params.characterLoreEntityIdByCharacterId.get(alias.targetId)
            : alias.targetId;
        const linkedRecord = targetId ? entityById.get(targetId) : null;
        return linkedRecord
          ? {id: linkedRecord.id, name: alias.alias, type: typeOf(linkedRecord)}
          : null;
      })
      .filter((entry): entry is KnownEntityRef => Boolean(entry))
  ];
}

export function buildUnknownLinkOptions(params: {
  categories: EntityCategory[];
  characterCategoryIds: Set<string>;
  characterLoreEntityIdByCharacterId: Map<string, string>;
  characters: Character[];
  consistencyReviewItems: ConsistencyReviewItem[];
  entities: WorldEntity[];
  unknownGuardrailIssues: GuardrailIssue[];
}): Record<string, LinkTargetOption[]> {
  const optionMap: Record<string, LinkTargetOption[]> = {};
  const categoryLabelById = new Map(
    params.categories.map((category) => [category.id, category.name])
  );
  const reviewSurfaces = new Set<string>();
  params.unknownGuardrailIssues.forEach((issue) => {
    const surface = (issue.surface ?? '').trim();
    if (surface) reviewSurfaces.add(surface);
  });
  params.consistencyReviewItems.forEach((item) => {
    if (item.issue.code !== 'UNKNOWN_ENTITY') return;
    const surface = (item.issue.surface ?? '').trim();
    if (surface) reviewSurfaces.add(surface);
  });

  reviewSurfaces.forEach((surface) => {
    const normalizedSurface = surface.toLowerCase();
    const candidatesByKey = new Map<string, LinkTargetOption>();
    params.entities.forEach((entity) => {
      candidatesByKey.set(`entity:${entity.id}`, {
        id: entity.id,
        name: entity.name,
        type: 'entity',
        label: categoryLabelById.get(entity.categoryId) ?? 'World Bible'
      });
    });
    params.characters.forEach((character) => {
      const linkedEntityId =
        params.characterLoreEntityIdByCharacterId.get(character.id);
      if (linkedEntityId && candidatesByKey.has(`entity:${linkedEntityId}`)) return;
      const matchingCharacterEntity = params.entities.find(
        (entity) =>
          params.characterCategoryIds.has(entity.categoryId) &&
          namesLikelyReferToSameCharacter(character.name, entity.name)
      );
      if (matchingCharacterEntity) return;
      candidatesByKey.set(`character:${character.id}`, {
        id: character.id,
        name: character.name,
        type: 'character',
        label: 'Legacy character data'
      });
    });
    optionMap[surface] = Array.from(candidatesByKey.values())
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === normalizedSurface ? 0 : 1;
        const bExact = bName === normalizedSurface ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aClose =
          aName.includes(normalizedSurface) || normalizedSurface.includes(aName)
            ? 0
            : 1;
        const bClose =
          bName.includes(normalizedSurface) || normalizedSurface.includes(bName)
            ? 0
            : 1;
        return aClose !== bClose
          ? aClose - bClose
          : a.name.localeCompare(b.name);
      })
      .slice(0, 20);
  });
  return optionMap;
}

export function buildCloseUnknownLinkOptions(params: {
  unknownGuardrailIssues: GuardrailIssue[];
  unknownLinkOptions: Record<string, LinkTargetOption[]>;
}): Record<string, Array<{id: string; name: string; type: 'character' | 'entity'}>> {
  const optionMap: Record<
    string,
    Array<{id: string; name: string; type: 'character' | 'entity'}>
  > = {};
  params.unknownGuardrailIssues.forEach((issue) => {
    const surface = (issue.surface ?? '').trim();
    if (!surface) return;
    const normalizedSurface = surface.toLowerCase();
    optionMap[surface] = (params.unknownLinkOptions[surface] ?? []).filter((record) => {
      const normalizedName = normalizeNameExact(record.name);
      return (
        normalizedName === normalizeNameExact(normalizedSurface) ||
        normalizedName.includes(normalizedSurface) ||
        normalizedSurface.includes(normalizedName) ||
        isLikelyShortFormOfRecord(normalizedSurface, normalizedName) ||
        isLikelyShortFormOfRecord(normalizedName, normalizedSurface)
      );
    });
  });
  return optionMap;
}
