import type {
  MechanicsProgressScope,
  ZoneAffinityProfile,
  ZoneAffinityProgress,
  SettlementModule,
  SettlementState
} from '../../../entityTypes';
import {
  openDb,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME
} from '../db';
import {getAllByProject, readProjectRecords} from '../projectIndex';
import {newZoneProfileId, newZoneProgressId} from '../zoneRecordIds';
import {
  createDefaultSettlementBaseStats,
  getZoneAffinityPercent,
  normalizeSettlementBaseStats,
  normalizeSettlementState
} from '../../compendium/compendiumMechanics';
import {requestToPromise} from '../idbRequest';

/*
 * Zone affinity and settlement records in IndexedDB (split from
 * compendiumService in 3.22).
 */

export interface RecordZoneExposureParams {
  projectId: string;
  biomeKey: string;
  exposureSeconds: number;
  pointsPerMinute?: number;
  characterSheetId?: string;
}

export interface RecordZoneExposureResult {
  profile: ZoneAffinityProfile;
  progress: ZoneAffinityProgress;
  unlockedMilestoneIds: string[];
}


export async function getZoneAffinityProfilesByProject(
  projectId: string
): Promise<ZoneAffinityProfile[]> {
  return (await readProjectRecords<ZoneAffinityProfile>(ZONE_AFFINITY_PROFILE_STORE_NAME, projectId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveZoneAffinityProfile(
  profile: ZoneAffinityProfile
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROFILE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME);
  await requestToPromise(store.put(profile));
}

export async function upsertZoneAffinityProfile(params: {
  projectId: string;
  biomeKey: string;
  name: string;
  sourceEntityId?: string;
  progressScope?: MechanicsProgressScope;
  maxAffinityPoints?: number;
  milestones?: ZoneAffinityProfile['milestones'];
}): Promise<ZoneAffinityProfile> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROFILE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME);
  // Found by biome inside this transaction; ids are random (project schema 8).
  const existing = (await getAllByProject<ZoneAffinityProfile>(store, params.projectId)).find(
    (profile) => profile.biomeKey === params.biomeKey
  );
  const now = Date.now();
  const next: ZoneAffinityProfile = {
    id: existing?.id ?? newZoneProfileId(params.projectId),
    projectId: params.projectId,
    biomeKey: params.biomeKey,
    name: params.name,
    sourceEntityId: params.sourceEntityId ?? existing?.sourceEntityId,
    progressScope: params.progressScope ?? existing?.progressScope ?? 'character',
    maxAffinityPoints: params.maxAffinityPoints ?? existing?.maxAffinityPoints ?? 100,
    milestones: params.milestones ?? existing?.milestones ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await requestToPromise(store.put(next));
  return next;
}

export async function getZoneAffinityProgressByProject(
  projectId: string
): Promise<ZoneAffinityProgress[]> {
  return (await readProjectRecords<ZoneAffinityProgress>(ZONE_AFFINITY_PROGRESS_STORE_NAME, projectId))
    .sort((a, b) => b.affinityPoints - a.affinityPoints);
}

export async function getZoneAffinityProgress(
  projectId: string,
  biomeKey: string,
  characterSheetId?: string
): Promise<ZoneAffinityProgress> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME);
  const existing = (await getAllByProject<ZoneAffinityProgress>(store, projectId)).find(
    (record) => record.biomeKey === biomeKey && (record.characterSheetId ?? null) === (characterSheetId ?? null)
  );
  if (existing) return existing;
  const created: ZoneAffinityProgress = {
    id: newZoneProgressId(projectId),
    projectId,
    biomeKey,
    characterSheetId,
    affinityPoints: 0,
    totalExposureSeconds: 0,
    unlockedMilestoneIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function recordZoneExposure(
  params: RecordZoneExposureParams
): Promise<RecordZoneExposureResult> {
  if (!Number.isFinite(params.exposureSeconds) || params.exposureSeconds <= 0) {
    throw new Error('exposureSeconds must be a positive number');
  }

  const profiles = await getZoneAffinityProfilesByProject(params.projectId);
  const profile = profiles.find((item) => item.biomeKey === params.biomeKey);
  if (!profile) {
    throw new Error(`Zone affinity profile not found for biome "${params.biomeKey}"`);
  }

  const pointsPerMinute = params.pointsPerMinute ?? 1;
  const pointsToAdd = (params.exposureSeconds / 60) * pointsPerMinute;
  const progress = await getZoneAffinityProgress(
    params.projectId,
    params.biomeKey,
    params.characterSheetId
  );

  const unlockedMilestoneSet = new Set(progress.unlockedMilestoneIds);
  const unlockedMilestoneIds: string[] = [];
  const nextProgress: ZoneAffinityProgress = {
    ...progress,
    affinityPoints: Math.max(0, progress.affinityPoints + pointsToAdd),
    totalExposureSeconds: progress.totalExposureSeconds + params.exposureSeconds,
    updatedAt: Date.now()
  };

  const nextPercent = getZoneAffinityPercent(nextProgress, profile);
  for (const milestone of profile.milestones) {
    if (nextPercent >= milestone.thresholdPercent) {
      if (!unlockedMilestoneSet.has(milestone.id)) {
        unlockedMilestoneSet.add(milestone.id);
        unlockedMilestoneIds.push(milestone.id);
      }
    }
  }
  nextProgress.unlockedMilestoneIds = Array.from(unlockedMilestoneSet);

  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME);
  await requestToPromise(store.put(nextProgress));

  return {
    profile,
    progress: nextProgress,
    unlockedMilestoneIds
  };
}

function settlementStateId(projectId: string, sourceEntityId?: string): string {
  return sourceEntityId
    ? `settlement:${projectId}:entity:${sourceEntityId}`
    : `settlement:${projectId}:global`;
}

export async function getSettlementModulesByProject(
  projectId: string
): Promise<SettlementModule[]> {
  return (await readProjectRecords<SettlementModule>(SETTLEMENT_MODULE_STORE_NAME, projectId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveSettlementModule(module: SettlementModule): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_MODULE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_MODULE_STORE_NAME);
  await requestToPromise(store.put(module));
}

/** Read-only lookup: the normalized settlement state, or null if none was created yet. */
export async function getSettlementState(
  projectId: string,
  sourceEntityId?: string
): Promise<SettlementState | null> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readonly');
  const existing = (await requestToPromise(
    tx.objectStore(SETTLEMENT_STATE_STORE_NAME).get(settlementStateId(projectId, sourceEntityId))
  )) as SettlementState | undefined;
  return existing ? normalizeSettlementState(existing) : null;
}

export async function getOrCreateSettlementState(
  projectId: string,
  name = 'Main Base',
  sourceEntityId?: string
): Promise<SettlementState> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_STATE_STORE_NAME);
  const id = settlementStateId(projectId, sourceEntityId);
  const existing = (await requestToPromise(
    store.get(id)
  )) as SettlementState | undefined;
  if (existing) {
    const normalizedExisting = normalizeSettlementState(existing);
    if (JSON.stringify(normalizedExisting) !== JSON.stringify(existing)) {
      await requestToPromise(store.put(normalizedExisting));
    }
    return normalizedExisting;
  }
  const created: SettlementState = {
    id,
    projectId,
    name,
    sourceEntityId,
    fortressLevel: 1,
    baseStats: createDefaultSettlementBaseStats(),
    moduleIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function saveSettlementState(state: SettlementState): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_STATE_STORE_NAME);
  await requestToPromise(store.put(normalizeSettlementState(state)));
}

export async function updateSettlementFortressLevel(params: {
  projectId: string;
  level: number;
  sourceEntityId?: string;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(
    params.projectId,
    'Main Base',
    params.sourceEntityId
  );
  const next: SettlementState = {
    ...state,
    fortressLevel: Math.max(1, Math.floor(params.level)),
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export async function updateSettlementBaseStats(params: {
  projectId: string;
  baseStats: Partial<SettlementState['baseStats']>;
  sourceEntityId?: string;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(
    params.projectId,
    'Main Base',
    params.sourceEntityId
  );
  const next: SettlementState = {
    ...state,
    baseStats: normalizeSettlementBaseStats({...state.baseStats, ...params.baseStats}),
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export async function updateSettlementLocation(params: {
  projectId: string;
  sourceEntityId?: string;
  name?: string;
  previousSourceEntityId?: string;
}): Promise<SettlementState> {
  const existingState = await getOrCreateSettlementState(
    params.projectId,
    params.name?.trim() || 'Main Base',
    params.sourceEntityId
  );
  const previousState =
    params.previousSourceEntityId !== params.sourceEntityId
      ? await getOrCreateSettlementState(
          params.projectId,
          existingState.name,
          params.previousSourceEntityId
        )
      : existingState;
  const next: SettlementState = {
    ...previousState,
    id: settlementStateId(params.projectId, params.sourceEntityId),
    sourceEntityId: params.sourceEntityId,
    name: params.name?.trim() || previousState.name,
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export async function attachModuleToSettlement(params: {
  projectId: string;
  moduleId: string;
  sourceEntityId?: string;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(
    params.projectId,
    'Main Base',
    params.sourceEntityId
  );
  if (state.moduleIds.includes(params.moduleId)) {
    return state;
  }
  const next: SettlementState = {
    ...state,
    moduleIds: [...state.moduleIds, params.moduleId],
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

