import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {replayCharacterState} from '../state/stateReplay';
import {normalizeProjectSnapshot} from './projectBackupImport';
import {migrateProjectSnapshotPayload} from './projectSnapshotMigrations';

const legacySnapshot = () => ({
  schemaVersion: 1,
  generatedAt: 10,
  projectId: 'project-1',
  project: {
    id: 'project-1',
    name: 'Legacy',
    storageSchemaVersion: 1,
    createdAt: 1,
    updatedAt: 1
  },
  data: {
    categories: [
      {
        id: 'characters',
        projectId: 'project-1',
        name: 'Characters',
        slug: 'characters',
        fieldSchema: [],
        createdAt: 1
      }
    ],
    entities: [
      {
        id: 'entity-mira',
        projectId: 'project-1',
        categoryId: 'characters',
        name: 'Mira Voss',
        fields: {},
        links: [],
        createdAt: 1,
        updatedAt: 1
      }
    ],
    characters: [
      {
        id: 'character-mira',
        projectId: 'project-1',
        name: ' mira  voss ',
        fields: {},
        createdAt: 1,
        updatedAt: 1
      }
    ],
    characterSheets: [
      {
        id: 'sheet-mira',
        projectId: 'project-1',
        characterId: 'character-mira',
        name: 'Mira',
        level: 1,
        experience: 0,
        stats: [{definitionId: 'hp', value: 10}],
        resources: [],
        inventory: [],
        createdAt: 1,
        updatedAt: 1
      }
    ],
    stateMutationEvents: [
      {
        id: 'event-1',
        projectId: 'project-1',
        sceneId: 'scene-1',
        sceneOrder: 1,
        sourceRevision: 1,
        sourceHash: 'hash',
        status: 'accepted',
        commands: [
          {type: 'stat_change', actorId: 'sheet-mira', statDefinitionId: 'hp', delta: 2}
        ],
        createdAt: 1
      }
    ]
  },
  counts: {
    categories: 1,
    entities: 1,
    characters: 1,
    characterSheets: 1,
    stateMutationEvents: 1
  }
});

describe('migrateProjectSnapshotPayload', () => {
  it('accepts the current snapshot schema unchanged', () => {
    const snapshot = {schemaVersion: 2, project: {id: 'project-1'}};
    expect(migrateProjectSnapshotPayload(snapshot)).toBe(snapshot);
  });

  it('rejects snapshots created by a newer app with an actionable error', () => {
    expect(() => migrateProjectSnapshotPayload({schemaVersion: 3})).toThrow(
      'Update the app before importing it.'
    );
    expect(() => normalizeProjectSnapshot({schemaVersion: 3})).toThrow(
      'Update the app before importing it.'
    );
    expect(() =>
      normalizeProjectSnapshot({
        schemaVersion: 2,
        project: {id: 'project-1', name: 'Future', storageSchemaVersion: 3}
      })
    ).toThrow('Backup project data uses storage schema 3');
  });

  it('classifies v1 character identities and adds complete v2 backup fields', () => {
    const snapshot = normalizeProjectSnapshot(legacySnapshot());

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.data.categories[0].kind).toBe('character');
    expect(snapshot.data.characters[0].entityId).toBe('entity-mira');
    expect(snapshot.data.characterSheets[0].characterEntityId).toBe('entity-mira');
    expect(snapshot.data.consistencyAliases).toEqual([]);
    expect(snapshot.data.actorResolutions).toHaveLength(2);
    expect(snapshot.data.characterIdentityReports).toHaveLength(1);
    expect(snapshot.counts).toMatchObject({
      consistencyAliases: 0,
      actorResolutions: 2,
      characterIdentityReports: 1
    });
  });

  it('preserves replay byte-for-byte while migrating a v1 snapshot', () => {
    const before = legacySnapshot();
    const after = normalizeProjectSnapshot(before);
    const ruleset: StoredRuleset = {
      id: 'ruleset-1',
      projectId: 'project-1',
      name: 'Rules',
      version: '1',
      statDefinitions: [{id: 'hp', name: 'HP', type: 'number', defaultValue: 10}],
      resourceDefinitions: [],
      rules: [],
      itemTemplates: [],
      statusTemplates: [],
      createdAt: 1,
      updatedAt: 1
    };
    const replay = (sheet: CharacterSheet, events: StateMutationEvent[]) =>
      replayCharacterState({
        sheet,
        ruleset,
        events,
        target: {sheetId: sheet.id, characterId: sheet.characterId},
        upToSceneOrder: 1
      });

    expect(
      replay(
        after.data.characterSheets[0],
        after.data.stateMutationEvents
      )
    ).toEqual(
      replay(
        before.data.characterSheets[0] as CharacterSheet,
        before.data.stateMutationEvents as StateMutationEvent[]
      )
    );
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
