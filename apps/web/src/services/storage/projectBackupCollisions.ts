import type {ProjectSnapshot} from './projectSnapshotService';
import {
  CATEGORY_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CANON_DECISION_CLUSTER_STORE_NAME,
  CANON_DECISION_SUPPRESSION_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  openDb,
  SETTINGS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WRITING_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME
} from './db';
import {requestToPromise} from './idbRequest';
import {readProjectRecords} from './projectIndex';
import {getProjectById} from './repositories/projectStorage';
import {getRuleset} from './repositories/rulesetStorage';

/*
 * Slice 3.24a guard. For the stores below, a record is written under its own
 * id. If that id already belongs to another project in this browser, the
 * write would move the record out of its project. Since 3.24b, import first
 * gives such records new ids (`projectBackupIdRemap.ts`), so this check is a
 * safety net: it refuses, before any write, if a collision is still left.
 * Restoring a backup into the project it came from is fine: those ids already
 * belong to the target.
 *
 * Stores whose import builds ids from the target project id (scratchpad,
 * World Canvas, aliases, actor resolutions, identity reports, mechanics
 * drafts) cannot collide and are not listed.
 */
export const ID_PRESERVING_IMPORT_STORES = [
  [CATEGORY_STORE_NAME, 'categories'],
  [ENTITY_STORE_NAME, 'entities'],
  [WRITING_STORE_NAME, 'writingDocuments'],
  [CORKBOARD_CHAPTER_CARD_STORE_NAME, 'corkboardChapterCards'],
  [CHARACTER_STORE_NAME, 'characters'],
  [CHARACTER_SHEET_STORE_NAME, 'characterSheets'],
  [LORE_DOCUMENT_STORE_NAME, 'loreDocuments'],
  [LORE_DOCUMENT_LINK_STORE_NAME, 'loreDocumentLinks'],
  [LORE_ENTITY_PROPOSAL_STORE_NAME, 'loreEntityProposals'],
  [LORE_FACT_PROPOSAL_STORE_NAME, 'loreFactProposals'],
  [CANONICAL_FACT_STORE_NAME, 'canonicalFacts'],
  [CANON_DECISION_CLUSTER_STORE_NAME, 'canonDecisionClusters'],
  [CANON_DECISION_SUPPRESSION_STORE_NAME, 'canonDecisionSuppressions'],
  [COMPENDIUM_ENTRY_STORE_NAME, 'compendiumEntries'],
  [COMPENDIUM_MILESTONE_STORE_NAME, 'compendiumMilestones'],
  [COMPENDIUM_RECIPE_STORE_NAME, 'compendiumRecipes'],
  [COMPENDIUM_PROGRESS_STORE_NAME, 'compendiumProgressRecords'],
  [COMPENDIUM_ACTION_LOG_STORE_NAME, 'compendiumActionLogs'],
  [ZONE_AFFINITY_PROFILE_STORE_NAME, 'zoneAffinityProfiles'],
  [ZONE_AFFINITY_PROGRESS_STORE_NAME, 'zoneAffinityProgressRecords'],
  [SETTLEMENT_MODULE_STORE_NAME, 'settlementModules'],
  [SETTLEMENT_STATE_STORE_NAME, 'settlementStateRecords'],
  [STATE_MUTATION_EVENT_STORE_NAME, 'stateMutationEvents']
] as const satisfies ReadonlyArray<readonly [string, keyof ProjectSnapshot['data']]>;

export interface ProjectBackupCollisionOwner {
  /** Null when the existing record has no project (legacy data). */
  projectId: string | null;
  projectName: string | null;
  recordCount: number;
}

export interface ProjectBackupCollisionReport {
  /** Records that importing would take away from another project. */
  recordCount: number;
  owners: ProjectBackupCollisionOwner[];
  /** The incoming ids involved, for remapping (3.24b). */
  ids: string[];
}

export class ProjectBackupCollisionError extends Error {
  readonly report: ProjectBackupCollisionReport;

  constructor(report: ProjectBackupCollisionReport, message: string) {
    super(message);
    this.name = 'ProjectBackupCollisionError';
    this.report = report;
  }
}

type Owned = {id?: unknown; projectId?: unknown};

const ownerOf = (record: unknown): string | null => {
  const projectId = (record as Owned | undefined)?.projectId;
  return typeof projectId === 'string' && projectId ? projectId : null;
};

/**
 * Lists the existing records an import would overwrite in projects other
 * than the target. `targetProjectId` is null for a new-project import, where
 * every existing id belongs to someone else. A merge reuses the target's own
 * settings id when it has settings, so only a missing one is checked.
 */
export async function findProjectBackupCollisions(params: {
  snapshot: ProjectSnapshot;
  targetProjectId: string | null;
}): Promise<ProjectBackupCollisionReport> {
  const {snapshot, targetProjectId} = params;
  const targetSettingsId = targetProjectId
    ? (await readProjectRecords<{id: string}>(SETTINGS_STORE_NAME, targetProjectId))[0]?.id ?? null
    : null;
  const counts = new Map<string | null, number>();
  const ids = new Set<string>();
  const noteFor = (id: string) => (existing: unknown) => {
    if (existing === undefined || existing === null) return;
    const owner = ownerOf(existing);
    if (targetProjectId !== null && owner === targetProjectId) return;
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
    ids.add(id);
  };

  const db = await openDb();
  const storeNames: string[] = ID_PRESERVING_IMPORT_STORES.map(([storeName]) => storeName);
  const settings = snapshot.data.settings;
  const settingsId = targetSettingsId ? null : settings?.id ?? null;
  if (settingsId) storeNames.push(SETTINGS_STORE_NAME);
  const tx = db.transaction(storeNames, 'readonly');
  const reads: Array<Promise<void>> = [];
  for (const [storeName, dataKey] of ID_PRESERVING_IMPORT_STORES) {
    const records = (snapshot.data[dataKey] ?? []) as Owned[];
    const store = tx.objectStore(storeName);
    for (const record of records) {
      if (typeof record?.id !== 'string' || !record.id) continue;
      reads.push(requestToPromise(store.get(record.id)).then(noteFor(record.id)));
    }
  }
  if (settingsId) {
    reads.push(requestToPromise(tx.objectStore(SETTINGS_STORE_NAME).get(settingsId)).then(noteFor(settingsId)));
  }
  await Promise.all(reads);

  const rulesetId = snapshot.data.ruleset?.id;
  if (typeof rulesetId === 'string' && rulesetId) noteFor(rulesetId)(await getRuleset(rulesetId));

  const owners = await Promise.all(
    [...counts.entries()].map(async ([projectId, recordCount]) => ({
      projectId,
      projectName: projectId ? (await getProjectById(projectId))?.name ?? null : null,
      recordCount
    }))
  );
  owners.sort((a, b) => b.recordCount - a.recordCount);
  return {recordCount: owners.reduce((sum, owner) => sum + owner.recordCount, 0), owners, ids: [...ids]};
}

const quoteNames = (owners: ProjectBackupCollisionOwner[]): string => {
  const names = owners.map((owner) => (owner.projectName ? `“${owner.projectName}”` : 'records with no project'));
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const recordsText = (count: number) => (count === 1 ? '1 record' : `${count} records`);

/** The refusal, shown only if remapping left a collision. */
export function describeProjectBackupCollisions(report: ProjectBackupCollisionReport): string {
  return (
    `${recordsText(report.recordCount)} would have overwritten records that belong to ` +
    `${quoteNames(report.owners)}, so the import stopped before writing anything.`
  );
}

/** For the preview (3.24b): the import makes copies and leaves the other project alone. */
export function describeProjectBackupCopy(
  report: ProjectBackupCollisionReport,
  mode: 'new' | 'merge'
): string {
  const names = quoteNames(report.owners);
  return mode === 'new'
    ? `${names} is already in this browser. Importing creates an independent copy with new ` +
        `record ids; ${names} is not changed.`
    : `${recordsText(report.recordCount)} in this backup also belong to ${names}. They are ` +
        `copied into this project with new ids; ${names} is not changed.`;
}

/** Throws `ProjectBackupCollisionError` when the import would take records from another project. */
export async function assertNoProjectBackupCollisions(params: {
  snapshot: ProjectSnapshot;
  targetProjectId: string | null;
}): Promise<void> {
  const report = await findProjectBackupCollisions(params);
  if (report.recordCount > 0) {
    throw new ProjectBackupCollisionError(
      report,
      `Nothing was imported. ${describeProjectBackupCollisions(report)}`
    );
  }
}
