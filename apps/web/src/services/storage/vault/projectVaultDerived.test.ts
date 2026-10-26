// @vitest-environment jsdom
// Repositories announce writes on `window`.
import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it} from 'vitest';
import {getRAGService} from '../../rag/getRAGService';
import {getShodhService} from '../../shodh/getShodhService';
import {appendSystemHistoryEntry, getSystemHistoryEntries} from '../../system/systemHistoryService';
import {loadAssistantConversation} from '../../../hooks/useAssistantConversation';
import {useAppStore} from '../../../store/appStore';
import {DB_NAME, openRawDb} from '../db';
import {requestToPromise} from '../idbRequest';
import {saveProject} from '../repositories/projectStorage';
import {saveWritingDocument} from '../repositories/writingStorage';
import {upsertZoneAffinityProfile} from '../repositories/compendiumWorldStorage';
import {openRawRulesetDb, RULESET_STORE_NAME} from '../repositories/rulesetStorage';
import {disableProjectVault, enableProjectVault, lockProjectVault, unlockProjectVault} from './projectVault';
import {resetVaultRegistryForTests} from './vaultRegistry';

/* Slice 5.15b: what a protected project keeps outside its own records. */

const FAST = {iterations: 100_000};
const PASSPHRASE = 'tide-and-salt-door';
const PLANTED = 'glass heron sings at the salt door';

async function seed() {
  const projectId = crypto.randomUUID();
  await saveProject({id: projectId, name: 'Heron', createdAt: 1, updatedAt: 1});
  await saveWritingDocument({id: crypto.randomUUID(), projectId, title: 'One', content: `<p>${PLANTED}</p>`, createdAt: 1, updatedAt: 1});
  await upsertZoneAffinityProfile({projectId, biomeKey: 'glass-heron-marsh', name: 'Glass Heron Marsh'});
  const rag = await getRAGService(projectId);
  await rag.indexDocument('scene-1', 'One', PLANTED, 'scene');
  const memory = await getShodhService(projectId);
  await memory.captureAutoMemory({projectId, documentId: 'scene-1', title: 'One', content: PLANTED});
  appendSystemHistoryEntry(projectId, {category: 'system', message: `Mira found the ${PLANTED}`});
  localStorage.setItem(`workspaceReviewPrefs:${projectId}`, JSON.stringify({dismissed: [PLANTED]}));
  localStorage.setItem(`loreSynopsis:${projectId}:mira:1`, PLANTED);
  localStorage.setItem(
    `wbd:first-mechanics:${projectId}:mira`,
    JSON.stringify({isAdding: true, kind: 'resource', name: PLANTED, defaultValue: '10'})
  );
  sessionStorage.setItem(`wbd:assistant-conversation:${projectId}`, JSON.stringify([{role: 'user', content: PLANTED}]));
  sessionStorage.setItem(`wbd:assistant-conversation:ask:${projectId}`, JSON.stringify([{role: 'user', content: PLANTED}]));
  return projectId;
}

const databaseNames = async () => (await indexedDB.databases()).map((database) => database.name ?? '');

/** Everything app-owned that persists: both databases, every derived database, and browser storage. */
async function persistedText(): Promise<string> {
  const parts: string[] = [];
  for (const name of await databaseNames()) {
    if (name === DB_NAME || name === 'worldbuilding-desk') continue;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const store of Array.from(db.objectStoreNames)) {
      parts.push(JSON.stringify(await requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll())));
    }
    db.close();
  }
  const main = await openRawDb();
  for (const store of Array.from(main.objectStoreNames)) {
    parts.push(JSON.stringify(await requestToPromise(main.transaction(store, 'readonly').objectStore(store).getAll())));
  }
  main.close();
  const rulesets = await openRawRulesetDb();
  parts.push(JSON.stringify(await requestToPromise(rulesets.transaction(RULESET_STORE_NAME, 'readonly').objectStore(RULESET_STORE_NAME).getAll())));
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)!;
      parts.push(key, storage.getItem(key) ?? '');
    }
  }
  return parts.join('\n');
}

beforeEach(() => {
  resetVaultRegistryForTests();
});

describe('protected project derived data (5.15b)', () => {
  it('leaves no planted phrase anywhere the app persists, and keeps working from memory', async () => {
    const projectId = await seed();
    expect(await databaseNames()).toContain(`rag-${projectId}`);
    expect(await persistedText()).toContain('glass heron');

    await enableProjectVault(projectId, PASSPHRASE, FAST);

    const names = await databaseNames();
    expect(names).not.toContain(`rag-${projectId}`);
    expect(names).not.toContain(`shodh-memory-${projectId}`);
    const persisted = await persistedText();
    expect(persisted).not.toContain('glass heron');
    expect(persisted).not.toContain('glass-heron');
    expect(persisted).not.toContain('Glass Heron');

    // Still usable while unlocked, from memory only.
    expect(getSystemHistoryEntries(projectId)[0].message).toContain(PLANTED);
    expect(loadAssistantConversation(projectId)[0].content).toBe(PLANTED);
    const rag = await getRAGService(projectId);
    await rag.indexDocument('scene-2', 'Two', `the ${PLANTED} again`, 'scene');
    expect((await rag.search('heron')).length).toBeGreaterThan(0);
    appendSystemHistoryEntry(projectId, {category: 'system', message: 'another heron line'});
    expect(await databaseNames()).not.toContain(`rag-${projectId}`);
    expect(await persistedText()).not.toContain('heron');
  });

  it('drops in-memory text when the project locks', async () => {
    const projectId = await seed();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    const rag = await getRAGService(projectId);
    await rag.indexDocument('scene-2', 'Two', PLANTED, 'scene');

    lockProjectVault(projectId);
    expect(getSystemHistoryEntries(projectId)).toEqual([]);
    expect(loadAssistantConversation(projectId)).toEqual([]);
    appendSystemHistoryEntry(projectId, {category: 'system', message: 'written while locked'});
    expect(getSystemHistoryEntries(projectId)).toEqual([]);
    await expect(rag.search('heron')).rejects.toThrow(/locked/);

    await unlockProjectVault(projectId, PASSPHRASE);
    expect(getSystemHistoryEntries(projectId)).toEqual([]);
  });

  it('puts browser-storage text back when protection is removed', async () => {
    const projectId = await seed();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    appendSystemHistoryEntry(projectId, {category: 'system', message: 'kept through removal'});

    await disableProjectVault(projectId, PASSPHRASE);
    expect(localStorage.getItem(`systemHistory:${projectId}`)).toContain('kept through removal');
    expect(sessionStorage.getItem(`wbd:assistant-conversation:${projectId}`)).toContain(PLANTED);
  });

  it('never persists a protected open project, and closes it when it locks', async () => {
    const projectId = await seed();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    await useAppStore.getState().setActiveProject({id: projectId, name: 'Heron', createdAt: 1, updatedAt: 1});
    expect(useAppStore.getState().activeProject?.id).toBe(projectId);
    expect(localStorage.getItem('wbd-app-shell')).not.toContain('Heron');
    expect(JSON.parse(localStorage.getItem('wbd-app-shell')!).state.activeProject).toBeNull();

    lockProjectVault(projectId);
    await expect.poll(() => useAppStore.getState().activeProject).toBeNull();
  });

  it('locks the protected project when another project opens', async () => {
    const projectId = await seed();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    await useAppStore.getState().setActiveProject({id: projectId, name: 'Heron', createdAt: 1, updatedAt: 1});
    const otherId = crypto.randomUUID();
    await saveProject({id: otherId, name: 'Other', createdAt: 1, updatedAt: 1});
    await useAppStore.getState().setActiveProject({id: otherId, name: 'Other', createdAt: 1, updatedAt: 1});

    const {getProjectVaultState} = await import('./projectVault');
    expect(await getProjectVaultState(projectId)).toBe('locked');
  });
});
