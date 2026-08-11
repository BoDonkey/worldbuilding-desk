import type {
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import {classifyCharacterIdentities} from '../characters/characterIdentity';
import {CURRENT_PROJECT_SCHEMA_VERSION} from './projectSchemaMigrations';

export const MIN_SUPPORTED_PROJECT_SNAPSHOT_SCHEMA_VERSION = 1;
export const CURRENT_PROJECT_SNAPSHOT_SCHEMA_VERSION = 2;

export interface ProjectSnapshotMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (snapshot: Record<string, unknown>) => Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function migrateProjectSnapshotV1ToV2(
  snapshot: Record<string, unknown>
): Record<string, unknown> {
  const project = asRecord(snapshot.project);
  const data = asRecord(snapshot.data);
  const counts = asRecord(snapshot.counts);
  const projectId =
    (typeof snapshot.projectId === 'string' && snapshot.projectId) ||
    (typeof project.id === 'string' && project.id) ||
    '';
  const classification = classifyCharacterIdentities({
    projectId,
    categories: asArray<EntityCategory>(data.categories),
    entities: asArray<WorldEntity>(data.entities),
    characters: asArray<Character>(data.characters),
    sheets: asArray<CharacterSheet>(data.characterSheets),
    generatedAt:
      typeof snapshot.generatedAt === 'number' ? snapshot.generatedAt : Date.now()
  });
  const consistencyAliases = asArray(data.consistencyAliases);

  return {
    ...snapshot,
    schemaVersion: 2,
    project: {
      ...project,
      storageSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION
    },
    data: {
      ...data,
      categories: classification.categories,
      characters: classification.characters,
      characterSheets: classification.sheets,
      consistencyAliases,
      actorResolutions: classification.actorResolutions,
      characterIdentityReports: [classification.report]
    },
    counts: {
      ...counts,
      consistencyAliases: consistencyAliases.length,
      actorResolutions: classification.actorResolutions.length,
      characterIdentityReports: 1
    }
  };
}

const PROJECT_SNAPSHOT_MIGRATIONS: readonly ProjectSnapshotMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: migrateProjectSnapshotV1ToV2
  }
];

function readSchemaVersion(value: unknown): number {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid snapshot payload.');
  }
  const version = (value as {schemaVersion?: unknown}).schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) {
    throw new Error(`Invalid snapshot schema version (${String(version)}).`);
  }
  return version as number;
}

export function migrateProjectSnapshotPayload(
  value: unknown,
  migrations: readonly ProjectSnapshotMigration[] = PROJECT_SNAPSHOT_MIGRATIONS,
  targetVersion = CURRENT_PROJECT_SNAPSHOT_SCHEMA_VERSION
): Record<string, unknown> {
  let snapshot = value as Record<string, unknown>;
  let version = readSchemaVersion(snapshot);

  if (version > targetVersion) {
    throw new Error(
      `Backup uses snapshot schema ${version}, but this app supports up to ` +
      `${targetVersion}. Update the app before importing it.`
    );
  }
  if (version < MIN_SUPPORTED_PROJECT_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Backup snapshot schema ${version} is too old to import; the oldest supported version is ` +
      `${MIN_SUPPORTED_PROJECT_SNAPSHOT_SCHEMA_VERSION}.`
    );
  }

  const bySourceVersion = new Map<number, ProjectSnapshotMigration>();
  migrations.forEach((migration) => {
    if (migration.toVersion !== migration.fromVersion + 1) {
      throw new Error(
        `Snapshot migration ${migration.fromVersion}->${migration.toVersion} must advance one version.`
      );
    }
    if (bySourceVersion.has(migration.fromVersion)) {
      throw new Error(`Duplicate snapshot migration from version ${migration.fromVersion}.`);
    }
    bySourceVersion.set(migration.fromVersion, migration);
  });

  while (version < targetVersion) {
    const migration = bySourceVersion.get(version);
    if (!migration) {
      throw new Error(
        `No snapshot migration is registered for schema ${version}->${version + 1}.`
      );
    }
    snapshot = migration.migrate(structuredClone(snapshot));
    const migratedVersion = readSchemaVersion(snapshot);
    if (migratedVersion !== migration.toVersion) {
      throw new Error(
        `Snapshot migration ${migration.fromVersion}->${migration.toVersion} produced schema ` +
        `${migratedVersion}.`
      );
    }
    version = migratedVersion;
  }

  return snapshot;
}
