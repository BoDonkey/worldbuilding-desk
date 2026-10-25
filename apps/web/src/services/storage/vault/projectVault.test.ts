// @vitest-environment jsdom
// Repositories announce writes on `window`.
import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  CANONICAL_FACT_STORE_NAME,
  CATEGORY_STORE_NAME,
  CHARACTER_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  DB_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  MECHANICS_DRAFT_STORE_NAME,
  openRawDb,
  PROJECT_STORE_NAME,
  SCRATCHPAD_STORE_NAME,
  SETTINGS_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WORLD_CANVAS_STORE_NAME,
  WRITING_STORE_NAME
} from '../db';
import {requestToPromise, transactionToPromise} from '../idbRequest';
import {buildProjectSnapshot} from '../projectSnapshotService';
import {deleteProject, getAllProjects, getProjectById, saveProject} from '../repositories/projectStorage';
import {getRulesetByProjectId, openRawRulesetDb, putRulesetRecord, RULESET_STORE_NAME} from '../repositories/rulesetStorage';
import {getDocumentsByProject, saveWritingDocument} from '../repositories/writingStorage';
import {
  changeProjectVaultPassphrase,
  disableProjectVault,
  enableProjectVault,
  getProjectVaultState,
  lockProjectVault,
  unlockProjectVault
} from './projectVault';
import {VaultIntegrityError, VaultPassphraseError} from './vaultCrypto';
import {resetVaultRegistryForTests, VaultLockedError} from './vaultRegistry';

/* Slice 5.15a: project vaults through the real storage seam. */

const FAST = {iterations: 100_000};
const PASSPHRASE = 'tide-and-salt-door';
const PLANTED = 'glass heron sings at the salt door';
const uuid = () => crypto.randomUUID();

/** A project with author text in many stores, the ruleset database included. */
async function seedProject(name = `Heron ${PLANTED}`) {
  const projectId = uuid();
  const ids = {category: uuid(), entity: uuid(), scene: uuid(), lore: uuid(), ruleset: `ruleset:${projectId}`};
  await saveProject({id: projectId, name, description: PLANTED, rulesetId: ids.ruleset, createdAt: 1, updatedAt: 2});
  await putRulesetRecord({
    id: ids.ruleset, projectId, name: `Rules of ${PLANTED}`, version: '1',
    statDefinitions: [], resourceDefinitions: [], rules: [], itemTemplates: [], statusTemplates: [],
    createdAt: 1, updatedAt: 1
  } as never);
  const records: Array<[string, Record<string, unknown>]> = [
    [SETTINGS_STORE_NAME, {id: uuid(), projectId, characterStyles: [], activeSkills: [], featureToggles: {}, consistencyActionCues: [PLANTED], createdAt: 1, updatedAt: 1}],
    [CATEGORY_STORE_NAME, {id: ids.category, projectId, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}],
    [ENTITY_STORE_NAME, {id: ids.entity, projectId, categoryId: ids.category, name: 'Mira', fields: {secret: PLANTED}, links: [], createdAt: 1, updatedAt: 1}],
    [WRITING_STORE_NAME, {id: ids.scene, projectId, title: 'One', content: `<p>${PLANTED}</p>`, order: 1, createdAt: 1, updatedAt: 1}],
    [SCRATCHPAD_STORE_NAME, {id: projectId, projectId, content: PLANTED, createdAt: 1, updatedAt: 1}],
    [CORKBOARD_CHAPTER_CARD_STORE_NAME, {id: uuid(), projectId, title: 'Act I', summary: PLANTED, status: 'planned', order: 1, sceneIds: [ids.scene], plotPoints: [], createdAt: 1, updatedAt: 1}],
    [CHARACTER_STORE_NAME, {id: uuid(), projectId, entityId: ids.entity, name: 'Mira', fields: {}, createdAt: 1, updatedAt: 1}],
    [LORE_DOCUMENT_STORE_NAME, {id: ids.lore, projectId, title: 'Notes', kind: 'note', format: 'markdown', content: PLANTED, source: {type: 'manual'}, status: 'active', createdAt: 1, updatedAt: 1}],
    [CANONICAL_FACT_STORE_NAME, {id: uuid(), projectId, targetType: 'entity', targetId: ids.entity, loreDocumentId: ids.lore, factType: 'role', value: PLANTED, validFromSceneId: ids.scene, acceptedAt: 1, updatedAt: 1}],
    [STATE_MUTATION_EVENT_STORE_NAME, {id: uuid(), projectId, sceneId: ids.scene, sceneOrder: 1, status: 'accepted', note: PLANTED, commands: [], createdAt: 1}],
    [MECHANICS_DRAFT_STORE_NAME, {id: `${projectId}:mechanics-draft:${ids.entity}`, projectId, entityId: ids.entity, kind: 'stat', name: PLANTED, defaultValue: '3', updatedAt: 1}],
    [WORLD_CANVAS_STORE_NAME, {id: projectId, projectId, premise: PLANTED, lenses: [], questions: [], createdAt: 1, updatedAt: 1}]
  ];
  const db = await openRawDb();
  const tx = db.transaction([...new Set(records.map(([store]) => store))], 'readwrite');
  for (const [store, record] of records) tx.objectStore(store).put(record);
  await transactionToPromise(tx);
  db.close();
  return {projectId, ids};
}

/** Every stored record of both databases, as stored (no vault seam). */
async function rawRecords(): Promise<Array<{database: string; store: string; record: Record<string, unknown>}>> {
  const out: Array<{database: string; store: string; record: Record<string, unknown>}> = [];
  const main = await openRawDb();
  for (const store of Array.from(main.objectStoreNames)) {
    const records = await requestToPromise(main.transaction(store, 'readonly').objectStore(store).getAll());
    records.forEach((record) => out.push({database: DB_NAME, store, record}));
  }
  main.close();
  const rulesets = await openRawRulesetDb();
  const records = await requestToPromise(rulesets.transaction(RULESET_STORE_NAME, 'readonly').objectStore(RULESET_STORE_NAME).getAll());
  records.forEach((record) => out.push({database: 'rulesets', store: RULESET_STORE_NAME, record}));
  return out;
}

const ownedBy = (projectId: string) => (entry: {store: string; record: Record<string, unknown>}) =>
  entry.store === PROJECT_STORE_NAME ? entry.record.id === projectId : entry.record.projectId === projectId;

async function rawProjectRecords(projectId: string) {
  return (await rawRecords()).filter(ownedBy(projectId));
}

const snapshotOf = async (projectId: string) => {
  const snapshot: Partial<Awaited<ReturnType<typeof buildProjectSnapshot>>> = await buildProjectSnapshot(projectId);
  delete snapshot.generatedAt;
  return snapshot;
};

/** Writes `change` over one stored record, bypassing the vault seam. */
async function editRaw(store: string, key: string, change: (record: Record<string, unknown>) => Record<string, unknown>) {
  const db = await openRawDb();
  const tx = db.transaction(store, 'readwrite');
  const record = await requestToPromise(tx.objectStore(store).get(key));
  tx.objectStore(store).put(change(record as Record<string, unknown>));
  await transactionToPromise(tx);
  db.close();
}

beforeEach(() => {
  // Each test starts like a fresh app launch: manifests are re-read and every vault is locked.
  resetVaultRegistryForTests();
});

describe('project vaults (5.15a)', () => {
  it('seals every record the project owns, leaves no planted phrase in storage, and reads back unchanged', async () => {
    const {projectId} = await seedProject();
    const other = await seedProject('Unprotected neighbour');
    const before = await snapshotOf(projectId);
    const ownedBefore = (await rawProjectRecords(projectId)).length;

    await enableProjectVault(projectId, PASSPHRASE, FAST);

    const owned = await rawProjectRecords(projectId);
    expect(owned).toHaveLength(ownedBefore);
    for (const {store, record} of owned) {
      const allowed = store === PROJECT_STORE_NAME ? ['id', 'sealed', 'vaultManifest'] : ['id', 'projectId', 'sealed'];
      expect(Object.keys(record).sort(), store).toEqual(allowed.sort());
    }
    const stored = JSON.stringify(owned);
    expect(stored).not.toContain('glass heron');
    expect(stored).not.toContain('Heron');
    expect(stored).not.toContain(PASSPHRASE);
    const project = owned.find((entry) => entry.store === PROJECT_STORE_NAME)!.record;
    expect((project.vaultManifest as {label: string}).label).toBe('Locked project');

    // The unprotected project is untouched, and the seam reads the vault as before.
    expect(JSON.stringify(await rawProjectRecords(other.projectId))).toContain('glass heron');
    expect(await getProjectVaultState(projectId)).toBe('unlocked');
    expect(await snapshotOf(projectId)).toEqual(before);
  });

  it('keeps a locked project sealed: placeholder name, sealed records, refused writes', async () => {
    const {projectId, ids} = await seedProject();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    lockProjectVault(projectId);

    expect(await getProjectVaultState(projectId)).toBe('locked');
    expect(await getProjectById(projectId)).toEqual({id: projectId, name: 'Locked project', createdAt: 0, updatedAt: 0});
    expect((await getAllProjects()).find((project) => project.id === projectId)?.name).toBe('Locked project');
    const [scene] = await getDocumentsByProject(projectId);
    expect(scene.id).toBe(ids.scene);
    expect(JSON.stringify(scene)).not.toContain('glass heron');
    expect((scene as unknown as {content?: string}).content).toBeUndefined();
    expect(JSON.stringify(await getRulesetByProjectId(projectId))).not.toContain('glass heron');

    await expect(
      saveWritingDocument({id: uuid(), projectId, title: 'New', content: '<p>leak</p>', createdAt: 3, updatedAt: 3})
    ).rejects.toBeInstanceOf(VaultLockedError);
    await expect(saveProject({id: projectId, name: 'Locked project', createdAt: 0, updatedAt: 0})).rejects.toBeInstanceOf(
      VaultLockedError
    );
    expect(JSON.stringify(await rawProjectRecords(projectId))).not.toContain('leak');

    await expect(unlockProjectVault(projectId, 'not the passphrase')).rejects.toBeInstanceOf(VaultPassphraseError);
    expect(await getProjectVaultState(projectId)).toBe('locked');
    await unlockProjectVault(projectId, PASSPHRASE);
    expect((await getProjectById(projectId))?.name).toBe(`Heron ${PLANTED}`);
    expect((await getDocumentsByProject(projectId))[0].content).toBe(`<p>${PLANTED}</p>`);
  });

  it('locks every vault on a fresh launch and seals new writes once unlocked', async () => {
    const {projectId} = await seedProject();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    resetVaultRegistryForTests();

    expect(await getProjectVaultState(projectId)).toBe('locked');
    await unlockProjectVault(projectId, PASSPHRASE);
    const sceneId = uuid();
    await saveWritingDocument({id: sceneId, projectId, title: 'Two', content: '<p>a new heron line</p>', createdAt: 3, updatedAt: 3});
    const stored = (await rawProjectRecords(projectId)).find((entry) => entry.record.id === sceneId)!;
    expect(Object.keys(stored.record).sort()).toEqual(['id', 'projectId', 'sealed']);
    expect((await getDocumentsByProject(projectId)).map((doc) => doc.content)).toContain('<p>a new heron line</p>');
  });

  it('refuses a record that was changed, swapped with another record, or moved to another project', async () => {
    const first = await seedProject();
    const second = await seedProject();
    await enableProjectVault(first.projectId, PASSPHRASE, FAST);
    await enableProjectVault(second.projectId, PASSPHRASE, FAST);

    const sealedOf = async (store: string, key: string) =>
      (await rawRecords()).find((entry) => entry.store === store && entry.record.id === key)!.record.sealed;

    // Same passphrase, different projects: each has its own data key.
    const secondScene = await sealedOf(WRITING_STORE_NAME, second.ids.scene);
    await editRaw(WRITING_STORE_NAME, first.ids.scene, (record) => ({...record, sealed: secondScene}));
    await expect(getDocumentsByProject(first.projectId)).rejects.toBeInstanceOf(VaultIntegrityError);

    // Same project, different record.
    const lore = await sealedOf(LORE_DOCUMENT_STORE_NAME, first.ids.lore);
    await editRaw(WRITING_STORE_NAME, first.ids.scene, (record) => ({...record, sealed: lore}));
    await expect(getDocumentsByProject(first.projectId)).rejects.toBeInstanceOf(VaultIntegrityError);

    // Flipped ciphertext.
    await editRaw(ENTITY_STORE_NAME, second.ids.entity, (record) => {
      const sealed = record.sealed as {ct: string};
      const bytes = Uint8Array.from(atob(sealed.ct), (c) => c.charCodeAt(0));
      bytes[0] ^= 1;
      return {...record, sealed: {...sealed, ct: btoa(String.fromCharCode(...bytes))}};
    });
    const {getEntitiesByProject} = await import('../repositories/entityStorage');
    await expect(getEntitiesByProject(second.projectId)).rejects.toBeInstanceOf(VaultIntegrityError);

    // A changed manifest no longer opens.
    await editRaw(PROJECT_STORE_NAME, second.projectId, (record) => {
      const manifest = record.vaultManifest as {kdf: {iterations: number}};
      return {...record, vaultManifest: {...manifest, kdf: {...manifest.kdf, iterations: 100_001}}};
    });
    resetVaultRegistryForTests();
    await expect(unlockProjectVault(second.projectId, PASSPHRASE)).rejects.toBeInstanceOf(VaultPassphraseError);
  });

  it('changes the passphrase by re-wrapping the key, without rewriting records', async () => {
    const {projectId} = await seedProject();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    const sealedBefore = (await rawProjectRecords(projectId))
      .filter((entry) => entry.store !== PROJECT_STORE_NAME)
      .map((entry) => entry.record.sealed);

    await expect(changeProjectVaultPassphrase(projectId, 'wrong passphrase', 'brand new phrase')).rejects.toBeInstanceOf(
      VaultPassphraseError
    );
    await changeProjectVaultPassphrase(projectId, PASSPHRASE, 'brand new phrase');

    const sealedAfter = (await rawProjectRecords(projectId))
      .filter((entry) => entry.store !== PROJECT_STORE_NAME)
      .map((entry) => entry.record.sealed);
    expect(sealedAfter).toEqual(sealedBefore);
    expect(await getProjectVaultState(projectId)).toBe('unlocked');

    resetVaultRegistryForTests();
    await expect(unlockProjectVault(projectId, PASSPHRASE)).rejects.toBeInstanceOf(VaultPassphraseError);
    await unlockProjectVault(projectId, 'brand new phrase');
    expect((await getDocumentsByProject(projectId))[0].content).toBe(`<p>${PLANTED}</p>`);
  });

  it('leaves the project unchanged when enabling fails partway through either database', async () => {
    // A value a vault cannot store faithfully, in the main database.
    const main = await seedProject();
    await editRaw(ENTITY_STORE_NAME, main.ids.entity, (record) => ({...record, archivedAt: new Date(5)}));
    const mainBefore = await rawProjectRecords(main.projectId);
    await expect(enableProjectVault(main.projectId, PASSPHRASE, FAST)).rejects.toThrow(/cannot store/);
    expect(await rawProjectRecords(main.projectId)).toEqual(mainBefore);
    expect(await getProjectVaultState(main.projectId)).toBeNull();

    // The same in the rulesets database, which is rewritten after the main one commits.
    const rules = await seedProject();
    const rulesetDb = await openRawRulesetDb();
    const tx = rulesetDb.transaction(RULESET_STORE_NAME, 'readwrite');
    const ruleset = await requestToPromise(tx.objectStore(RULESET_STORE_NAME).get(rules.ids.ruleset));
    tx.objectStore(RULESET_STORE_NAME).put({...(ruleset as object), reviewedAt: new Date(5)});
    await transactionToPromise(tx);
    const rulesBefore = await rawProjectRecords(rules.projectId);
    await expect(enableProjectVault(rules.projectId, PASSPHRASE, FAST)).rejects.toThrow(/cannot store/);
    expect(await rawProjectRecords(rules.projectId)).toEqual(rulesBefore);
    expect(await getProjectVaultState(rules.projectId)).toBeNull();

    // Ordinary writes keep working on both.
    await saveWritingDocument({id: uuid(), projectId: rules.projectId, title: 'Two', content: 'x', createdAt: 3, updatedAt: 3});
  });

  it('removes protection only with the passphrase and restores the plain records exactly', async () => {
    const {projectId} = await seedProject();
    const plainBefore = await rawProjectRecords(projectId);
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    lockProjectVault(projectId);

    await expect(disableProjectVault(projectId, 'wrong passphrase')).rejects.toBeInstanceOf(VaultPassphraseError);
    expect(await getProjectVaultState(projectId)).toBe('locked');

    await disableProjectVault(projectId, PASSPHRASE);
    expect(await getProjectVaultState(projectId)).toBeNull();
    const sortById = (entries: Awaited<ReturnType<typeof rawProjectRecords>>) =>
      [...entries].sort((a, b) => `${a.store}/${a.record.id}`.localeCompare(`${b.store}/${b.record.id}`));
    expect(sortById(await rawProjectRecords(projectId))).toEqual(sortById(plainBefore));
    resetVaultRegistryForTests();
    expect(await getProjectVaultState(projectId)).toBeNull();
  });

  it('deletes a locked project completely', async () => {
    const {projectId} = await seedProject();
    await enableProjectVault(projectId, PASSPHRASE, FAST);
    lockProjectVault(projectId);

    await deleteProject(projectId);
    expect(await rawProjectRecords(projectId)).toEqual([]);
    expect(await getProjectVaultState(projectId)).toBeNull();
  });
});
