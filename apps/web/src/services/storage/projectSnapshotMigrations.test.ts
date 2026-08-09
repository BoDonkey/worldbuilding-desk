import {describe, expect, it} from 'vitest';
import {normalizeProjectSnapshot} from './projectBackupImport';
import {migrateProjectSnapshotPayload} from './projectSnapshotMigrations';

describe('migrateProjectSnapshotPayload', () => {
  it('accepts the current snapshot schema unchanged', () => {
    const snapshot = {schemaVersion: 1, project: {id: 'project-1'}};
    expect(migrateProjectSnapshotPayload(snapshot)).toBe(snapshot);
  });

  it('rejects snapshots created by a newer app with an actionable error', () => {
    expect(() => migrateProjectSnapshotPayload({schemaVersion: 2})).toThrow(
      'Update the app before importing it.'
    );
    expect(() => normalizeProjectSnapshot({schemaVersion: 2})).toThrow(
      'Update the app before importing it.'
    );
    expect(() =>
      normalizeProjectSnapshot({
        schemaVersion: 1,
        project: {id: 'project-1', name: 'Future', storageSchemaVersion: 2}
      })
    ).toThrow('Backup project data uses storage schema 2');
  });

  it('runs an explicit contiguous snapshot migration chain', () => {
    const migrated = migrateProjectSnapshotPayload(
      {schemaVersion: 1, values: ['original']},
      [
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: (snapshot) => ({
            ...snapshot,
            schemaVersion: 2,
            values: [...(snapshot.values as string[]), 'v2']
          })
        },
        {
          fromVersion: 2,
          toVersion: 3,
          migrate: (snapshot) => ({
            ...snapshot,
            schemaVersion: 3,
            values: [...(snapshot.values as string[]), 'v3']
          })
        }
      ],
      3
    );

    expect(migrated).toEqual({schemaVersion: 3, values: ['original', 'v2', 'v3']});
  });

  it('rejects a migration that does not write its declared target version', () => {
    expect(() =>
      migrateProjectSnapshotPayload(
        {schemaVersion: 1},
        [
          {
            fromVersion: 1,
            toVersion: 2,
            migrate: (snapshot) => snapshot
          }
        ],
        2
      )
    ).toThrow('produced schema 1');
  });
});
