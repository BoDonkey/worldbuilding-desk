import type {Character, CharacterSheet} from '../entityTypes';
import {
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  openDb
} from '../db';
import {getCharactersByProject} from '../characterStorage';
import {getCharacterSheetsByProject} from './characterSheetService';
import {
  downloadJsonFile,
  readJsonFile,
  sanitizeFileNamePart
} from './jsonTransfer';

interface CharacterTransferPayload {
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

function isCharacterTransferPayload(
  value: unknown
): value is CharacterTransferPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Partial<CharacterTransferPayload>;
  return (
    payload.schemaVersion === 1 &&
    payload.kind === 'characters' &&
    (payload.packageType === 'roster' || payload.packageType === 'full') &&
    Boolean(payload.data) &&
    Array.isArray(payload.data?.characters) &&
    Array.isArray(payload.data?.characterSheets)
  );
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function exportCharactersJson(params: {
  projectId: string;
  projectName: string;
  includeSheets?: boolean;
}): Promise<void> {
  const includeSheets = params.includeSheets ?? true;
  const characters = await getCharactersByProject(params.projectId);
  const characterSheets = includeSheets
    ? await getCharacterSheetsByProject(params.projectId)
    : [];

  const payload: CharacterTransferPayload = {
    schemaVersion: 1,
    kind: 'characters',
    packageType: includeSheets ? 'full' : 'roster',
    exportedAt: Date.now(),
    sourceProjectName: params.projectName,
    data: {
      characters,
      characterSheets
    }
  };

  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(
    params.projectName
  )}-characters-${payload.packageType}-${stamp}.json`;
  downloadJsonFile(fileName, payload);
}

export async function importCharactersJson(params: {
  file: File;
  projectId: string;
  includeSheets?: boolean;
}): Promise<{charactersImported: number; sheetsImported: number}> {
  const includeSheets = params.includeSheets ?? true;
  const json = await readJsonFile(params.file);
  if (!isCharacterTransferPayload(json)) {
    throw new Error('Invalid character export file.');
  }

  const characterIdMap = new Map<string, string>();
  const importedCharacters: Character[] = json.data.characters.map((character) => {
    const nextId = crypto.randomUUID();
    characterIdMap.set(character.id, nextId);
    return {
      ...character,
      id: nextId,
      projectId: params.projectId
    };
  });

  const importedSheets: CharacterSheet[] = includeSheets
    ? json.data.characterSheets.map((sheet) => ({
        ...sheet,
        id: crypto.randomUUID(),
        projectId: params.projectId,
        characterId: sheet.characterId
          ? characterIdMap.get(sheet.characterId)
          : undefined
      }))
    : [];

  const db = await openDb();
  const tx = db.transaction(
    [CHARACTER_STORE_NAME, CHARACTER_SHEET_STORE_NAME],
    'readwrite'
  );
  const charStore = tx.objectStore(CHARACTER_STORE_NAME);
  const sheetStore = tx.objectStore(CHARACTER_SHEET_STORE_NAME);

  await Promise.all([
    ...importedCharacters.map((character) => requestToPromise(charStore.put(character))),
    ...importedSheets.map((sheet) => requestToPromise(sheetStore.put(sheet)))
  ]);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return {
    charactersImported: importedCharacters.length,
    sheetsImported: importedSheets.length
  };
}
