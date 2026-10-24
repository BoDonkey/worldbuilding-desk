import type {Character, CharacterSheet, WorldEntity} from '../../../entityTypes';
import type {ActorResolution} from '../../characters/characterIdentity';
import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  ENTITY_STORE_NAME,
  openDb
} from '../db';
import {requestToPromise} from '../idbRequest';

/** Records read at the start of a character identity resolution (every project). */
export interface CharacterIdentityResolutionSnapshot {
  storedEntity: WorldEntity | undefined;
  allCharacters: Character[];
  allSheets: CharacterSheet[];
}

export type CharacterIdentityResolutionWrite =
  | {kind: 'entity'; record: WorldEntity}
  | {kind: 'character'; record: Character}
  | {kind: 'sheet'; record: CharacterSheet}
  | {kind: 'actorResolution'; record: ActorResolution};

const STORE_FOR_KIND: Record<CharacterIdentityResolutionWrite['kind'], string> = {
  entity: ENTITY_STORE_NAME,
  character: CHARACTER_STORE_NAME,
  sheet: CHARACTER_SHEET_STORE_NAME,
  actorResolution: ACTOR_RESOLUTION_STORE_NAME
};

/**
 * Reads the entity and every character and sheet, asks `plan` for the writes,
 * and applies them in the same transaction, in order. If `plan` throws, the
 * transaction is aborted and the error is rethrown.
 */
export async function applyCharacterIdentityResolution(
  entityId: string,
  plan: (snapshot: CharacterIdentityResolutionSnapshot) => CharacterIdentityResolutionWrite[]
): Promise<void> {
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
  const entityRequest = tx.objectStore(ENTITY_STORE_NAME).get(entityId);
  const charactersRequest = tx.objectStore(CHARACTER_STORE_NAME).getAll();
  const sheetsRequest = tx.objectStore(CHARACTER_SHEET_STORE_NAME).getAll();

  try {
    const [storedEntity, allCharacters, allSheets] = await Promise.all([
      requestToPromise<WorldEntity | undefined>(entityRequest),
      requestToPromise<Character[]>(charactersRequest),
      requestToPromise<CharacterSheet[]>(sheetsRequest)
    ]);
    const writes = plan({storedEntity, allCharacters, allSheets});
    writes.forEach((write) => {
      tx.objectStore(STORE_FOR_KIND[write.kind]).put(write.record);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted because a request failed.
    }
    throw error;
  }
}
