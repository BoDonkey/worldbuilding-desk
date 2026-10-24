import type {PreparedCharacterTransferImport} from '../../characters/characterTransferService';
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
} from '../db';
import {requestToPromise} from '../idbRequest';

/** Writes a prepared character package import in one transaction. */
export async function saveCharacterTransferImport(
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
