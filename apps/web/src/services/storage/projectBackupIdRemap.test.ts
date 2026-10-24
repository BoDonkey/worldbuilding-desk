import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {buildImportIdMap, collectImportRecordIds, remapIds, stableImportId} from './projectBackupIdRemap';
import {importProjectBackup, normalizeProjectSnapshot} from './projectBackupImport';
import {buildProjectSnapshot, serializeProjectSnapshot, type ProjectSnapshot} from './projectSnapshotService';
import {getProjectById, saveProject} from './repositories/projectStorage';
import {getRuleset, putRulesetRecord} from './repositories/rulesetStorage';
import {
  CANONICAL_FACT_STORE_NAME,
  CATEGORY_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  MECHANICS_DRAFT_STORE_NAME,
  openDb,
  SETTINGS_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WORLD_CANVAS_STORE_NAME,
  WRITING_STORE_NAME
} from './db';
import {transactionToPromise} from './idbRequest';

/* Slice 3.24b: imported records get new ids and every reference follows. */

const uuid = () => crypto.randomUUID();

/** A project whose records point at each other through every kind of reference. */
async function seedLinkedProject(name: string) {
  const projectId = uuid();
  const ids = {
    category: uuid(), mira: uuid(), sera: uuid(), scene1: uuid(), scene2: uuid(), card: uuid(),
    character: uuid(), sheet: uuid(), lore: uuid(), loreLink: uuid(), fact: uuid(), event: uuid(),
    settings: uuid(), stat: uuid(), settlement: `settlement:${projectId}:global`, ruleset: `ruleset:${projectId}`
  };
  await saveProject({id: projectId, name, rulesetId: ids.ruleset, createdAt: 1, updatedAt: 1});
  await putRulesetRecord({
    id: ids.ruleset, projectId, name: 'Rules', version: '1',
    statDefinitions: [{id: ids.stat, name: 'Resolve', type: 'number', defaultValue: 5}],
    resourceDefinitions: [], rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
  } as never);
  const records: Array<[string, Record<string, unknown>]> = [
    [SETTINGS_STORE_NAME, {id: ids.settings, projectId, characterStyles: [], activeSkills: [], featureToggles: {}, createdAt: 1, updatedAt: 1}],
    [CATEGORY_STORE_NAME, {id: ids.category, projectId, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}],
    [ENTITY_STORE_NAME, {id: ids.mira, projectId, categoryId: ids.category, name: 'Mira', fields: {rival: ids.sera}, links: [ids.sera], createdAt: 1, updatedAt: 1}],
    [ENTITY_STORE_NAME, {id: ids.sera, projectId, categoryId: ids.category, name: 'Sera', fields: {}, links: [], systemNegativeSpace: {status: 'open', sceneIds: [ids.scene2]}, createdAt: 1, updatedAt: 1}],
    [WRITING_STORE_NAME, {id: ids.scene1, projectId, title: 'One', content: `<p>Mira (${ids.mira}) waits.</p>`, order: 1, createdAt: 1, updatedAt: 1}],
    [WRITING_STORE_NAME, {id: ids.scene2, projectId, title: 'Two', content: '<p>Rain.</p>', order: 2, createdAt: 1, updatedAt: 1}],
    [CORKBOARD_CHAPTER_CARD_STORE_NAME, {id: ids.card, projectId, title: 'Act I', summary: '', status: 'planned', order: 1, sceneIds: [ids.scene1, ids.scene2], plotPoints: [], createdAt: 1, updatedAt: 1}],
    [CHARACTER_STORE_NAME, {id: ids.character, projectId, entityId: ids.mira, name: 'Mira', fields: {}, createdAt: 1, updatedAt: 1}],
    [CHARACTER_SHEET_STORE_NAME, {id: ids.sheet, projectId, characterEntityId: ids.mira, characterId: ids.character, name: 'Mira', level: 1, experience: 0, stats: [{definitionId: ids.stat, value: 5}], resources: [], inventory: [], createdAt: 1, updatedAt: 1}],
    [LORE_DOCUMENT_STORE_NAME, {id: ids.lore, projectId, title: 'Notes', kind: 'note', format: 'markdown', content: '', source: {type: 'manual'}, status: 'active', createdAt: 1, updatedAt: 1}],
    [LORE_DOCUMENT_LINK_STORE_NAME, {id: ids.loreLink, projectId, loreDocumentId: ids.lore, targetType: 'entity', targetId: ids.mira, relationship: 'mentions', createdAt: 1}],
    [CANONICAL_FACT_STORE_NAME, {id: ids.fact, projectId, targetType: 'entity', targetId: ids.mira, loreDocumentId: ids.lore, factType: 'role', value: 'Scout', validFromSceneId: ids.scene1, acceptedAt: 1, updatedAt: 1}],
    [SETTLEMENT_STATE_STORE_NAME, {id: ids.settlement, projectId, moduleIds: [], updatedAt: 1}],
    [STATE_MUTATION_EVENT_STORE_NAME, {id: ids.event, projectId, sceneId: ids.scene1, sceneOrder: 1, status: 'accepted', commands: [{type: 'stat_change', actorId: ids.mira, statDefinitionId: ids.stat, delta: 1}], createdAt: 1}],
    [CONSISTENCY_ALIAS_STORE_NAME, {id: uuid(), projectId, alias: 'Scout', targetId: ids.mira, targetType: 'entity', createdAt: 1, updatedAt: 1}],
    [MECHANICS_DRAFT_STORE_NAME, {id: `${projectId}:mechanics-draft:${ids.sera}`, projectId, entityId: ids.sera, kind: 'stat', name: 'Grit', defaultValue: '3', updatedAt: 1}],
    [WORLD_CANVAS_STORE_NAME, {id: projectId, projectId, premise: 'Rain city', lenses: [{kind: 'people', linkedEntityIds: [ids.mira], linkedSourceNoteIds: [ids.lore]}], questions: [], createdAt: 1, updatedAt: 1}]
  ];
  const db = await openDb();
  const tx = db.transaction([...new Set(records.map(([store]) => store))], 'readwrite');
  for (const [store, record] of records) tx.objectStore(store).put(record);
  await transactionToPromise(tx);
  return {projectId, ids};
}

const backupOf = async (projectId: string): Promise<ProjectSnapshot> =>
  normalizeProjectSnapshot(JSON.parse(serializeProjectSnapshot(await buildProjectSnapshot(projectId))));

/** Every string anywhere in a value, including object keys. */
const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...strings(child)]);
  }
  return [];
};

/** Checks one project's copy: complete, self-consistent, sharing no record id with `other`. */
function expectIndependentCopy(copy: ProjectSnapshot, source: ProjectSnapshot) {
  const {data} = copy;
  expect(copy.counts).toEqual(source.counts);
  const byId = (records: Array<{id: string}>) => new Map(records.map((record) => [record.id, record]));
  const categories = byId(data.categories);
  const scenes = byId(data.writingDocuments);
  const mira = data.entities.find((entity) => entity.name === 'Mira')!;
  const sera = data.entities.find((entity) => entity.name === 'Sera')!;

  expect(categories.has(mira.categoryId)).toBe(true);
  expect(mira.links).toEqual([sera.id]);
  expect(mira.fields).toEqual({rival: sera.id});
  expect(sera.systemNegativeSpace?.sceneIds.every((id) => scenes.has(id))).toBe(true);
  expect(data.corkboardChapterCards[0].sceneIds?.every((id) => scenes.has(id))).toBe(true);
  expect(data.characters[0].entityId).toBe(mira.id);
  expect(data.characterSheets[0]).toMatchObject({characterEntityId: mira.id, characterId: data.characters[0].id});
  expect(data.loreDocumentLinks[0]).toMatchObject({loreDocumentId: data.loreDocuments[0].id, targetId: mira.id});
  expect(data.canonicalFacts[0]).toMatchObject({targetId: mira.id, loreDocumentId: data.loreDocuments[0].id});
  expect(scenes.has(data.canonicalFacts[0].validFromSceneId!)).toBe(true);
  expect(data.stateMutationEvents[0].commands[0]).toMatchObject({actorId: mira.id});
  expect(scenes.has(data.stateMutationEvents[0].sceneId)).toBe(true);
  expect(data.consistencyAliases[0].targetId).toBe(mira.id);
  expect(data.mechanicsDrafts[0]).toMatchObject({entityId: sera.id, id: `${copy.projectId}:mechanics-draft:${sera.id}`});
  expect(data.worldCanvases[0].lenses[0].sketches[0]).toMatchObject({linkedEntityIds: [mira.id], linkedSourceNoteIds: [data.loreDocuments[0].id]});
  expect(data.settlementStateRecords[0].id).toBe(`settlement:${copy.projectId}:global`);
  expect(data.writingDocuments.find((doc) => doc.title === 'One')?.content).toBe(`<p>Mira (${mira.id}) waits.</p>`);

  // Ruleset definition ids are the ruleset's own and stay as they were.
  const statId = source.data.ruleset!.statDefinitions[0].id;
  expect(data.ruleset?.statDefinitions[0].id).toBe(statId);
  expect(data.characterSheets[0].stats[0].definitionId).toBe(statId);
  expect(data.ruleset?.id).toBe(`ruleset:${copy.projectId}`);
  expect(copy.project.rulesetId).toBe(data.ruleset?.id);

  // No id that import keeps survives anywhere in the copy, whole or inside a
  // longer string: every field that refers to one was remapped. (Collections
  // whose ids import rebuilds from the target project are not at risk.)
  const sourceIds = collectImportRecordIds(source.data);
  expect(sourceIds.length).toBe(15);
  const copyStrings = strings(data);
  for (const id of new Set(sourceIds)) {
    const where = (node: unknown, path: string): string[] =>
      typeof node === 'string' ? (node.includes(id) ? [path] : [])
      : Array.isArray(node) ? node.flatMap((child, index) => where(child, `${path}[${index}]`))
      : node && typeof node === 'object' ? Object.entries(node).flatMap(([key, child]) => [...(key.includes(id) ? [`${path}{key}`] : []), ...where(child, `${path}.${key}`)])
      : [];
    expect(copyStrings.some((text) => text.includes(id)), `${id} at ${where(data, 'data').join(', ')}`).toBe(false);
  }
}

describe('backup import id remapping', () => {
  it('copies a project into the browser it came from, leaving the source unchanged', async () => {
    const {projectId} = await seedLinkedProject('Rain City');
    const before = await backupOf(projectId);

    const result = await importProjectBackup({snapshot: before, mode: 'new'});

    const after = await backupOf(projectId);
    expect({...after, generatedAt: 0}).toEqual({...before, generatedAt: 0});
    expect((await getRuleset(before.data.ruleset!.id))?.projectId).toBe(projectId);
    expect((await getProjectById(projectId))?.rulesetId).toBe(before.data.ruleset!.id);
    expectIndependentCopy(await backupOf(result.projectId), before);
  });

  it('imports one backup twice and keeps all three projects complete and independent', async () => {
    const {projectId} = await seedLinkedProject('Twice');
    const backup = await backupOf(projectId);

    const first = await importProjectBackup({snapshot: backup, mode: 'new'});
    const second = await importProjectBackup({snapshot: backup, mode: 'new'});

    const copies = [await backupOf(first.projectId), await backupOf(second.projectId)];
    copies.forEach((copy) => expectIndependentCopy(copy, backup));
    const recordIds = (snapshot: ProjectSnapshot) =>
      new Set([...snapshot.data.entities, ...snapshot.data.writingDocuments].map((record) => record.id));
    const [a, b, c] = [recordIds(backup), recordIds(copies[0]), recordIds(copies[1])];
    expect([...b].some((id) => a.has(id) || c.has(id))).toBe(false);
    expect({...(await backupOf(projectId)), generatedAt: 0}).toEqual({...backup, generatedAt: 0});
  });

  it('merges into another project as copies, and merging again updates instead of duplicating', async () => {
    const {projectId} = await seedLinkedProject('Merge source');
    const target = (await seedLinkedProject('Merge target')).projectId;
    const backup = await backupOf(projectId);
    const targetBefore = await backupOf(target);

    await importProjectBackup({snapshot: backup, mode: 'merge', targetProjectId: target});
    const once = await backupOf(target);
    await importProjectBackup({snapshot: backup, mode: 'merge', targetProjectId: target});
    const twice = await backupOf(target);

    expect(once.counts.entities).toBe(targetBefore.counts.entities + backup.counts.entities);
    expect(twice.counts).toEqual(once.counts);
    expect(twice.data.entities.map((entity) => entity.id).sort()).toEqual(once.data.entities.map((entity) => entity.id).sort());
    expect({...(await backupOf(projectId)), generatedAt: 0}).toEqual({...backup, generatedAt: 0});
  });

  it('restores into the project it came from without changing ids', async () => {
    const {projectId} = await seedLinkedProject('Restore');
    const backup = await backupOf(projectId);

    await importProjectBackup({snapshot: backup, mode: 'merge', targetProjectId: projectId});

    const after = await backupOf(projectId);
    expect(after.counts).toEqual(backup.counts);
    expect(after.data.entities.map((entity) => entity.id).sort()).toEqual(backup.data.entities.map((entity) => entity.id).sort());
  });
});

describe('id map', () => {
  const source = '11111111-1111-4111-8111-111111111111';
  const target = '22222222-2222-4222-8222-222222222222';
  const entity = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let counter = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

  it('swaps project and record parts inside derived ids and gives plain ids fresh ones', () => {
    counter = 0;
    const map = buildImportIdMap({
      ids: [entity, `settlement:${source}:global`, `${source}:sheet:${entity}`, 'legacy-scene-1'],
      sourceProjectId: source, targetProjectId: target, newId
    });
    const fresh = map.get(entity)!;
    expect(fresh).toMatch(/^00000000-0000-4000-8000-/);
    expect(map.get(`settlement:${source}:global`)).toBe(`settlement:${target}:global`);
    expect(map.get(`${source}:sheet:${entity}`)).toBe(`${target}:sheet:${fresh}`);
    expect(map.get('legacy-scene-1')).toMatch(/^00000000-0000-4000-8000-/);
  });

  it('rewrites exact strings, UUIDs inside text, and object keys, and nothing else', () => {
    const map = new Map([[entity, 'new-entity-id'], ['short', 'renamed']]);
    expect(remapIds({
      a: entity, list: [entity, 'other'], [entity]: 1, html: `<p data-x="${entity}">short</p>`,
      word: 'short', partial: 'shorter'
    }, map)).toEqual({
      a: 'new-entity-id', list: ['new-entity-id', 'other'], 'new-entity-id': 1,
      html: '<p data-x="new-entity-id">short</p>', word: 'renamed', partial: 'shorter'
    });
  });

  it('derives the same UUID-shaped id from the same seed', () => {
    expect(stableImportId('t:a')).toBe(stableImportId('t:a'));
    expect(stableImportId('t:a')).not.toBe(stableImportId('t:b'));
    expect(stableImportId('t:a')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
