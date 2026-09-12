import type {
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  StoredRuleset,
  WorldEntity
} from '../../entityTypes';
import {
  ACTOR_RESOLUTION_STORE_NAME,
  CATEGORY_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  ENTITY_STORE_NAME,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_SCOPED_STORE_NAMES,
  PROJECT_STORE_NAME
} from '../../db';
import {classifyCharacterIdentities} from '../characters/characterIdentity';
import {
  getRulesetByProjectId,
  replaceRulesetSnapshot
} from '../rules/rulesetService';

export const LEGACY_PROJECT_SCHEMA_VERSION = 1;
export const CURRENT_PROJECT_SCHEMA_VERSION = 5;
export const PROJECT_MIGRATION_BACKUP_SCHEMA_VERSION = 1;

export interface ProjectMigrationContext {
  db: IDBDatabase;
  projectId: string;
}

export interface ProjectSchemaMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (context: ProjectMigrationContext) => Promise<void>;
}

export interface ProjectMigrationBackup {
  id: string;
  backupSchemaVersion: typeof PROJECT_MIGRATION_BACKUP_SCHEMA_VERSION;
  projectId: string;
  fromVersion: number;
  toVersion: number;
  createdAt: number;
  project: Project;
  ruleset: StoredRuleset | null;
  stores: Partial<Record<(typeof PROJECT_SCOPED_STORE_NAMES)[number], unknown[]>>;
}

export interface ProjectMigrationReport {
  fromVersion: number;
  toVersion: number;
  appliedVersions: number[];
  backupId: string | null;
}

export class ProjectMigrationError extends Error {
  readonly projectId: string;
  readonly backupId: string;

  constructor(params: {
    projectId: string;
    backupId: string;
    cause: unknown;
  }) {
    const causeMessage =
      params.cause instanceof Error ? params.cause.message : 'Unknown migration failure';
    super(
      `Project migration failed for "${params.projectId}". ` +
      `Restore backup "${params.backupId}" before retrying. ${causeMessage}`,
      {cause: params.cause}
    );
    this.name = 'ProjectMigrationError';
    this.projectId = params.projectId;
    this.backupId = params.backupId;
  }
}

interface RunProjectMigrationPlanParams {
  projectId: string;
  fromVersion: number;
  targetVersion: number;
  migrations: readonly ProjectSchemaMigration[];
  createBackup: () => Promise<string>;
  writeVersion: (version: number) => Promise<void>;
  context: ProjectMigrationContext;
}

async function readProjectRecords<T extends {projectId: string}>(
  db: IDBDatabase,
  storeName: string,
  projectId: string
): Promise<T[]> {
  const transaction = db.transaction(storeName, 'readonly');
  const records = (await requestToPromise(
    transaction.objectStore(storeName).getAll()
  )) as T[];
  await transactionToPromise(transaction);
  return records.filter((record) => record.projectId === projectId);
}

async function migrateCharacterIdentityLinks(
  context: ProjectMigrationContext
): Promise<void> {
  const [categories, entities, characters, sheets] = await Promise.all([
    readProjectRecords<EntityCategory>(context.db, CATEGORY_STORE_NAME, context.projectId),
    readProjectRecords<WorldEntity>(context.db, ENTITY_STORE_NAME, context.projectId),
    readProjectRecords<Character>(context.db, CHARACTER_STORE_NAME, context.projectId),
    readProjectRecords<CharacterSheet>(
      context.db,
      CHARACTER_SHEET_STORE_NAME,
      context.projectId
    )
  ]);
  const result = classifyCharacterIdentities({
    projectId: context.projectId,
    categories,
    entities,
    characters,
    sheets
  });
  const storeNames = [
    CATEGORY_STORE_NAME,
    CHARACTER_STORE_NAME,
    CHARACTER_SHEET_STORE_NAME,
    ACTOR_RESOLUTION_STORE_NAME,
    CHARACTER_IDENTITY_REPORT_STORE_NAME
  ];
  const transaction = context.db.transaction(storeNames, 'readwrite');
  result.categories.forEach((category) =>
    transaction.objectStore(CATEGORY_STORE_NAME).put(category)
  );
  result.characters.forEach((character) =>
    transaction.objectStore(CHARACTER_STORE_NAME).put(character)
  );
  result.sheets.forEach((sheet) =>
    transaction.objectStore(CHARACTER_SHEET_STORE_NAME).put(sheet)
  );
  result.actorResolutions.forEach((resolution) =>
    transaction.objectStore(ACTOR_RESOLUTION_STORE_NAME).put(resolution)
  );
  transaction.objectStore(CHARACTER_IDENTITY_REPORT_STORE_NAME).put(result.report);
  await transactionToPromise(transaction);
}

const PROJECT_MIGRATIONS: readonly ProjectSchemaMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: migrateCharacterIdentityLinks
  },
  {
    fromVersion: 2,
    toVersion: 3,
    // Stable item references are additive optional fields. Existing quick
    // inventory remains name-based, so the version checkpoint and automatic
    // backup are the complete deterministic migration.
    migrate: async () => undefined
  },
  {
    fromVersion: 3,
    toVersion: 4,
    // Chapter-card scene links are additive and optional. Existing cards stay
    // intentionally unlinked; migration must not guess from titles or order.
    migrate: async () => undefined
  },
  {
    fromVersion: 4,
    toVersion: 5,
    // System negative-space records add explicit optional category and entity
    // fields. Existing records stay intentionally unclassified and unlinked.
    migrate: async () => undefined
  }
];

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function assertSchemaVersion(version: number, label: string): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export async function runProjectMigrationPlan(
  params: RunProjectMigrationPlanParams
): Promise<ProjectMigrationReport> {
  assertSchemaVersion(params.fromVersion, 'Stored project schema version');
  assertSchemaVersion(params.targetVersion, 'Target project schema version');

  if (params.fromVersion > params.targetVersion) {
    throw new Error(
      `Project "${params.projectId}" uses storage schema ${params.fromVersion}, ` +
      `but this app supports up to ${params.targetVersion}. Update the app before opening it.`
    );
  }

  if (params.fromVersion === params.targetVersion) {
    return {
      fromVersion: params.fromVersion,
      toVersion: params.targetVersion,
      appliedVersions: [],
      backupId: null
    };
  }

  const bySourceVersion = new Map<number, ProjectSchemaMigration>();
  params.migrations.forEach((migration) => {
    assertSchemaVersion(migration.fromVersion, 'Migration source version');
    assertSchemaVersion(migration.toVersion, 'Migration target version');
    if (migration.toVersion !== migration.fromVersion + 1) {
      throw new Error(
        `Project migration ${migration.fromVersion}->${migration.toVersion} must advance one version.`
      );
    }
    if (bySourceVersion.has(migration.fromVersion)) {
      throw new Error(`Duplicate project migration from version ${migration.fromVersion}.`);
    }
    bySourceVersion.set(migration.fromVersion, migration);
  });

  let version = params.fromVersion;
  const orderedMigrations: ProjectSchemaMigration[] = [];
  while (version < params.targetVersion) {
    const migration = bySourceVersion.get(version);
    if (!migration) {
      throw new Error(
        `No project migration is registered for schema ${version}->${version + 1}.`
      );
    }
    orderedMigrations.push(migration);
    version = migration.toVersion;
  }

  const backupId = await params.createBackup();
  const appliedVersions: number[] = [];
  try {
    for (const migration of orderedMigrations) {
      await migration.migrate(params.context);
      await params.writeVersion(migration.toVersion);
      appliedVersions.push(migration.toVersion);
    }
  } catch (error) {
    throw new ProjectMigrationError({
      projectId: params.projectId,
      backupId,
      cause: error
    });
  }

  return {
    fromVersion: params.fromVersion,
    toVersion: params.targetVersion,
    appliedVersions,
    backupId
  };
}

export async function createProjectMigrationBackup(params: {
  db: IDBDatabase;
  project: Project;
  fromVersion: number;
  toVersion: number;
}): Promise<ProjectMigrationBackup> {
  const transaction = params.db.transaction([...PROJECT_SCOPED_STORE_NAMES], 'readonly');
  const completion = transactionToPromise(transaction);
  const [entries, ruleset] = await Promise.all([
    Promise.all(
      PROJECT_SCOPED_STORE_NAMES.map(async (storeName) => {
        const records = (await requestToPromise(
          transaction.objectStore(storeName).getAll()
        )) as Array<{projectId?: string}>;
        return [
          storeName,
          records.filter((record) => record.projectId === params.project.id)
        ] as const;
      })
    ),
    getRulesetByProjectId(params.project.id)
  ]);
  await completion;

  const backup: ProjectMigrationBackup = {
    id: crypto.randomUUID(),
    backupSchemaVersion: PROJECT_MIGRATION_BACKUP_SCHEMA_VERSION,
    projectId: params.project.id,
    fromVersion: params.fromVersion,
    toVersion: params.toVersion,
    createdAt: Date.now(),
    project: structuredClone(params.project),
    ruleset: ruleset ? structuredClone(ruleset) : null,
    stores: Object.fromEntries(entries) as ProjectMigrationBackup['stores']
  };

  const write = params.db.transaction(PROJECT_MIGRATION_BACKUP_STORE_NAME, 'readwrite');
  write.objectStore(PROJECT_MIGRATION_BACKUP_STORE_NAME).put(backup);
  await transactionToPromise(write);
  return backup;
}

function replaceProjectRecordsInStore(params: {
  db: IDBDatabase;
  storeName: (typeof PROJECT_SCOPED_STORE_NAMES)[number];
  projectId: string;
  records: unknown[];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = params.db.transaction(params.storeName, 'readwrite');
    const store = transaction.objectStore(params.storeName);
    const read = store.getAll();

    read.onsuccess = () => {
      (read.result as Array<{id?: string; projectId?: string}>)
        .filter((record) => record.projectId === params.projectId && typeof record.id === 'string')
        .forEach((record) => store.delete(record.id as string));
      params.records.forEach((record) => store.put(record));
    };
    read.onerror = () => reject(read.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function restoreProjectMigrationBackup(
  db: IDBDatabase,
  backupId: string
): Promise<Project> {
  const read = db.transaction(PROJECT_MIGRATION_BACKUP_STORE_NAME, 'readonly');
  const backup = (await requestToPromise(
    read.objectStore(PROJECT_MIGRATION_BACKUP_STORE_NAME).get(backupId)
  )) as ProjectMigrationBackup | undefined;
  if (!backup) {
    throw new Error(`Project migration backup "${backupId}" was not found.`);
  }
  if (backup.backupSchemaVersion !== PROJECT_MIGRATION_BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported project migration backup schema (${String(backup.backupSchemaVersion)}).`
    );
  }

  for (const storeName of PROJECT_SCOPED_STORE_NAMES) {
    await replaceProjectRecordsInStore({
      db,
      storeName,
      projectId: backup.projectId,
      records: backup.stores[storeName] ?? []
    });
  }

  const writeProject = db.transaction(PROJECT_STORE_NAME, 'readwrite');
  writeProject.objectStore(PROJECT_STORE_NAME).put(backup.project);
  await transactionToPromise(writeProject);
  await replaceRulesetSnapshot(backup.projectId, backup.ruleset);
  return structuredClone(backup.project);
}

export async function listProjectMigrationBackups(
  db: IDBDatabase,
  projectId: string
): Promise<ProjectMigrationBackup[]> {
  const transaction = db.transaction(PROJECT_MIGRATION_BACKUP_STORE_NAME, 'readonly');
  const backups = (await requestToPromise(
    transaction.objectStore(PROJECT_MIGRATION_BACKUP_STORE_NAME).getAll()
  )) as ProjectMigrationBackup[];
  return backups
    .filter((backup) => backup.projectId === projectId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

async function writeProjectSchemaVersion(
  db: IDBDatabase,
  project: Project,
  version: number
): Promise<Project> {
  const updated = {...project, storageSchemaVersion: version};
  const transaction = db.transaction(PROJECT_STORE_NAME, 'readwrite');
  transaction.objectStore(PROJECT_STORE_NAME).put(updated);
  await transactionToPromise(transaction);
  return updated;
}

export async function ensureProjectStorageCurrent(
  db: IDBDatabase,
  project: Project,
  options: {onMigrated?: (report: ProjectMigrationReport) => void} = {}
): Promise<Project> {
  const storedVersion = project.storageSchemaVersion ?? LEGACY_PROJECT_SCHEMA_VERSION;
  let currentProject = project;

  const report = await runProjectMigrationPlan({
    projectId: project.id,
    fromVersion: storedVersion,
    targetVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    migrations: PROJECT_MIGRATIONS,
    context: {db, projectId: project.id},
    createBackup: async () => {
      const backup = await createProjectMigrationBackup({
        db,
        project: currentProject,
        fromVersion: storedVersion,
        toVersion: CURRENT_PROJECT_SCHEMA_VERSION
      });
      return backup.id;
    },
    writeVersion: async (version) => {
      currentProject = await writeProjectSchemaVersion(db, currentProject, version);
    }
  });

  if (report.appliedVersions.length > 0) {
    options.onMigrated?.(report);
  }

  if (report.appliedVersions.length === 0 && project.storageSchemaVersion === undefined) {
    currentProject = await writeProjectSchemaVersion(
      db,
      project,
      CURRENT_PROJECT_SCHEMA_VERSION
    );
  }

  return currentProject;
}
