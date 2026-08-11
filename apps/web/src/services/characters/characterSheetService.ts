import type {CharacterSheet, WorldEntity} from '../../entityTypes';
import { openDb } from '../../db';

const STORE_NAME = 'character_sheets';

export function deriveCharacterSheetNames(
  sheets: CharacterSheet[],
  entities: WorldEntity[]
): CharacterSheet[] {
  const entityNameById = new Map(entities.map((entity) => [entity.id, entity.name]));
  return sheets.map((sheet) => ({
    ...sheet,
    name:
      (sheet.characterEntityId
        ? entityNameById.get(sheet.characterEntityId)
        : undefined) ?? sheet.name
  }));
}

export function findCharacterSheetCollisions(
  sheets: CharacterSheet[]
): Array<{characterEntityId: string; sheets: CharacterSheet[]}> {
  const byEntityId = new Map<string, CharacterSheet[]>();
  sheets.forEach((sheet) => {
    if (!sheet.characterEntityId) return;
    const current = byEntityId.get(sheet.characterEntityId) ?? [];
    current.push(sheet);
    byEntityId.set(sheet.characterEntityId, current);
  });
  return Array.from(byEntityId, ([characterEntityId, records]) => ({
    characterEntityId,
    sheets: records
  })).filter((entry) => entry.sheets.length > 1);
}

export async function getCharacterSheetsByProject(projectId: string): Promise<CharacterSheet[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as CharacterSheet[];
      resolve(all.filter(c => c.projectId === projectId));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getCharacterSheet(id: string): Promise<CharacterSheet | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as CharacterSheet | undefined);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export function validateCharacterSheetWrite(
  sheet: CharacterSheet,
  existing?: CharacterSheet,
  projectSheets: CharacterSheet[] = []
): void {
  if (!sheet.characterEntityId && !existing) {
    throw new Error(
      'New character sheets require a canonical World Bible character link.'
    );
  }
  if (existing?.characterEntityId && !sheet.characterEntityId) {
    throw new Error('A canonical sheet link cannot be removed.');
  }
  const collision = projectSheets.find(
    (candidate) =>
      candidate.projectId === sheet.projectId &&
      candidate.id !== sheet.id &&
      candidate.characterEntityId === sheet.characterEntityId
  );
  if (sheet.characterEntityId && collision) {
    throw new Error(
      `This World Bible character already has a sheet ("${collision.name}"). Open that sheet instead.`
    );
  }
}

export async function saveCharacterSheet(sheet: CharacterSheet): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existingRequest = store.get(sheet.id);
    const allRequest = store.getAll();

    const writeWhenReady = () => {
      if (existingRequest.readyState !== 'done' || allRequest.readyState !== 'done') return;
      const existing = existingRequest.result as CharacterSheet | undefined;
      try {
        validateCharacterSheetWrite(
          sheet,
          existing,
          allRequest.result as CharacterSheet[]
        );
      } catch (error) {
        reject(error);
        tx.abort();
        return;
      }
      const request = store.put(sheet);
      request.onerror = () => reject(request.error);
    };
    existingRequest.onsuccess = writeWhenReady;
    allRequest.onsuccess = writeWhenReady;
    existingRequest.onerror = () => reject(existingRequest.error);
    allRequest.onerror = () => reject(allRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCharacterSheet(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
