import type {
  EntityCategory,
  Project,
  ProjectSettings,
  WorldEntity,
  WritingDocument,
} from '../entityTypes';
import {
  openDb,
  CATEGORY_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  ENTITY_STORE_NAME,
  SETTINGS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  WRITING_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME
} from '../db';
import {saveProject, getProjectById, getAllProjects} from '../projectStorage';
import {getRulesetByProjectId, saveRuleset, deleteRuleset} from './rulesetService';
import type {ProjectSnapshot} from './projectSnapshotService';
import {extractSingleFileZip} from '../utils/unzip';

export type ProjectBackupImportMode = 'new' | 'merge';

export interface ProjectSnapshotImportPreview {
  schemaVersion: number;
  sourceProjectName: string;
  sourceProjectId: string;
  generatedAt: number;
  counts: ProjectSnapshot['counts'];
}

export interface ProjectBackupConflictSummary {
  hasTargetSettings: boolean;
  hasTargetRuleset: boolean;
  sameNameEntityCount: number;
  sameNameCategoryCount: number;
  sameNameDocumentCount: number;
}

export interface ProjectBackupImportResult {
  projectId: string;
  projectName: string;
  mode: ProjectBackupImportMode;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getProjectRecords<T extends {projectId: string}>(
  storeName: string,
  projectId: string
): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const all = (await requestToPromise(
    tx.objectStore(storeName).getAll()
  )) as T[];
  return all.filter((item) => item.projectId === projectId);
}

function ensureProjectSnapshot(value: unknown): ProjectSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid snapshot payload.');
  }
  const snapshot = value as Partial<ProjectSnapshot>;
  if (snapshot.schemaVersion !== 1) {
    throw new Error(
      `Unsupported snapshot schema version (${String(snapshot.schemaVersion)}).`
    );
  }
  if (!snapshot.project || !snapshot.project.id || !snapshot.project.name) {
    throw new Error('Snapshot project metadata is missing.');
  }
  if (!snapshot.data || !snapshot.counts) {
    throw new Error('Snapshot data is incomplete.');
  }
  return snapshot as ProjectSnapshot;
}

async function readZipJson(file: File): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const {fileName, fileData} = extractSingleFileZip({zipBytes: bytes});
  if (!fileName.endsWith('.json')) {
    throw new Error('Backup zip does not contain a JSON snapshot file.');
  }
  const jsonText = new TextDecoder('utf-8').decode(fileData);
  return JSON.parse(jsonText);
}

function sanitizeImportedProjectName(base: string): string {
  const cleaned = base.trim() || 'Imported Project';
  return `${cleaned} (Imported)`;
}

async function uniqueProjectName(base: string): Promise<string> {
  const existing = await getAllProjects();
  const names = new Set(existing.map((project) => project.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let i = 2;
  while (names.has(`${base} ${i}`.toLowerCase())) {
    i += 1;
  }
  return `${base} ${i}`;
}

function rewriteProjectScoped<T extends {projectId: string}>(
  records: T[],
  projectId: string
): T[] {
  return records.map((record) => ({...record, projectId}));
}

async function saveProjectScopedRecords(params: {
  projectId: string;
  data: ProjectSnapshot['data'];
  existingSettingsId: string | null;
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [
      SETTINGS_STORE_NAME,
      CATEGORY_STORE_NAME,
      ENTITY_STORE_NAME,
      WRITING_STORE_NAME,
      CHARACTER_STORE_NAME,
      CHARACTER_SHEET_STORE_NAME,
      COMPENDIUM_ENTRY_STORE_NAME,
      COMPENDIUM_MILESTONE_STORE_NAME,
      COMPENDIUM_RECIPE_STORE_NAME,
      COMPENDIUM_PROGRESS_STORE_NAME,
      COMPENDIUM_ACTION_LOG_STORE_NAME,
      ZONE_AFFINITY_PROFILE_STORE_NAME,
      ZONE_AFFINITY_PROGRESS_STORE_NAME,
      SETTLEMENT_MODULE_STORE_NAME,
      SETTLEMENT_STATE_STORE_NAME
    ],
    'readwrite'
  );

  const putMany = <T>(storeName: string, values: T[]) =>
    Promise.all(values.map((value) => requestToPromise(tx.objectStore(storeName).put(value))));

  const settingsToSave = params.data.settings
    ? {
        ...params.data.settings,
        id: params.existingSettingsId ?? params.data.settings.id,
        projectId: params.projectId,
        updatedAt: Date.now()
      }
    : null;

  if (settingsToSave) {
    await requestToPromise(tx.objectStore(SETTINGS_STORE_NAME).put(settingsToSave));
  }

  await putMany(
    CATEGORY_STORE_NAME,
    rewriteProjectScoped(params.data.categories, params.projectId)
  );
  await putMany(
    ENTITY_STORE_NAME,
    rewriteProjectScoped(params.data.entities, params.projectId)
  );
  await putMany(
    WRITING_STORE_NAME,
    rewriteProjectScoped(params.data.writingDocuments, params.projectId)
  );
  await putMany(
    CHARACTER_STORE_NAME,
    rewriteProjectScoped(params.data.characters, params.projectId)
  );
  await putMany(
    CHARACTER_SHEET_STORE_NAME,
    rewriteProjectScoped(params.data.characterSheets, params.projectId)
  );
  await putMany(
    COMPENDIUM_ENTRY_STORE_NAME,
    rewriteProjectScoped(params.data.compendiumEntries, params.projectId)
  );
  await putMany(
    COMPENDIUM_MILESTONE_STORE_NAME,
    rewriteProjectScoped(params.data.compendiumMilestones, params.projectId)
  );
  await putMany(
    COMPENDIUM_RECIPE_STORE_NAME,
    rewriteProjectScoped(params.data.compendiumRecipes, params.projectId)
  );
  await putMany(
    COMPENDIUM_PROGRESS_STORE_NAME,
    rewriteProjectScoped(params.data.compendiumProgressRecords, params.projectId)
  );
  await putMany(
    COMPENDIUM_ACTION_LOG_STORE_NAME,
    rewriteProjectScoped(params.data.compendiumActionLogs, params.projectId)
  );
  await putMany(
    ZONE_AFFINITY_PROFILE_STORE_NAME,
    rewriteProjectScoped(params.data.zoneAffinityProfiles, params.projectId)
  );
  await putMany(
    ZONE_AFFINITY_PROGRESS_STORE_NAME,
    rewriteProjectScoped(params.data.zoneAffinityProgressRecords, params.projectId)
  );
  await putMany(
    SETTLEMENT_MODULE_STORE_NAME,
    rewriteProjectScoped(params.data.settlementModules, params.projectId)
  );
  await putMany(
    SETTLEMENT_STATE_STORE_NAME,
    rewriteProjectScoped(params.data.settlementStateRecords, params.projectId)
  );

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function parseProjectBackupZip(file: File): Promise<{
  snapshot: ProjectSnapshot;
  preview: ProjectSnapshotImportPreview;
}> {
  const json = await readZipJson(file);
  const snapshot = ensureProjectSnapshot(json);
  return {
    snapshot,
    preview: {
      schemaVersion: snapshot.schemaVersion,
      sourceProjectName: snapshot.project.name,
      sourceProjectId: snapshot.project.id,
      generatedAt: snapshot.generatedAt,
      counts: snapshot.counts
    }
  };
}

export async function previewProjectBackupConflicts(params: {
  snapshot: ProjectSnapshot;
  targetProjectId: string;
}): Promise<ProjectBackupConflictSummary> {
  const targetProject = await getProjectById(params.targetProjectId);
  if (!targetProject) {
    throw new Error('Target project not found.');
  }

  const [settings, ruleset, categories, entities, docs] = await Promise.all([
    getProjectRecords<ProjectSettings>(SETTINGS_STORE_NAME, params.targetProjectId),
    getRulesetByProjectId(params.targetProjectId),
    getProjectRecords<EntityCategory>(CATEGORY_STORE_NAME, params.targetProjectId),
    getProjectRecords<WorldEntity>(ENTITY_STORE_NAME, params.targetProjectId),
    getProjectRecords<WritingDocument>(WRITING_STORE_NAME, params.targetProjectId)
  ]);

  const categoryNames = new Set(categories.map((item) => item.name.trim().toLowerCase()));
  const entityNames = new Set(entities.map((item) => item.name.trim().toLowerCase()));
  const docNames = new Set(docs.map((item) => item.title.trim().toLowerCase()));

  const sameNameCategoryCount = params.snapshot.data.categories.filter((item) =>
    categoryNames.has(item.name.trim().toLowerCase())
  ).length;
  const sameNameEntityCount = params.snapshot.data.entities.filter((item) =>
    entityNames.has(item.name.trim().toLowerCase())
  ).length;
  const sameNameDocumentCount = params.snapshot.data.writingDocuments.filter((item) =>
    docNames.has(item.title.trim().toLowerCase())
  ).length;

  return {
    hasTargetSettings: settings.length > 0,
    hasTargetRuleset: Boolean(ruleset),
    sameNameEntityCount,
    sameNameCategoryCount,
    sameNameDocumentCount
  };
}

export async function importProjectBackup(params: {
  snapshot: ProjectSnapshot;
  mode: ProjectBackupImportMode;
  targetProjectId?: string;
}): Promise<ProjectBackupImportResult> {
  const snapshot = params.snapshot;

  let targetProjectId: string;
  let targetProjectName: string;
  if (params.mode === 'new') {
    targetProjectId = crypto.randomUUID();
    const now = Date.now();
    targetProjectName = await uniqueProjectName(
      sanitizeImportedProjectName(snapshot.project.name)
    );
    const project: Project = {
      ...snapshot.project,
      id: targetProjectId,
      name: targetProjectName,
      rulesetId: undefined,
      createdAt: now,
      updatedAt: now
    };
    await saveProject(project);
  } else {
    if (!params.targetProjectId) {
      throw new Error('Target project is required for merge imports.');
    }
    const existing = await getProjectById(params.targetProjectId);
    if (!existing) {
      throw new Error('Target project not found.');
    }
    targetProjectId = existing.id;
    targetProjectName = existing.name;
  }

  const existingSettings = await getProjectRecords<ProjectSettings>(
    SETTINGS_STORE_NAME,
    targetProjectId
  );

  await saveProjectScopedRecords({
    projectId: targetProjectId,
    data: snapshot.data,
    existingSettingsId: existingSettings[0]?.id ?? null
  });

  if (snapshot.data.ruleset) {
    const existingRuleset = await getRulesetByProjectId(targetProjectId);
    if (existingRuleset) {
      await deleteRuleset(existingRuleset.id, targetProjectId);
    }
    const rulesetData = Object.fromEntries(
      Object.entries(snapshot.data.ruleset).filter(([key]) => key !== 'projectId')
    ) as Omit<typeof snapshot.data.ruleset, 'projectId'>;
    await saveRuleset(rulesetData, targetProjectId);
  }

  const project = await getProjectById(targetProjectId);
  if (!project) {
    throw new Error('Imported project missing after save.');
  }

  if (snapshot.data.ruleset) {
    const ruleset = await getRulesetByProjectId(targetProjectId);
    if (ruleset && project.rulesetId !== ruleset.id) {
      await saveProject({
        ...project,
        rulesetId: ruleset.id,
        updatedAt: Date.now()
      });
    }
  }

  return {
    projectId: targetProjectId,
    projectName: targetProjectName,
    mode: params.mode
  };
}
