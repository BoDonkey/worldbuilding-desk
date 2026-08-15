import type {
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb
} from '../../db';
import {
  classifyCharacterIdentities,
  type ActorResolution,
  type CharacterIdentityClassification,
  type CharacterIdentityClassificationRecord,
  type CharacterIdentityMigrationReport
} from './characterIdentity';

export type CharacterIdentityResolutionClassification = Extract<
  CharacterIdentityClassification,
  'tools-only-orphan' | 'sheet-only' | 'ambiguous-collision'
>;

export interface CharacterIdentityResolutionItem {
  key: string;
  recordType: 'character' | 'sheet';
  recordId: string;
  name: string;
  classification: CharacterIdentityResolutionClassification;
  reason: string;
}

export const getCharacterIdentityResolutionKey = (
  recordType: 'character' | 'sheet',
  recordId: string
): string => `${recordType}:${recordId}`;

const isUnresolvedClassification = (
  classification: CharacterIdentityClassification
): classification is CharacterIdentityResolutionClassification =>
  classification === 'tools-only-orphan' ||
  classification === 'sheet-only' ||
  classification === 'ambiguous-collision';

export function buildCharacterIdentityResolutionQueue(params: {
  projectId: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  report?: CharacterIdentityMigrationReport | null;
  keptSeparateKeys?: string[];
}): CharacterIdentityResolutionItem[] {
  const characterById = new Map(params.characters.map((record) => [record.id, record]));
  const sheetById = new Map(params.sheets.map((record) => [record.id, record]));
  const validEntityIds = new Set(params.entities.map((entity) => entity.id));
  const keptSeparateKeys = new Set(params.keptSeparateKeys ?? []);
  const liveRecords = classifyCharacterIdentities({
    projectId: params.projectId,
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.sheets,
    generatedAt: 0
  }).report.records;
  const recordsByKey = new Map<
    string,
    CharacterIdentityClassificationRecord & {
      recordType: 'character' | 'sheet';
      classification: CharacterIdentityResolutionClassification;
    }
  >();

  [...(params.report?.records ?? []), ...liveRecords].forEach((record) => {
    if (record.recordType === 'entity') return;
    if (!isUnresolvedClassification(record.classification)) return;
    recordsByKey.set(
      getCharacterIdentityResolutionKey(record.recordType, record.recordId),
      {
        ...record,
        recordType: record.recordType,
        classification: record.classification
      }
    );
  });

  return Array.from(recordsByKey.entries())
    .flatMap(([key, record]): CharacterIdentityResolutionItem[] => {
      if (keptSeparateKeys.has(key)) return [];
      if (record.recordType === 'character') {
        const character = characterById.get(record.recordId);
        if (!character || (character.entityId && validEntityIds.has(character.entityId))) {
          return [];
        }
      } else {
        const sheet = sheetById.get(record.recordId);
        if (!sheet || (sheet.characterEntityId && validEntityIds.has(sheet.characterEntityId))) {
          return [];
        }
      }
      return [{
        key,
        recordType: record.recordType,
        recordId: record.recordId,
        name: record.name,
        classification: record.classification,
        reason: record.reason
      }];
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
}

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const emitIdentityChanges = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:entity-records-changed'));
  window.dispatchEvent(new CustomEvent('wbd:character-records-changed'));
  window.dispatchEvent(new CustomEvent('wbd:character-sheet-records-changed'));
};

export async function resolveCharacterIdentity(params: {
  projectId: string;
  item: Pick<CharacterIdentityResolutionItem, 'recordType' | 'recordId'>;
  entityId: string;
  entityToCreate?: WorldEntity;
  resolvedAt?: number;
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [
      ENTITY_STORE_NAME,
      CHARACTER_STORE_NAME,
      CHARACTER_SHEET_STORE_NAME,
      ACTOR_RESOLUTION_STORE_NAME
    ],
    'readwrite'
  );
  const entityStore = tx.objectStore(ENTITY_STORE_NAME);
  const characterStore = tx.objectStore(CHARACTER_STORE_NAME);
  const sheetStore = tx.objectStore(CHARACTER_SHEET_STORE_NAME);
  const actorStore = tx.objectStore(ACTOR_RESOLUTION_STORE_NAME);
  const entityRequest = entityStore.get(params.entityId);
  const charactersRequest = characterStore.getAll();
  const sheetsRequest = sheetStore.getAll();

  try {
    const [storedEntity, allCharacters, allSheets] = await Promise.all([
      requestResult<WorldEntity | undefined>(entityRequest),
      requestResult<Character[]>(charactersRequest),
      requestResult<CharacterSheet[]>(sheetsRequest)
    ]);
    const entity = params.entityToCreate ?? storedEntity;
    if (!entity || entity.id !== params.entityId || entity.projectId !== params.projectId) {
      throw new Error('Choose a World Bible character from this project.');
    }

    const characters = allCharacters.filter((record) => record.projectId === params.projectId);
    const sheets = allSheets.filter((record) => record.projectId === params.projectId);
    const character =
      params.item.recordType === 'character'
        ? characters.find((record) => record.id === params.item.recordId)
        : undefined;
    const sourceSheet =
      params.item.recordType === 'sheet'
        ? sheets.find((record) => record.id === params.item.recordId)
        : undefined;
    if (params.item.recordType === 'character' && !character) {
      throw new Error('The legacy character capability record no longer exists.');
    }
    if (params.item.recordType === 'sheet' && !sourceSheet) {
      throw new Error('The legacy character sheet no longer exists.');
    }

    const familyCharacter = character ?? (
      sourceSheet?.characterId
        ? characters.find((record) => record.id === sourceSheet.characterId)
        : undefined
    );
    const familySheets = sheets.filter(
      (sheet) =>
        sheet.id === sourceSheet?.id ||
        (familyCharacter !== undefined && sheet.characterId === familyCharacter.id)
    );
    if (familySheets.length > 1) {
      throw new Error(
        `"${entity.name}" has multiple legacy sheets in this record family. Keep one sheet before linking to canon.`
      );
    }
    const existingEntitySheet = sheets.find(
      (sheet) =>
        sheet.characterEntityId === params.entityId &&
        !familySheets.some((familySheet) => familySheet.id === sheet.id)
    );
    if (existingEntitySheet && familySheets.length > 0) {
      throw new Error(
        `"${entity.name}" already has a different character sheet. Resolve that collision before linking.`
      );
    }

    if (params.entityToCreate) entityStore.put(params.entityToCreate);
    const resolvedAt = params.resolvedAt ?? Date.now();
    if (familyCharacter) {
      characterStore.put({...familyCharacter, entityId: params.entityId, updatedAt: resolvedAt});
      const actorResolution: ActorResolution = {
        id: `${params.projectId}:character:${familyCharacter.id}`,
        projectId: params.projectId,
        legacyActorId: familyCharacter.id,
        legacyActorType: 'character',
        entityId: params.entityId,
        createdAt: resolvedAt
      };
      actorStore.put(actorResolution);
    }
    familySheets.forEach((sheet) => {
      sheetStore.put({...sheet, characterEntityId: params.entityId, updatedAt: resolvedAt});
      const actorResolution: ActorResolution = {
        id: `${params.projectId}:sheet:${sheet.id}`,
        projectId: params.projectId,
        legacyActorId: sheet.id,
        legacyActorType: 'sheet',
        entityId: params.entityId,
        createdAt: resolvedAt
      };
      actorStore.put(actorResolution);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    emitIdentityChanges();
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted because a request failed.
    }
    throw error;
  }
}
