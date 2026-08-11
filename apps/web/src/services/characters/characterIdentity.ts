import type {
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';

export type CharacterIdentityClassification =
  | 'already-linked'
  | 'unambiguous-same-identity'
  | 'tools-only-orphan'
  | 'world-bible-only'
  | 'ambiguous-collision'
  | 'sheet-only';

export interface ActorResolution {
  id: string;
  projectId: string;
  legacyActorId: string;
  legacyActorType: 'character' | 'sheet';
  entityId: string;
  createdAt: number;
}

export interface CharacterIdentityClassificationRecord {
  recordType: 'entity' | 'character' | 'sheet';
  recordId: string;
  name: string;
  classification: CharacterIdentityClassification;
  entityId?: string;
  reason: string;
}

export interface CharacterIdentityMigrationReport {
  id: string;
  projectId: string;
  schemaVersion: 1;
  generatedAt: number;
  categoryCounts: {
    character: number;
    general: number;
  };
  sourceCounts: {
    characterEntities: number;
    characters: number;
    sheets: number;
  };
  classifiedRecordCount: number;
  countsByClassification: Record<CharacterIdentityClassification, number>;
  records: CharacterIdentityClassificationRecord[];
}

export interface CharacterIdentityClassificationResult {
  categories: EntityCategory[];
  characters: Character[];
  sheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  report: CharacterIdentityMigrationReport;
}

const CHARACTER_CATEGORY_HINTS = new Set([
  'character',
  'characters',
  'cast',
  'npc',
  'npcs',
  'person',
  'people'
]);

export const normalizeCharacterIdentityName = (value: string): string =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export function inferLegacyCategoryKind(
  category: Pick<EntityCategory, 'name' | 'slug'> & {kind?: EntityCategory['kind']}
): EntityCategory['kind'] {
  if (category.kind === 'character' || category.kind === 'general') {
    return category.kind;
  }
  const hints = `${category.slug} ${category.name}`
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return hints.some((hint) => CHARACTER_CATEGORY_HINTS.has(hint))
    ? 'character'
    : 'general';
}

export const isCharacterCategory = (
  category: Pick<EntityCategory, 'kind'>
): boolean => category.kind === 'character';

function groupByNormalizedName<T extends {name: string}>(records: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  records.forEach((record) => {
    const key = normalizeCharacterIdentityName(record.name);
    const current = groups.get(key) ?? [];
    current.push(record);
    groups.set(key, current);
  });
  return groups;
}

function emptyClassificationCounts(): Record<CharacterIdentityClassification, number> {
  return {
    'already-linked': 0,
    'unambiguous-same-identity': 0,
    'tools-only-orphan': 0,
    'world-bible-only': 0,
    'ambiguous-collision': 0,
    'sheet-only': 0
  };
}

export function classifyCharacterIdentities(params: {
  projectId: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  generatedAt?: number;
}): CharacterIdentityClassificationResult {
  const generatedAt = params.generatedAt ?? Date.now();
  const categories = params.categories.map((category) => ({
    ...category,
    kind: inferLegacyCategoryKind(category)
  }));
  const characterCategoryIds = new Set(
    categories.filter(isCharacterCategory).map((category) => category.id)
  );
  const characterEntities = params.entities.filter((entity) =>
    characterCategoryIds.has(entity.categoryId)
  );
  const entityById = new Map(characterEntities.map((entity) => [entity.id, entity]));
  const entitiesByName = groupByNormalizedName(characterEntities);
  const charactersByName = groupByNormalizedName(params.characters);
  const sheetsByName = groupByNormalizedName(params.sheets);
  const records: CharacterIdentityClassificationRecord[] = [];
  const actorResolutions: ActorResolution[] = [];
  const linkedEntityIds = new Set<string>();

  const characters = params.characters.map((character): Character => {
    const explicitEntity = character.entityId
      ? entityById.get(character.entityId)
      : undefined;
    const normalizedName = normalizeCharacterIdentityName(character.name);
    const entityCandidates = entitiesByName.get(normalizedName) ?? [];
    const characterCandidates = charactersByName.get(normalizedName) ?? [];
    let classification: CharacterIdentityClassification;
    let reason: string;
    let entityId: string | undefined;

    if (explicitEntity) {
      classification = 'already-linked';
      reason = 'The character extension already carried a valid canonical entity link.';
      entityId = explicitEntity.id;
    } else if (entityCandidates.length === 1 && characterCandidates.length === 1) {
      classification = 'unambiguous-same-identity';
      reason = 'Exact normalized name was unique among character entities and extensions.';
      entityId = entityCandidates[0].id;
    } else if (entityCandidates.length > 0) {
      classification = 'ambiguous-collision';
      reason = 'The normalized name was not unique on both sides; author resolution is required.';
    } else {
      classification = 'tools-only-orphan';
      reason = character.entityId
        ? 'The stored canonical entity link was invalid; author resolution is required.'
        : 'No character-kind canonical entity has the same normalized name.';
    }

    records.push({
      recordType: 'character',
      recordId: character.id,
      name: character.name,
      classification,
      entityId,
      reason
    });
    if (!entityId) return character;

    linkedEntityIds.add(entityId);
    actorResolutions.push({
      id: `${params.projectId}:character:${character.id}`,
      projectId: params.projectId,
      legacyActorId: character.id,
      legacyActorType: 'character',
      entityId,
      createdAt: generatedAt
    });
    return {...character, entityId};
  });

  const characterById = new Map(characters.map((character) => [character.id, character]));
  const sheets = params.sheets.map((sheet): CharacterSheet => {
    const explicitEntity = sheet.characterEntityId
      ? entityById.get(sheet.characterEntityId)
      : undefined;
    const extensionEntityId = sheet.characterId
      ? characterById.get(sheet.characterId)?.entityId
      : undefined;
    const normalizedName = normalizeCharacterIdentityName(sheet.name);
    const entityCandidates = entitiesByName.get(normalizedName) ?? [];
    const sheetCandidates = sheetsByName.get(normalizedName) ?? [];
    let classification: CharacterIdentityClassification;
    let reason: string;
    let entityId: string | undefined;

    if (explicitEntity) {
      classification = 'already-linked';
      reason = 'The character sheet already carried a valid canonical entity link.';
      entityId = explicitEntity.id;
    } else if (extensionEntityId && entityById.has(extensionEntityId)) {
      classification = 'unambiguous-same-identity';
      reason = 'The sheet legacy character ID resolves to one canonical entity.';
      entityId = extensionEntityId;
    } else if (
      entityCandidates.length === 1 &&
      sheetCandidates.length === 1 &&
      (charactersByName.get(normalizedName) ?? []).length === 0
    ) {
      classification = 'unambiguous-same-identity';
      reason = 'Exact normalized name was unique among character entities and sheets.';
      entityId = entityCandidates[0].id;
    } else if (entityCandidates.length > 0 || (sheet.characterId && characterById.has(sheet.characterId))) {
      classification = 'ambiguous-collision';
      reason = 'The sheet cannot be linked uniquely; author resolution is required.';
    } else {
      classification = 'sheet-only';
      reason = 'The sheet has no resolvable character extension or canonical entity.';
    }

    records.push({
      recordType: 'sheet',
      recordId: sheet.id,
      name: sheet.name,
      classification,
      entityId,
      reason
    });
    if (!entityId) return sheet;

    linkedEntityIds.add(entityId);
    actorResolutions.push({
      id: `${params.projectId}:sheet:${sheet.id}`,
      projectId: params.projectId,
      legacyActorId: sheet.id,
      legacyActorType: 'sheet',
      entityId,
      createdAt: generatedAt
    });
    return {...sheet, characterEntityId: entityId};
  });

  characterEntities.forEach((entity) => {
    const normalizedName = normalizeCharacterIdentityName(entity.name);
    const characterCandidates = charactersByName.get(normalizedName) ?? [];
    const sheetCandidates = sheetsByName.get(normalizedName) ?? [];
    const sameNameCount = characterCandidates.length + sheetCandidates.length;
    const classification: CharacterIdentityClassification = linkedEntityIds.has(entity.id)
      ? characterCandidates.some((character) => character.entityId === entity.id) ||
        params.sheets.some((sheet) => sheet.characterEntityId === entity.id)
        ? 'already-linked'
        : 'unambiguous-same-identity'
      : sameNameCount > 0
        ? 'ambiguous-collision'
        : 'world-bible-only';
    records.push({
      recordType: 'entity',
      recordId: entity.id,
      name: entity.name,
      classification,
      entityId: entity.id,
      reason:
        classification === 'world-bible-only'
          ? 'The canonical character has no linked extension or sheet.'
          : classification === 'ambiguous-collision'
            ? 'A same-name legacy record exists, but the match is not unique.'
            : 'The canonical entity participates in a deterministic identity link.'
    });
  });

  const countsByClassification = emptyClassificationCounts();
  records.forEach((record) => {
    countsByClassification[record.classification] += 1;
  });
  const categoryCounts = categories.reduce(
    (counts, category) => {
      counts[category.kind] += 1;
      return counts;
    },
    {character: 0, general: 0}
  );
  const report: CharacterIdentityMigrationReport = {
    id: `${params.projectId}:character-identity:v1`,
    projectId: params.projectId,
    schemaVersion: 1,
    generatedAt,
    categoryCounts,
    sourceCounts: {
      characterEntities: characterEntities.length,
      characters: params.characters.length,
      sheets: params.sheets.length
    },
    classifiedRecordCount: records.length,
    countsByClassification,
    records
  };

  return {categories, characters, sheets, actorResolutions, report};
}

export interface CharacterLinkResolver {
  resolveEntityId(input: {
    entityId?: string;
    characterId?: string;
    sheetId?: string;
    actorId?: string;
  }): string | undefined;
  getEntity(entityId: string): WorldEntity | undefined;
  getCharacter(entityId: string): Character | undefined;
  getSheet(entityId: string): CharacterSheet | undefined;
}

export function createCharacterLinkResolver(params: {
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  actorResolutions?: ActorResolution[];
}): CharacterLinkResolver {
  const characterEntityIds = new Set(
    params.entities
      .filter((entity) =>
        params.categories.some(
          (category) => category.id === entity.categoryId && isCharacterCategory(category)
        )
      )
      .map((entity) => entity.id)
  );
  const entityById = new Map(
    params.entities
      .filter((entity) => characterEntityIds.has(entity.id))
      .map((entity) => [entity.id, entity])
  );
  const characterById = new Map(params.characters.map((record) => [record.id, record]));
  const sheetById = new Map(params.sheets.map((record) => [record.id, record]));
  const actorMap = new Map(
    (params.actorResolutions ?? []).map((record) => [record.legacyActorId, record.entityId])
  );
  const classification = classifyCharacterIdentities({
    projectId:
      params.categories[0]?.projectId ??
      params.entities[0]?.projectId ??
      params.characters[0]?.projectId ??
      params.sheets[0]?.projectId ??
      '',
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.sheets,
    generatedAt: 0
  });
  classification.actorResolutions.forEach((record) => {
    if (!actorMap.has(record.legacyActorId)) actorMap.set(record.legacyActorId, record.entityId);
  });
  const characterByEntityId = new Map<string, Character>();
  classification.characters.forEach((record) => {
    if (record.entityId && !characterByEntityId.has(record.entityId)) {
      characterByEntityId.set(record.entityId, record);
    }
  });
  const sheetByEntityId = new Map<string, CharacterSheet>();
  classification.sheets.forEach((record) => {
    if (record.characterEntityId && !sheetByEntityId.has(record.characterEntityId)) {
      sheetByEntityId.set(record.characterEntityId, record);
    }
  });

  const validEntityId = (candidate?: string): string | undefined =>
    candidate && entityById.has(candidate) ? candidate : undefined;

  return {
    resolveEntityId(input) {
      return (
        validEntityId(input.entityId) ??
        validEntityId(input.characterId && characterById.get(input.characterId)?.entityId) ??
        validEntityId(input.sheetId && sheetById.get(input.sheetId)?.characterEntityId) ??
        validEntityId(input.actorId && actorMap.get(input.actorId)) ??
        validEntityId(input.characterId && actorMap.get(input.characterId)) ??
        validEntityId(input.sheetId && actorMap.get(input.sheetId))
      );
    },
    getEntity: (entityId) => entityById.get(entityId),
    getCharacter: (entityId) => characterByEntityId.get(entityId),
    getSheet: (entityId) => sheetByEntityId.get(entityId)
  };
}
