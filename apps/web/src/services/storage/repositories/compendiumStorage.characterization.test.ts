import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {
  CompendiumEntry,
  CompendiumMilestone,
  SettlementState,
  UnlockableRecipe,
  WorldEntity,
  ZoneAffinityProfile
} from '../../../entityTypes';
import {openDb, SETTLEMENT_STATE_STORE_NAME} from '../db';
import {
  attachModuleToSettlement,
  deleteCompendiumEntry,
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumMilestonesByProject,
  getCompendiumProgress,
  getOrCreateSettlementState,
  getRecipesByProject,
  getSettlementState,
  getZoneAffinityProfilesByProject,
  getZoneAffinityProgress,
  getZoneAffinityProgressByProject,
  recordCompendiumAction,
  recordZoneExposure,
  saveCompendiumEntry,
  saveCompendiumMilestone,
  saveUnlockableRecipe,
  saveZoneAffinityProfile,
  updateSettlementBaseStats,
  updateSettlementFortressLevel,
  updateSettlementLocation,
  upsertCompendiumEntryFromEntity,
  upsertZoneAffinityProfile
} from '..';

/*
 * Characterization tests (3.22): they pin the current behavior of the
 * compendium persistence layer, including its quirks, so the 3.23a storage
 * move and the responsibility split can be checked against them. A test that
 * records a quirk says so; changing that behavior is a separate decision.
 */

let projectCounter = 0;
const newProject = () => `compendium-test-${Date.now()}-${projectCounter++}`;

const entry = (projectId: string, overrides: Partial<CompendiumEntry> = {}): CompendiumEntry => ({
  id: `${projectId}-entry-${overrides.name ?? 'wolf'}`,
  projectId,
  name: 'Ash Wolf',
  domain: 'beast',
  actions: [
    {id: 'discover', label: 'Discover', points: 5, repeatable: false},
    {id: 'harvest', label: 'Harvest', points: 2, repeatable: true}
  ],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const milestone = (projectId: string, id: string, pointsRequired: number, unlockRecipeIds?: string[]): CompendiumMilestone => ({
  id, projectId, name: id, pointsRequired, unlockRecipeIds, createdAt: 1
});

describe('compendium entries', () => {
  it('lists only the project’s entries, sorted by name, and deletes by id', async () => {
    const projectId = newProject();
    await saveCompendiumEntry(entry(projectId, {id: 'b', name: 'Brine Eel'}));
    await saveCompendiumEntry(entry(projectId, {id: 'a', name: 'Ash Wolf'}));
    await saveCompendiumEntry(entry(newProject(), {id: 'other', name: 'Aardvark'}));

    expect((await getCompendiumEntriesByProject(projectId)).map((item) => item.id)).toEqual(['a', 'b']);
    await deleteCompendiumEntry('a');
    expect((await getCompendiumEntriesByProject(projectId)).map((item) => item.id)).toEqual(['b']);
  });

  it('creates an entry from a World Bible record with discovery defaults', async () => {
    const projectId = newProject();
    const entity = {id: 'wolf', name: 'Ash Wolf', fields: {description: 'Grey hunter'}} as unknown as WorldEntity;

    const created = await upsertCompendiumEntryFromEntity({projectId, entity, domain: 'beast'});

    expect(created).toMatchObject({
      projectId,
      name: 'Ash Wolf',
      domain: 'beast',
      sourceEntityId: 'wolf',
      description: 'Grey hunter',
      tags: [],
      mechanicKind: 'discovery',
      progressScope: 'character',
      needsCompletion: false,
      actions: [{id: 'discover', label: 'Discover', points: 1, repeatable: false}]
    });
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('re-syncs an existing entry: keeps id, tags, actions, kind, scope, and createdAt; takes the new name and domain', async () => {
    const projectId = newProject();
    const entity = {id: 'wolf', name: 'Ash Wolf', fields: {description: 42}} as unknown as WorldEntity;
    const first = await upsertCompendiumEntryFromEntity({
      projectId, entity, domain: 'beast', mechanicKind: 'zone', progressScope: 'party', needsCompletion: true
    });
    await saveCompendiumEntry({...first, tags: ['pack'], actions: [{id: 'track', label: 'Track', points: 3}]});

    const second = await upsertCompendiumEntryFromEntity({
      projectId,
      entity: {...entity, name: 'Ashen Wolf'},
      domain: 'custom',
      mechanicKind: 'general',
      progressScope: 'global',
      defaultActions: [{id: 'ignored', label: 'Ignored', points: 9}]
    });

    expect(second).toMatchObject({
      id: first.id,
      name: 'Ashen Wolf',
      domain: 'custom',
      tags: ['pack'],
      mechanicKind: 'zone',
      progressScope: 'party',
      // Quirk: an omitted needsCompletion keeps the stored value…
      needsCompletion: true,
      actions: [{id: 'track', label: 'Track', points: 3}],
      createdAt: first.createdAt
    });
    // …and a non-string description is dropped rather than stringified.
    expect(second.description).toBeUndefined();
    expect(await getCompendiumEntriesByProject(projectId)).toHaveLength(1);
  });

  it('sorts milestones by points and recipes by name, per project', async () => {
    const projectId = newProject();
    await saveCompendiumMilestone(milestone(projectId, 'late', 50));
    await saveCompendiumMilestone(milestone(projectId, 'early', 5));
    await saveCompendiumMilestone(milestone(newProject(), 'elsewhere', 1));
    const recipe = (id: string, name: string): UnlockableRecipe => ({id, projectId, name, category: 'food', createdAt: 1, updatedAt: 1});
    await saveUnlockableRecipe(recipe('r2', 'Stew'));
    await saveUnlockableRecipe(recipe('r1', 'Broth'));

    expect((await getCompendiumMilestonesByProject(projectId)).map((item) => item.id)).toEqual(['early', 'late']);
    expect((await getRecipesByProject(projectId)).map((item) => item.id)).toEqual(['r1', 'r2']);
  });
});

describe('compendium progress and actions', () => {
  it('creates and persists empty progress on first read, separately per character sheet', async () => {
    const projectId = newProject();
    const global = await getCompendiumProgress(projectId);
    const sheet = await getCompendiumProgress(projectId, 'sheet-1');

    expect(global).toMatchObject({id: `compendium:${projectId}:global`, totalPoints: 0, unlockedMilestoneIds: [], unlockedRecipeIds: []});
    expect(sheet).toMatchObject({id: `compendium:${projectId}:sheet:sheet-1`, characterSheetId: 'sheet-1'});
    expect(await getCompendiumProgress(projectId)).toEqual(global);
  });

  it('awards points × quantity and unlocks every reached milestone and its recipes once, in threshold order', async () => {
    const projectId = newProject();
    await saveCompendiumEntry(entry(projectId));
    await saveCompendiumMilestone(milestone(projectId, 'm10', 10, ['stew', 'broth']));
    await saveCompendiumMilestone(milestone(projectId, 'm4', 4, ['broth']));
    await saveCompendiumMilestone(milestone(projectId, 'm100', 100, ['feast']));

    const result = await recordCompendiumAction({projectId, entryId: `${projectId}-entry-wolf`, actionId: 'harvest', quantity: 6});

    expect(result.log).toMatchObject({projectId, actionId: 'harvest', quantity: 6, pointsAwarded: 12});
    expect(result.progress.totalPoints).toBe(12);
    expect(result.unlockedMilestoneIds).toEqual(['m4', 'm10']);
    expect(result.unlockedRecipeIds).toEqual(['broth', 'stew']);
    expect(result.progress.unlockedRecipeIds).toEqual(['broth', 'stew']);

    const again = await recordCompendiumAction({projectId, entryId: `${projectId}-entry-wolf`, actionId: 'harvest'});
    expect(again.progress.totalPoints).toBe(14);
    expect(again.unlockedMilestoneIds).toEqual([]);

    // A milestone unlocks when the total reaches its threshold exactly.
    await saveCompendiumMilestone(milestone(projectId, 'm16', 16));
    const exact = await recordCompendiumAction({projectId, entryId: `${projectId}-entry-wolf`, actionId: 'harvest'});
    expect(exact.progress.totalPoints).toBe(16);
    expect(exact.unlockedMilestoneIds).toEqual(['m16']);
    expect(await getCompendiumProgress(projectId)).toMatchObject({totalPoints: 16, unlockedMilestoneIds: ['m4', 'm10', 'm16']});
  });

  it('records a non-repeatable action once; a repeat returns no log and awards nothing', async () => {
    const projectId = newProject();
    await saveCompendiumEntry(entry(projectId));
    const params = {projectId, entryId: `${projectId}-entry-wolf`, actionId: 'discover'};

    const first = await recordCompendiumAction(params);
    const second = await recordCompendiumAction(params);

    expect(first.log?.pointsAwarded).toBe(5);
    expect(second).toMatchObject({log: null, unlockedMilestoneIds: [], unlockedRecipeIds: []});
    expect(second.progress.totalPoints).toBe(5);
    // The once-only check is per progress record, so another sheet may discover it too.
    const otherSheet = await recordCompendiumAction({...params, characterSheetId: 'sheet-2'});
    expect(otherSheet.log?.pointsAwarded).toBe(5);
  });

  it('lists action logs for one progress record, newest first', async () => {
    const projectId = newProject();
    await saveCompendiumEntry(entry(projectId));
    const base = {projectId, entryId: `${projectId}-entry-wolf`, actionId: 'harvest'};
    await recordCompendiumAction({...base, quantity: 1});
    await new Promise((resolve) => setTimeout(resolve, 2));
    await recordCompendiumAction({...base, quantity: 3});
    await recordCompendiumAction({...base, characterSheetId: 'sheet-9'});

    const logs = await getCompendiumActionLogs(projectId);
    expect(logs.map((log) => log.quantity)).toEqual([3, 1]);
    expect(await getCompendiumActionLogs(projectId, 'sheet-9')).toHaveLength(1);
  });

  it('rejects invalid quantities, unknown entries, other projects’ entries, and unknown actions', async () => {
    const projectId = newProject();
    await saveCompendiumEntry(entry(projectId));
    const base = {projectId, entryId: `${projectId}-entry-wolf`, actionId: 'harvest'};

    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(recordCompendiumAction({...base, quantity})).rejects.toThrow('quantity must be a positive number');
    }
    await expect(recordCompendiumAction({...base, entryId: 'missing'})).rejects.toThrow('Compendium entry not found for project');
    await expect(recordCompendiumAction({...base, projectId: newProject()})).rejects.toThrow('Compendium entry not found for project');
    await expect(recordCompendiumAction({...base, actionId: 'tame'})).rejects.toThrow('Action is not defined for this entry');
    expect((await getCompendiumProgress(projectId)).totalPoints).toBe(0);
  });
});

describe('zone affinity', () => {
  const profile = (projectId: string, overrides: Partial<ZoneAffinityProfile> = {}): ZoneAffinityProfile => ({
    id: `zone-profile:${projectId}:ashfall`,
    projectId,
    biomeKey: 'ashfall',
    name: 'Ashfall',
    maxAffinityPoints: 10,
    milestones: [
      {id: 'quarter', thresholdPercent: 25, name: 'Acclimated'},
      {id: 'full', thresholdPercent: 100, name: 'Native'}
    ],
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  });

  it('upserts a profile by biome, merging omitted fields from the stored one', async () => {
    const projectId = newProject();
    const created = await upsertZoneAffinityProfile({projectId, biomeKey: 'ashfall', name: 'Ashfall', sourceEntityId: 'place-1'});
    // Project schema 8: the id is random, not built from the biome key.
    expect(created.id).toMatch(new RegExp(`^zone-profile:${projectId}:[0-9a-f-]{36}$`));
    expect(created).toMatchObject({
      progressScope: 'character', maxAffinityPoints: 100, milestones: [], sourceEntityId: 'place-1'
    });

    const updated = await upsertZoneAffinityProfile({projectId, biomeKey: 'ashfall', name: 'Ash Wastes', maxAffinityPoints: 40});
    expect(updated).toMatchObject({id: created.id, name: 'Ash Wastes', maxAffinityPoints: 40, sourceEntityId: 'place-1', createdAt: created.createdAt});
    expect(await getZoneAffinityProfilesByProject(projectId)).toHaveLength(1);
  });

  it('converts exposure seconds to points and unlocks milestones by percent of the profile maximum', async () => {
    const projectId = newProject();
    await saveZoneAffinityProfile(profile(projectId));

    const first = await recordZoneExposure({projectId, biomeKey: 'ashfall', exposureSeconds: 90, pointsPerMinute: 2});
    expect(first.progress).toMatchObject({affinityPoints: 3, totalExposureSeconds: 90, unlockedMilestoneIds: ['quarter']});
    expect(first.unlockedMilestoneIds).toEqual(['quarter']);

    const second = await recordZoneExposure({projectId, biomeKey: 'ashfall', exposureSeconds: 600});
    expect(second.progress.affinityPoints).toBe(13);
    expect(second.unlockedMilestoneIds).toEqual(['full']);
    expect(await getZoneAffinityProgress(projectId, 'ashfall')).toMatchObject({affinityPoints: 13, unlockedMilestoneIds: ['quarter', 'full']});
  });

  it('keeps zone progress per character sheet and lists it by affinity, highest first', async () => {
    const projectId = newProject();
    await saveZoneAffinityProfile(profile(projectId));
    await recordZoneExposure({projectId, biomeKey: 'ashfall', exposureSeconds: 60});
    await recordZoneExposure({projectId, biomeKey: 'ashfall', exposureSeconds: 300, characterSheetId: 'sheet-1'});

    const all = await getZoneAffinityProgressByProject(projectId);
    expect(all.map((progress) => [progress.characterSheetId, progress.affinityPoints])).toEqual([['sheet-1', 5], [undefined, 1]]);
  });

  it('rejects non-positive exposure and unknown biomes', async () => {
    const projectId = newProject();
    await saveZoneAffinityProfile(profile(projectId));
    await expect(recordZoneExposure({projectId, biomeKey: 'ashfall', exposureSeconds: 0})).rejects.toThrow('exposureSeconds must be a positive number');
    await expect(recordZoneExposure({projectId, biomeKey: 'tundra', exposureSeconds: 5})).rejects.toThrow('Zone affinity profile not found for biome "tundra"');
  });
});

describe('settlement state', () => {
  const putRawState = async (state: SettlementState) => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readwrite');
      tx.objectStore(SETTLEMENT_STATE_STORE_NAME).put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  it('returns null before creation, then creates a level-1 base with default stats', async () => {
    const projectId = newProject();
    expect(await getSettlementState(projectId)).toBeNull();

    const created = await getOrCreateSettlementState(projectId);
    expect(created).toMatchObject({
      id: `settlement:${projectId}:global`, name: 'Main Base', fortressLevel: 1, moduleIds: [],
      baseStats: {defense: 10, storageCapacity: 100, craftingThroughput: 100, morale: 50}
    });
    expect(await getSettlementState(projectId)).toEqual(created);
    expect((await getOrCreateSettlementState(projectId, 'Ignored Name')).name).toBe('Main Base');
  });

  it('normalizes a malformed stored state on read and writes the normalized form back', async () => {
    const projectId = newProject();
    const id = `settlement:${projectId}:entity:keep`;
    await putRawState({
      id, projectId, name: 'Keep', sourceEntityId: 'keep', fortressLevel: -3, moduleIds: [], updatedAt: 1,
      baseStats: {defense: -5, storageCapacity: Number.NaN, craftingThroughput: 200000, morale: 7}
    } as SettlementState);

    const expected = {fortressLevel: 1, baseStats: {defense: 0, storageCapacity: 100, craftingThroughput: 100000, morale: 7}};
    expect(await getSettlementState(projectId, 'keep')).toMatchObject(expected);
    await getOrCreateSettlementState(projectId, 'Main Base', 'keep');
    const db = await openDb();
    const stored = await new Promise((resolve) => {
      const request = db.transaction(SETTLEMENT_STATE_STORE_NAME).objectStore(SETTLEMENT_STATE_STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result);
    });
    expect(stored).toMatchObject(expected);
  });

  it('floors and clamps fortress level and base-stat updates', async () => {
    const projectId = newProject();
    expect((await updateSettlementFortressLevel({projectId, level: 3.9})).fortressLevel).toBe(3);
    expect((await updateSettlementFortressLevel({projectId, level: -2})).fortressLevel).toBe(1);

    const stats = await updateSettlementBaseStats({projectId, baseStats: {defense: 250, morale: -1}});
    expect(stats.baseStats).toEqual({defense: 250, storageCapacity: 100, craftingThroughput: 100, morale: 0});
  });

  it('attaches a module once', async () => {
    const projectId = newProject();
    await attachModuleToSettlement({projectId, moduleId: 'forge'});
    const again = await attachModuleToSettlement({projectId, moduleId: 'forge'});
    expect(again.moduleIds).toEqual(['forge']);
  });

  it('moves a settlement to a new location record, keeping its level, stats, and modules', async () => {
    const projectId = newProject();
    await updateSettlementFortressLevel({projectId, level: 4, sourceEntityId: 'old-keep'});
    await attachModuleToSettlement({projectId, moduleId: 'forge', sourceEntityId: 'old-keep'});

    const moved = await updateSettlementLocation({
      projectId, sourceEntityId: 'new-keep', previousSourceEntityId: 'old-keep', name: '  Highwatch  '
    });

    expect(moved).toMatchObject({
      id: `settlement:${projectId}:entity:new-keep`, sourceEntityId: 'new-keep', name: 'Highwatch', fortressLevel: 4, moduleIds: ['forge']
    });
    expect(await getSettlementState(projectId, 'new-keep')).toMatchObject({fortressLevel: 4});
    // Quirk: the previous location's record is left in place, not removed.
    expect(await getSettlementState(projectId, 'old-keep')).toMatchObject({fortressLevel: 4, moduleIds: ['forge']});
  });
});
