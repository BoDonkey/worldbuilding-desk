import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  ENTITY_STORE_NAME, PROJECT_STORE_NAME, PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_SCOPED_STORE_NAMES
} from '../db';
import {deleteProject} from './projectStorage';
import {runProjectWriteTransaction} from '../projectWriteTransaction';
import {getRulesetByProjectId, replaceRulesetSnapshot} from './rulesetStorage';
import {getRAGService, closeRAGServices} from '../../rag/getRAGService';
import {getShodhService, closeShodhServices} from '../../shodh/getShodhService';
import {RAGService} from '../../rag/RAGService';
import {ShodhMemoryService} from '../../shodh/ShodhMemoryService';
import type {StoredRuleset} from '../../../entityTypes';

const projectIds: string[] = [];
const newId = () => {
  const id = `delete-test-${crypto.randomUUID()}`;
  projectIds.push(id);
  return id;
};

const records = (projectId: string) => [PROJECT_STORE_NAME, ...PROJECT_SCOPED_STORE_NAMES,
  PROJECT_MIGRATION_BACKUP_STORE_NAME].map((store) => ({
  store, record: {id: store === PROJECT_STORE_NAME ? projectId : `${projectId}:${store}`, projectId}
}));

async function seedProject(projectId: string) {
  const seed = records(projectId);
  await runProjectWriteTransaction(seed.map(({store}) => store), async (tx) => {
    for (const {store, record} of seed) await tx.put(store, record);
  });
}

async function expectProjectRecords(projectId: string, present: boolean) {
  const seed = records(projectId);
  await runProjectWriteTransaction(seed.map(({store}) => store), async (tx) => {
    for (const {store, record} of seed) {
      const stored = await tx.get(store, record.id);
      expect(stored, store).toEqual(present ? record : undefined);
    }
  });
}

async function openMemoryDb(projectId: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`shodh-memory-${projectId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('memories', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seedRuleset(projectId: string) {
  const ruleset = {
    id: `ruleset:${projectId}`, projectId, name: 'Preserve this ruleset', rules: [],
    statDefinitions: [], resourceDefinitions: []
  } as unknown as StoredRuleset;
  await replaceRulesetSnapshot(projectId, ruleset);
  return ruleset;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(projectIds.splice(0).flatMap((id) => [closeRAGServices(id), closeShodhServices(id)]));
});

describe('project deletion', () => {
  it('deletes every project-owned main-store record and ruleset without changing another project', async () => {
    const id = newId();
    const other = newId();
    await seedProject(id);
    await seedProject(other);
    await seedRuleset(id);
    const otherRuleset = await seedRuleset(other);

    await deleteProject(id);

    await expectProjectRecords(id, false);
    await expectProjectRecords(other, true);
    expect(await getRulesetByProjectId(id)).toBeNull();
    expect(await getRulesetByProjectId(other)).toEqual(otherRuleset);
    await expect(deleteProject(id)).resolves.toBeUndefined();
  });

  it('rolls back all primary records and restores the ruleset when a child deletion aborts', async () => {
    const id = newId();
    await seedProject(id);
    const ruleset = await seedRuleset(id);
    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) {
      const request = originalDelete.call(this, key);
      if (this.name === ENTITY_STORE_NAME && key === `${id}:${ENTITY_STORE_NAME}`) {
        this.transaction.abort();
      }
      return request;
    });

    await expect(deleteProject(id)).rejects.toBeDefined();

    await expectProjectRecords(id, true);
    expect(await getRulesetByProjectId(id)).toEqual(ruleset);
    vi.restoreAllMocks();
    await deleteProject(id);
    await expectProjectRecords(id, false);
  });

  it('closes and evicts live caches, including inherited views, before deleting derived text', async () => {
    const id = newId();
    const child = newId();
    await seedProject(id);
    const rag = await getRAGService(id);
    const memory = await getShodhService(id);
    const childRag = await getRAGService({projectId: child, inheritFromParent: true, parentProjectId: id});
    const childMemory = await getShodhService({projectId: child, inheritFromParent: true, parentProjectId: id});
    await rag.indexDocument('d', 'Secret', 'Author text', 'scene');
    await memory.addMemory({projectId: id, documentId: 'd', title: 'Secret', summary: 'Author text'});
    await childMemory.addMemory({projectId: child, documentId: 'child-d', title: 'Child', summary: 'Keep child text'});
    // A direct service outside the factory must also honor the versionchange event.
    const directRag = new RAGService();
    await directRag.init(id);
    const directMemory = new ShodhMemoryService();
    await directMemory.init(id);

    await deleteProject(id);

    const names = (await indexedDB.databases()).map(({name}) => name);
    expect(names).not.toContain(`rag-${id}`);
    expect(names).not.toContain(`shodh-memory-${id}`);
    await expect(rag.getDiagnostics()).rejects.toThrow('not been initialized');
    await expect(memory.listMemories()).rejects.toThrow('not been initialized');
    await expect(directRag.getDiagnostics()).rejects.toThrow('not been initialized');
    await expect(directMemory.listMemories()).rejects.toThrow('not been initialized');
    expect(await getRAGService({projectId: child, inheritFromParent: true, parentProjectId: id})).not.toBe(childRag);
    const reopenedChildMemory = await getShodhService({projectId: child, inheritFromParent: true, parentProjectId: id});
    expect(reopenedChildMemory).not.toBe(childMemory);
    expect(await reopenedChildMemory.listMemories()).toEqual([
      expect.objectContaining({projectId: child, summary: 'Keep child text'})
    ]);
  });

  it('rejects blocked cleanup with primary data intact, then permits a retry', async () => {
    const id = newId();
    await seedProject(id);
    const ruleset = await seedRuleset(id);
    const externalConnection = await openMemoryDb(id);
    try {
      await expect(deleteProject(id)).rejects.toThrow('Close other windows');
      await expectProjectRecords(id, true);
      expect(await getRulesetByProjectId(id)).toEqual(ruleset);
    } finally {
      externalConnection.close();
    }
    await deleteProject(id);
    await expectProjectRecords(id, false);
    expect(await getRulesetByProjectId(id)).toBeNull();
  });

  it('surfaces database deletion errors before modifying primary data', async () => {
    const id = newId();
    await seedProject(id);
    const ruleset = await seedRuleset(id);
    const original = indexedDB.deleteDatabase.bind(indexedDB);
    vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation((name) => {
      if (name !== `shodh-memory-${id}`) return original(name);
      const request = {error: new DOMException('Storage unavailable', 'UnknownError')} as IDBOpenDBRequest;
      queueMicrotask(() => request.onerror?.(new Event('error')));
      return request;
    });
    await expect(deleteProject(id)).rejects.toThrow('Storage unavailable');
    await expectProjectRecords(id, true);
    expect(await getRulesetByProjectId(id)).toEqual(ruleset);
  });
});
