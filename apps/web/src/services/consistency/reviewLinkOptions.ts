import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from './aliasStorage';
import type {GuardrailIssue} from './types';
import type {ConsistencyReviewItem} from './reviewReadiness';

export interface LinkTargetOption {
  id: string;
  name: string;
  type: 'character' | 'entity';
  label: string;
}

export const normalizeRecordName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const isLikelyShortFormOfRecord = (
  shortName: string,
  fullName: string
): boolean => {
  const normalizedShort = normalizeRecordName(shortName);
  const normalizedFull = normalizeRecordName(fullName);
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
  const normalizedLeft = normalizeRecordName(left);
  const normalizedRight = normalizeRecordName(right);
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
      .filter((category) => {
        const slug = category.slug.toLowerCase();
        const name = category.name.toLowerCase();
        return slug.includes('character') || name.includes('character');
      })
      .map((category) => category.id)
  );
}

export function buildCharacterLoreEntityIdByCharacterId(params: {
  characterCategoryIds: Set<string>;
  characters: Character[];
  entities: WorldEntity[];
}): Map<string, string> {
  const linkedEntityIdByCharacterId = new Map<string, string>();
  params.entities.forEach((entity) => {
    if (!params.characterCategoryIds.has(entity.categoryId)) return;
    const normalizedEntityName = normalizeRecordName(entity.name);
    const matchingCharacter = params.characters.find(
      (character) => normalizeRecordName(character.name) === normalizedEntityName
    );
    if (matchingCharacter) {
      linkedEntityIdByCharacterId.set(matchingCharacter.id, entity.id);
    }
  });
  return linkedEntityIdByCharacterId;
}

export function buildKnownConsistencyEntities(params: {
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characterLoreEntityIdByCharacterId: Map<string, string>;
}): Array<{id: string; name: string; type: 'entity'}> {
  const entityById = new Map(params.entities.map((entity) => [entity.id, entity]));
  return [
    ...params.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: 'entity' as const
    })),
    ...params.aliases
      .map((alias) => {
        const targetId =
          alias.targetType === 'character'
            ? params.characterLoreEntityIdByCharacterId.get(alias.targetId)
            : alias.targetId;
        const linkedRecord = targetId ? entityById.get(targetId) : null;
        return linkedRecord
          ? {id: linkedRecord.id, name: alias.alias, type: 'entity' as const}
          : null;
      })
      .filter(
        (entry): entry is {id: string; name: string; type: 'entity'} =>
          Boolean(entry)
      )
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
        label: 'Character Tools'
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
      const normalizedName = normalizeRecordName(record.name);
      return (
        normalizedName === normalizeRecordName(normalizedSurface) ||
        normalizedName.includes(normalizedSurface) ||
        normalizedSurface.includes(normalizedName) ||
        isLikelyShortFormOfRecord(normalizedSurface, normalizedName) ||
        isLikelyShortFormOfRecord(normalizedName, normalizedSurface)
      );
    });
  });
  return optionMap;
}
