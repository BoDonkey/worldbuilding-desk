import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import {
  ACTOR_RESOLUTION_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CATEGORY_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb
} from '../../db';
import {getCharactersByProject} from '../../characterStorage';
import {getCategoriesByProject} from '../../categoryStorage';
import {getEntitiesByProject} from '../../entityStorage';
import {getAliasesByProject, type ConsistencyAlias} from '../consistency/aliasStorage';
import {getCanonicalFactsByProject} from '../lore/loreFactStorage';
import {getCharacterSheetsByProject} from './characterSheetService';
import {
  classifyCharacterIdentities,
  createCharacterLinkResolver,
  type ActorResolution,
  type CharacterIdentityMigrationReport
} from './characterIdentity';
import {
  downloadJsonFile,
  readJsonFile,
  sanitizeFileNamePart
} from '../storage/jsonTransfer';

export interface CharacterTransferPayloadV1 {
  schemaVersion: 1;
  kind: 'characters';
  packageType: 'roster' | 'full';
  exportedAt: number;
  sourceProjectName: string;
  data: {
    characters: Character[];
    characterSheets: CharacterSheet[];
  };
}

export interface CharacterTransferPayloadV2 {
  schemaVersion: 2;
  kind: 'characters';
  packageType: 'roster' | 'full';
  exportedAt: number;
  sourceProjectName: string;
  data: {
    categories: EntityCategory[];
    entities: WorldEntity[];
    consistencyAliases: ConsistencyAlias[];
    canonicalFacts: CanonicalFact[];
    characters: Character[];
    characterSheets: CharacterSheet[];
  };
}

export type CharacterTransferPayload =
  | CharacterTransferPayloadV1
  | CharacterTransferPayloadV2;

export interface PreparedCharacterTransferImport {
  categories: EntityCategory[];
  entities: WorldEntity[];
  consistencyAliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  characters: Character[];
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  identityReport: CharacterIdentityMigrationReport;
}

function isBasePayload(value: unknown): value is Record<string, unknown> & {
  schemaVersion: number;
  kind: 'characters';
  packageType: 'roster' | 'full';
  data: Record<string, unknown>;
} {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  const data = payload.data;
  return (
    (payload.schemaVersion === 1 || payload.schemaVersion === 2) &&
    payload.kind === 'characters' &&
    (payload.packageType === 'roster' || payload.packageType === 'full') &&
    Boolean(data && typeof data === 'object')
  );
}

export function isCharacterTransferPayload(
  value: unknown
): value is CharacterTransferPayload {
  if (!isBasePayload(value)) return false;
  if (
    !Array.isArray(value.data.characters) ||
    !Array.isArray(value.data.characterSheets)
  ) {
    return false;
  }
  if (value.schemaVersion === 1) return true;
  return (
    Array.isArray(value.data.categories) &&
    Array.isArray(value.data.entities) &&
    Array.isArray(value.data.consistencyAliases) &&
    Array.isArray(value.data.canonicalFacts)
  );
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function createCharacterTransferPayload(params: {
  projectName: string;
  includeSheets: boolean;
  entityIds?: string[];
  exportedAt?: number;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  characters: Character[];
  characterSheets: CharacterSheet[];
}): CharacterTransferPayloadV2 {
  const resolver = createCharacterLinkResolver({
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.characterSheets
  });
  const selectedEntityIds = params.entityIds ? new Set(params.entityIds) : null;
  const entityIds = new Set<string>(
    selectedEntityIds
      ? params.entities
          .filter((entity) => selectedEntityIds.has(entity.id))
          .map((entity) => entity.id)
      : []
  );
  const characters = params.characters.filter((character) => {
    if (!selectedEntityIds) return true;
    const entityId = resolver.resolveEntityId({characterId: character.id});
    return Boolean(entityId && selectedEntityIds.has(entityId));
  });
  const characterIds = new Set(characters.map((character) => character.id));
  const entityIdByCharacterId = new Map<string, string>();
  characters.forEach((character) => {
    const entityId = resolver.resolveEntityId({characterId: character.id});
    if (!entityId) return;
    entityIds.add(entityId);
    entityIdByCharacterId.set(character.id, entityId);
  });
  const characterSheets = params.includeSheets
    ? params.characterSheets.filter((sheet) => {
        const entityId = resolver.resolveEntityId({
          sheetId: sheet.id,
          characterId: sheet.characterId
        });
        if (!selectedEntityIds) {
          if (entityId) entityIds.add(entityId);
          return true;
        }
        return Boolean(entityId && selectedEntityIds.has(entityId));
      })
    : [];
  const entities = params.entities.filter((entity) => entityIds.has(entity.id));
  const categoryIds = new Set(entities.map((entity) => entity.categoryId));
  const categories = params.categories.filter((category) => categoryIds.has(category.id));
  const consistencyAliases = params.aliases.flatMap((alias): ConsistencyAlias[] => {
    if (alias.targetType === 'entity') {
      return entityIds.has(alias.targetId) ? [alias] : [];
    }
    const entityId = entityIdByCharacterId.get(alias.targetId);
    return entityId
      ? [{...alias, targetType: 'entity', targetId: entityId, entityId}]
      : characterIds.has(alias.targetId)
        ? [alias]
        : [];
  });
  const canonicalFacts = params.canonicalFacts.flatMap((fact): CanonicalFact[] => {
    if (fact.targetType === 'entity') {
      return entityIds.has(fact.targetId) ? [fact] : [];
    }
    const entityId = entityIdByCharacterId.get(fact.targetId);
    const entity = entityId ? resolver.getEntity(entityId) : undefined;
    return entityId
      ? [
          {
            ...fact,
            targetType: 'entity',
            targetId: entityId,
            targetName: entity?.name ?? fact.targetName
          }
        ]
      : characterIds.has(fact.targetId)
        ? [fact]
        : [];
  });

  return {
    schemaVersion: 2,
    kind: 'characters',
    packageType: params.includeSheets ? 'full' : 'roster',
    exportedAt: params.exportedAt ?? Date.now(),
    sourceProjectName: params.projectName,
    data: {
      categories,
      entities,
      consistencyAliases,
      canonicalFacts,
      characters: characters.map((character) => ({
        ...character,
        entityId:
          resolver.resolveEntityId({characterId: character.id}) ?? character.entityId
      })),
      characterSheets: characterSheets.map((sheet) => ({
        ...sheet,
        characterEntityId:
          resolver.resolveEntityId({
            sheetId: sheet.id,
            characterId: sheet.characterId
          }) ?? sheet.characterEntityId
      }))
    }
  };
}

export async function exportCharactersJson(params: {
  projectId: string;
  projectName: string;
  includeSheets?: boolean;
  entityIds?: string[];
}): Promise<void> {
  const includeSheets = params.includeSheets ?? true;
  const [categories, entities, aliases, canonicalFacts, characters, characterSheets] =
    await Promise.all([
      getCategoriesByProject(params.projectId),
      getEntitiesByProject(params.projectId),
      getAliasesByProject(params.projectId),
      getCanonicalFactsByProject(params.projectId),
      getCharactersByProject(params.projectId),
      getCharacterSheetsByProject(params.projectId)
    ]);
  const payload = createCharacterTransferPayload({
    projectName: params.projectName,
    includeSheets,
    entityIds: params.entityIds,
    categories,
    entities,
    aliases,
    canonicalFacts,
    characters,
    characterSheets
  });
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(
    params.projectName
  )}-characters-${payload.packageType}-${stamp}.json`;
  downloadJsonFile(fileName, payload);
}

export function prepareCharacterTransferImport(params: {
  payload: CharacterTransferPayload;
  projectId: string;
  includeSheets: boolean;
  existingCategories: EntityCategory[];
  existingEntities: WorldEntity[];
  generatedAt?: number;
}): PreparedCharacterTransferImport {
  const generatedAt = params.generatedAt ?? Date.now();
  const categoryIdMap = new Map<string, string>();
  const categories: EntityCategory[] = [];
  const payloadCategories = params.payload.schemaVersion === 2
    ? params.payload.data.categories
    : [];
  payloadCategories.forEach((category) => {
    const normalizedName = normalizeName(category.name);
    const normalizedSlug = normalizeName(category.slug);
    const existing = params.existingCategories.find(
      (candidate) =>
        candidate.kind === category.kind &&
        (normalizeName(candidate.name) === normalizedName ||
          normalizeName(candidate.slug) === normalizedSlug)
    );
    if (existing) {
      categoryIdMap.set(category.id, existing.id);
      return;
    }
    const id = crypto.randomUUID();
    categoryIdMap.set(category.id, id);
    categories.push({...category, id, projectId: params.projectId});
  });

  const entityIdMap = new Map<string, string>();
  const sourceEntities = params.payload.schemaVersion === 2
    ? params.payload.data.entities
    : [];
  const entities = sourceEntities.map((entity) => {
    const id = crypto.randomUUID();
    entityIdMap.set(entity.id, id);
    return {
      ...entity,
      id,
      projectId: params.projectId,
      categoryId: categoryIdMap.get(entity.categoryId) ?? entity.categoryId
    };
  });

  const characterIdMap = new Map<string, string>();
  const characters = params.payload.data.characters.map((character) => {
    if (
      params.payload.schemaVersion === 2 &&
      character.entityId &&
      !entityIdMap.has(character.entityId)
    ) {
      throw new Error(
        `Character package record "${character.name}" references missing canonical identity "${character.entityId}".`
      );
    }
    const id = crypto.randomUUID();
    characterIdMap.set(character.id, id);
    return {
      ...character,
      id,
      projectId: params.projectId,
      entityId: character.entityId
        ? entityIdMap.get(character.entityId)
        : undefined
    };
  });
  const characterSheets = params.includeSheets
    ? params.payload.data.characterSheets.map((sheet) => ({
        ...sheet,
        id: crypto.randomUUID(),
        projectId: params.projectId,
        characterId: sheet.characterId
          ? characterIdMap.get(sheet.characterId)
          : undefined,
        characterEntityId: sheet.characterEntityId
          ? entityIdMap.get(sheet.characterEntityId)
          : undefined
      }))
    : [];
  const allCategories = [...params.existingCategories, ...categories];
  const allEntities = [...params.existingEntities, ...entities];
  const classification = classifyCharacterIdentities({
    projectId: params.projectId,
    categories: allCategories,
    entities: allEntities,
    characters,
    sheets: characterSheets,
    generatedAt
  });
  const importedCategoryIds = new Set<string>(categories.map((category) => category.id));
  const importedEntityIds = new Set<string>(entities.map((entity) => entity.id));
  const classifiedCategories = classification.categories.filter((category) =>
    importedCategoryIds.has(category.id)
  );
  const classifiedEntities = allEntities.filter((entity) => importedEntityIds.has(entity.id));
  const classifiedCharacterById = new Map(
    classification.characters.map((character) => [character.id, character])
  );
  const consistencyAliases = params.payload.schemaVersion === 2
    ? params.payload.data.consistencyAliases.flatMap((alias): ConsistencyAlias[] => {
        const importedCharacterId = alias.targetType === 'character'
          ? characterIdMap.get(alias.targetId)
          : undefined;
        const entityId = alias.targetType === 'entity'
          ? entityIdMap.get(alias.targetId)
          : importedCharacterId
            ? classifiedCharacterById.get(importedCharacterId)?.entityId
            : undefined;
        const targetId = entityId ?? importedCharacterId;
        if (!targetId) return [];
        return [
          {
            ...alias,
            id: crypto.randomUUID(),
            projectId: params.projectId,
            targetType: entityId ? 'entity' : 'character',
            targetId,
            entityId
          }
        ];
      })
    : [];
  const entityById = new Map(classifiedEntities.map((entity) => [entity.id, entity]));
  const canonicalFacts = params.payload.schemaVersion === 2
    ? params.payload.data.canonicalFacts.flatMap((fact): CanonicalFact[] => {
        const importedCharacterId = fact.targetType === 'character'
          ? characterIdMap.get(fact.targetId)
          : undefined;
        const entityId = fact.targetType === 'entity'
          ? entityIdMap.get(fact.targetId)
          : importedCharacterId
            ? classifiedCharacterById.get(importedCharacterId)?.entityId
            : undefined;
        const targetId = entityId ?? importedCharacterId;
        if (!targetId) return [];
        return [
          {
            ...fact,
            id: crypto.randomUUID(),
            projectId: params.projectId,
            targetType: entityId ? 'entity' : 'character',
            targetId,
            targetName:
              (entityId ? entityById.get(entityId)?.name : undefined) ?? fact.targetName
          }
        ];
      })
    : [];

  return {
    categories: classifiedCategories,
    entities: classifiedEntities,
    consistencyAliases,
    canonicalFacts,
    characters: classification.characters,
    characterSheets: classification.sheets,
    actorResolutions: classification.actorResolutions,
    identityReport: {
      ...classification.report,
      id: `${params.projectId}:character-package:${generatedAt}:${crypto.randomUUID()}`
    }
  };
}

async function persistPreparedCharacterImport(
  prepared: PreparedCharacterTransferImport
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [
      CATEGORY_STORE_NAME,
      ENTITY_STORE_NAME,
      CONSISTENCY_ALIAS_STORE_NAME,
      CANONICAL_FACT_STORE_NAME,
      CHARACTER_STORE_NAME,
      CHARACTER_SHEET_STORE_NAME,
      ACTOR_RESOLUTION_STORE_NAME,
      CHARACTER_IDENTITY_REPORT_STORE_NAME
    ],
    'readwrite'
  );
  const putMany = <T>(storeName: string, records: T[]) =>
    records.map((record) => requestToPromise(tx.objectStore(storeName).put(record)));
  await Promise.all([
    ...putMany(CATEGORY_STORE_NAME, prepared.categories),
    ...putMany(ENTITY_STORE_NAME, prepared.entities),
    ...putMany(CONSISTENCY_ALIAS_STORE_NAME, prepared.consistencyAliases),
    ...putMany(CANONICAL_FACT_STORE_NAME, prepared.canonicalFacts),
    ...putMany(CHARACTER_STORE_NAME, prepared.characters),
    ...putMany(CHARACTER_SHEET_STORE_NAME, prepared.characterSheets),
    ...putMany(ACTOR_RESOLUTION_STORE_NAME, prepared.actorResolutions),
    requestToPromise(
      tx.objectStore(CHARACTER_IDENTITY_REPORT_STORE_NAME).put(prepared.identityReport)
    )
  ]);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function importCharactersJson(params: {
  file: File;
  projectId: string;
  includeSheets?: boolean;
}): Promise<{
  charactersImported: number;
  sheetsImported: number;
  entitiesImported: number;
}> {
  const includeSheets = params.includeSheets ?? true;
  const json = await readJsonFile(params.file);
  if (!isCharacterTransferPayload(json)) {
    throw new Error('Invalid character export file.');
  }
  const [existingCategories, existingEntities] = await Promise.all([
    getCategoriesByProject(params.projectId),
    getEntitiesByProject(params.projectId)
  ]);
  const prepared = prepareCharacterTransferImport({
    payload: json,
    projectId: params.projectId,
    includeSheets,
    existingCategories,
    existingEntities
  });
  await persistPreparedCharacterImport(prepared);
  return {
    charactersImported: prepared.characters.length,
    sheetsImported: prepared.characterSheets.length,
    entitiesImported: prepared.entities.length
  };
}
