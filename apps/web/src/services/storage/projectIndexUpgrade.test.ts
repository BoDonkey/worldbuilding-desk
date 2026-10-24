import 'fake-indexeddb/auto';
import {beforeAll, describe, expect, it} from 'vitest';
import {
  CANONICAL_FACT_STORE_NAME,
  CATEGORY_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  DB_NAME,
  DB_VERSION,
  ENTITY_STORE_NAME,
  openDb,
  PROJECT_ID_INDEX,
  PROJECT_INDEXED_STORE_NAMES,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_REVIEW_RUN_STORE_NAME,
  PROJECT_STORE_NAME,
  SETTINGS_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WORLD_CANVAS_STORE_NAME,
  WRITING_STORE_NAME
} from './db';
import {requestToPromise, transactionToPromise} from './idbRequest';
import {getAllByProject} from './projectIndex';
import {listProjectMigrationBackups} from './projectSchemaMigrations';
import {
  getAliasesByProject,
  getCanonicalFactsByProject,
  getCategoriesByProject,
  getDocumentsByProject,
  getEntitiesByProject,
  getProjectSettings,
  getStateMutationEventsByProject
} from '.';

/*
 * 3.23b: a populated version-28 database (no projectId indexes except the two
 * unique ones) upgrades to 29 in place, keeps every record, and the
 * project-scoped getters read through the new index with the same results.
 */

const V28 = 28;
const ALL_STORES = [PROJECT_STORE_NAME, ...PROJECT_INDEXED_STORE_NAMES];

const SEED: Record<string, Array<Record<string, unknown>>> = {
  [PROJECT_STORE_NAME]: [
    {id: 'p-a', name: 'Alpha', createdAt: 1, updatedAt: 1},
    {id: 'p-b', name: 'Beta', createdAt: 1, updatedAt: 1}
  ],
  [ENTITY_STORE_NAME]: [
    {id: 'e-2', projectId: 'p-a', categoryId: 'c-a', name: 'Sera', fields: {}, links: [], createdAt: 1, updatedAt: 1},
    {id: 'e-1', projectId: 'p-a', categoryId: 'c-a', name: 'Brannic', fields: {}, links: [], createdAt: 1, updatedAt: 1},
    {id: 'e-3', projectId: 'p-b', categoryId: 'c-b', name: 'Dess', fields: {}, links: [], createdAt: 1, updatedAt: 1},
    // Legacy record without a project id: never returned for a project.
    {id: 'e-0', categoryId: 'c-a', name: 'Orphan', fields: {}, links: [], createdAt: 1, updatedAt: 1}
  ],
  [CATEGORY_STORE_NAME]: [
    {id: 'c-a', projectId: 'p-a', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1},
    {id: 'c-b', projectId: 'p-b', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}
  ],
  [WRITING_STORE_NAME]: [
    {id: 'w-1', projectId: 'p-a', title: 'Scene 2', content: '', order: 2, createdAt: 1, updatedAt: 1},
    {id: 'w-2', projectId: 'p-a', title: 'Scene 1', content: '', order: 1, createdAt: 1, updatedAt: 1},
    {id: 'w-3', projectId: 'p-b', title: 'Other', content: '', order: 1, createdAt: 1, updatedAt: 1}
  ],
  [CANONICAL_FACT_STORE_NAME]: [
    {id: 'f-1', projectId: 'p-a', acceptedAt: 5, subject: 'Sera'},
    {id: 'f-2', projectId: 'p-a', acceptedAt: 9, subject: 'Brannic'},
    {id: 'f-3', projectId: 'p-b', acceptedAt: 7, subject: 'Dess'}
  ],
  [CONSISTENCY_ALIAS_STORE_NAME]: [
    {id: 'a-1', projectId: 'p-a', alias: 'Ser', targetId: 'e-2', targetType: 'entity', createdAt: 1, updatedAt: 1},
    {id: 'a-2', projectId: 'p-b', alias: 'D', targetId: 'e-3', targetType: 'entity', createdAt: 1, updatedAt: 1}
  ],
  [SETTINGS_STORE_NAME]: [
    {id: 's-a', projectId: 'p-a', characterStyles: [], activeSkills: []},
    {id: 's-b', projectId: 'p-b', characterStyles: [], activeSkills: []}
  ],
  [STATE_MUTATION_EVENT_STORE_NAME]: [
    {id: 'm-1', projectId: 'p-a', sceneId: 'w-2', sceneOrder: 1, status: 'applied', commands: [], createdAt: 1},
    {id: 'm-2', projectId: 'p-b', sceneId: 'w-3', sceneOrder: 1, status: 'applied', commands: [], createdAt: 1}
  ],
  [PROJECT_MIGRATION_BACKUP_STORE_NAME]: [
    {id: 'b-1', projectId: 'p-a', createdAt: 3},
    {id: 'b-2', projectId: 'p-a', createdAt: 8},
    {id: 'b-3', projectId: 'p-b', createdAt: 4}
  ],
  [WORLD_CANVAS_STORE_NAME]: [{id: 'canvas-a', projectId: 'p-a'}],
  [PROJECT_REVIEW_RUN_STORE_NAME]: [{id: 'run-a', projectId: 'p-a', reviewedAt: 1}]
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** The version-28 layout: every store, and only the two unique projectId indexes. */
async function createPopulatedV28Database(): Promise<void> {
  const request = indexedDB.open(DB_NAME, V28);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const storeName of ALL_STORES) {
      const store = db.createObjectStore(storeName, {keyPath: 'id'});
      if (storeName === WORLD_CANVAS_STORE_NAME || storeName === PROJECT_REVIEW_RUN_STORE_NAME) {
        store.createIndex('projectId', 'projectId', {unique: true});
      }
    }
  };
  const db = await requestToPromise(request);
  const tx = db.transaction(Object.keys(SEED), 'readwrite');
  for (const [storeName, records] of Object.entries(SEED)) {
    records.forEach((record) => tx.objectStore(storeName).put(record));
  }
  await transactionToPromise(tx);
  expect(db.version).toBe(V28);
  expect(
    db.transaction(ENTITY_STORE_NAME).objectStore(ENTITY_STORE_NAME).indexNames.contains(PROJECT_ID_INDEX)
  ).toBe(false);
  db.close();
}

const ids = (records: Array<{id: string}>) => records.map((record) => record.id);

describe('DB_VERSION 29 projectId indexes', () => {
  let db: IDBDatabase;

  beforeAll(async () => {
    await deleteDatabase();
    await createPopulatedV28Database();
    db = await openDb();
  });

  it('upgrades a populated v28 database in place and indexes every project store', () => {
    expect(DB_VERSION).toBe(29);
    expect(db.version).toBe(29);
    const tx = db.transaction([...PROJECT_INDEXED_STORE_NAMES], 'readonly');
    for (const storeName of PROJECT_INDEXED_STORE_NAMES) {
      const store = tx.objectStore(storeName);
      expect(store.indexNames.contains(PROJECT_ID_INDEX), storeName).toBe(true);
      const unique = storeName === WORLD_CANVAS_STORE_NAME || storeName === PROJECT_REVIEW_RUN_STORE_NAME;
      expect(store.index(PROJECT_ID_INDEX).unique, storeName).toBe(unique);
    }
  });

  it('keeps every record, including ones without a project id', async () => {
    const tx = db.transaction(Object.keys(SEED), 'readonly');
    for (const [storeName, records] of Object.entries(SEED)) {
      const stored = await requestToPromise(tx.objectStore(storeName).getAll());
      expect(stored, storeName).toEqual([...records].sort((a, b) => String(a.id).localeCompare(String(b.id))));
    }
  });

  it('reads one project through the index with the same order and contents as before', async () => {
    expect(ids(await getEntitiesByProject('p-a'))).toEqual(['e-1', 'e-2']);
    expect(ids(await getEntitiesByProject('p-b'))).toEqual(['e-3']);
    expect(ids(await getCategoriesByProject('p-b'))).toEqual(['c-b']);
    expect(ids(await getDocumentsByProject('p-a'))).toEqual(['w-2', 'w-1']);
    expect(ids(await getCanonicalFactsByProject('p-a'))).toEqual(['f-2', 'f-1']);
    expect((await getAliasesByProject('p-a')).map((alias) => alias.alias)).toEqual(['Ser']);
    expect((await getProjectSettings('p-b'))?.id).toBe('s-b');
    expect(await getProjectSettings('p-missing')).toBeNull();
    expect(ids(await getStateMutationEventsByProject('p-b'))).toEqual(['m-2']);
    expect(ids(await listProjectMigrationBackups(db, 'p-a'))).toEqual(['b-2', 'b-1']);
  });

  it('reads nothing for a missing project id instead of every record', async () => {
    const store = db.transaction(ENTITY_STORE_NAME).objectStore(ENTITY_STORE_NAME);
    expect(await getAllByProject(store, undefined as unknown as string)).toEqual([]);
    expect(await getEntitiesByProject('')).toEqual([]);
  });
});
