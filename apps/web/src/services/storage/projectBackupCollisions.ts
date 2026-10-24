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
 * Slice 3.24a guard. Import keeps each record's own id for the stores below,
 * changing only `projectId`. If such an id already belongs to another project
 * in this browser, writing it would move that record out of its project. So
 * import checks first and refuses rather than lose data. Restoring a backup
 * into the project it came from is fine: those ids already belong to the
 * target. 3.24b replaces this with id remapping.
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
  const note = (existing: unknown) => {
    if (existing === undefined) return;
    const owner = ownerOf(existing);
    if (targetProjectId !== null && owner === targetProjectId) return;
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
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
      reads.push(requestToPromise(store.get(record.id)).then(note));
    }
  }
  if (settingsId) {
    reads.push(requestToPromise(tx.objectStore(SETTINGS_STORE_NAME).get(settingsId)).then(note));
  }
  await Promise.all(reads);

  const rulesetId = snapshot.data.ruleset?.id;
  if (typeof rulesetId === 'string' && rulesetId) note(await getRuleset(rulesetId) ?? undefined);

  const owners = await Promise.all(
    [...counts.entries()].map(async ([projectId, recordCount]) => ({
      projectId,
      projectName: projectId ? (await getProjectById(projectId))?.name ?? null : null,
      recordCount
    }))
  );
  owners.sort((a, b) => b.recordCount - a.recordCount);
  return {recordCount: owners.reduce((sum, owner) => sum + owner.recordCount, 0), owners};
}

const quoteNames = (owners: ProjectBackupCollisionOwner[]): string => {
  const names = owners.map((owner) => (owner.projectName ? `“${owner.projectName}”` : 'records with no project'));
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** Why the import is blocked, for the preview and (after "Nothing was imported.") the error. */
export function describeProjectBackupCollisions(
  report: ProjectBackupCollisionReport,
  mode: 'new' | 'merge'
): string {
  const records = report.recordCount === 1 ? '1 record' : `${report.recordCount} records`;
  const action = mode === 'new' ? 'Importing it as a new project' : 'Merging it into this project';
  const restore = report.owners.find((owner) => owner.projectName)?.projectName;
  return (
    `${records} in this backup already belong to ${quoteNames(report.owners)} ` +
    `on this computer. ${action} would move them out of that project, because copying a project ` +
    `within the same browser is not supported yet. Import this backup on another computer or ` +
    `browser profile` +
    (restore ? `, or merge it into “${restore}” to restore that project.` : '.')
  );
}

/** Throws `ProjectBackupCollisionError` when the import would take records from another project. */
export async function assertNoProjectBackupCollisions(params: {
  snapshot: ProjectSnapshot;
  mode: 'new' | 'merge';
  targetProjectId: string | null;
}): Promise<void> {
  const report = await findProjectBackupCollisions(params);
  if (report.recordCount > 0) {
    throw new ProjectBackupCollisionError(
      report,
      `Nothing was imported. ${describeProjectBackupCollisions(report, params.mode)}`
    );
  }
}
