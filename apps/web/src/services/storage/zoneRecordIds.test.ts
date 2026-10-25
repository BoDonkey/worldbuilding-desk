// @vitest-environment jsdom
// Repositories announce writes on `window`.
import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ZoneAffinityProfile, ZoneAffinityProgress} from '../../entityTypes';
import {openRawDb, PROJECT_STORE_NAME, ZONE_AFFINITY_PROFILE_STORE_NAME, ZONE_AFFINITY_PROGRESS_STORE_NAME} from './db';
import {transactionToPromise} from './idbRequest';
import {normalizeProjectSnapshot} from './projectBackupImport';
import {getProjectById} from './repositories/projectStorage';
import {getZoneAffinityProfilesByProject, getZoneAffinityProgress, recordZoneExposure} from './repositories/compendiumWorldStorage';
import {rekeyZoneProfiles, rekeyZoneProgress} from './zoneRecordIds';

/* Slice 5.15b: zone-affinity ids no longer embed the zone name (project schema 8). */

const legacyProfile = (projectId: string): ZoneAffinityProfile => ({
  id: `zone-profile:${projectId}:emberglass-caves`,
  projectId,
  biomeKey: 'emberglass-caves',
  name: 'Emberglass Caves',
  progressScope: 'character',
  maxAffinityPoints: 10,
  milestones: [{id: 'emberglass-caves-25', thresholdPercent: 25, name: '25% Affinity'}],
  createdAt: 1,
  updatedAt: 1
});

const legacyProgress = (projectId: string, characterSheetId?: string): ZoneAffinityProgress => ({
  id: characterSheetId
    ? `zone-progress:${projectId}:emberglass-caves:sheet:${characterSheetId}`
    : `zone-progress:${projectId}:emberglass-caves:global`,
  projectId,
  biomeKey: 'emberglass-caves',
  characterSheetId,
  affinityPoints: 2,
  totalExposureSeconds: 120,
  unlockedMilestoneIds: [],
  updatedAt: 1
});

describe('zone record ids (schema 8)', () => {
  it('rekeys only ids built from the biome key', () => {
    const [profile] = rekeyZoneProfiles([legacyProfile('p-1')]);
    expect(profile.id).toMatch(/^zone-profile:p-1:[0-9a-f-]{36}$/);
    expect(profile).toMatchObject({biomeKey: 'emberglass-caves', name: 'Emberglass Caves'});
    expect(rekeyZoneProfiles([profile])[0].id).toBe(profile.id);
    const progress = rekeyZoneProgress([legacyProgress('p-1'), legacyProgress('p-1', 'sheet-1')]);
    expect(progress.map((record) => record.id).join(' ')).not.toContain('emberglass');
    expect(rekeyZoneProgress(progress).map((record) => record.id)).toEqual(progress.map((record) => record.id));
  });

  it('migrates a schema 7 project and keeps finding its zone records by biome', async () => {
    const projectId = crypto.randomUUID();
    const db = await openRawDb();
    const tx = db.transaction([PROJECT_STORE_NAME, ZONE_AFFINITY_PROFILE_STORE_NAME, ZONE_AFFINITY_PROGRESS_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_STORE_NAME).put({id: projectId, name: 'Caves', storageSchemaVersion: 7, createdAt: 1, updatedAt: 1});
    tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME).put(legacyProfile(projectId));
    tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME).put(legacyProgress(projectId));
    tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME).put(legacyProgress(projectId, 'sheet-1'));
    await transactionToPromise(tx);
    db.close();

    expect((await getProjectById(projectId))?.storageSchemaVersion).toBe(8);
    const profiles = await getZoneAffinityProfilesByProject(projectId);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).not.toContain('emberglass');
    const global = await getZoneAffinityProgress(projectId, 'emberglass-caves');
    expect(global).toMatchObject({affinityPoints: 2, totalExposureSeconds: 120});
    expect(global.id).not.toContain('emberglass');
    const sheet = await getZoneAffinityProgress(projectId, 'emberglass-caves', 'sheet-1');
    expect(sheet.id).not.toBe(global.id);

    const result = await recordZoneExposure({projectId, biomeKey: 'emberglass-caves', exposureSeconds: 60});
    expect(result.progress).toMatchObject({id: global.id, affinityPoints: 3});
  });

  it('rekeys zone records in an imported backup', () => {
    const snapshot = normalizeProjectSnapshot({
      schemaVersion: 10,
      generatedAt: 1,
      projectId: 'p-1',
      project: {id: 'p-1', name: 'Caves', storageSchemaVersion: 7, createdAt: 1, updatedAt: 1},
      data: {zoneAffinityProfiles: [legacyProfile('p-1')], zoneAffinityProgressRecords: [legacyProgress('p-1')]},
      counts: {zoneAffinityProfiles: 1, zoneAffinityProgressRecords: 1}
    });
    expect(JSON.stringify(snapshot.data.zoneAffinityProfiles.map((profile) => profile.id))).not.toContain('emberglass');
    expect(snapshot.data.zoneAffinityProgressRecords[0].id).not.toContain('emberglass');
    expect(snapshot.data.zoneAffinityProfiles[0].biomeKey).toBe('emberglass-caves');
  });
});
