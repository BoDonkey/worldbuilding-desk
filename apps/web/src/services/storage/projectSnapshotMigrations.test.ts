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
    const snapshot = {schemaVersion: 9, project: {id: 'project-1'}};
    expect(migrateProjectSnapshotPayload(snapshot)).toBe(snapshot);
  });

  it('preserves stable canon fact scene boundaries while migrating schema 5', () => {
    const migrated = migrateProjectSnapshotPayload({
      schemaVersion: 5,
      project: {id: 'project-1', storageSchemaVersion: 5},
      data: {
        canonicalFacts: [{
          id: 'fact-1',
          projectId: 'project-1',
          validFromSceneId: 'scene-2',
          validUntilSceneId: 'scene-4'
        }]
      }
    });
    expect(migrated).toMatchObject({
      schemaVersion: 9,
      project: {storageSchemaVersion: 7},
      data: {
        canonicalFacts: [{validFromSceneId: 'scene-2', validUntilSceneId: 'scene-4'}],
        worldCanvases: []
      }
    });
  });

  it('adds an empty World Canvas collection while migrating schema 6', () => {
    const snapshot = normalizeProjectSnapshot({
      schemaVersion: 6,
      generatedAt: 10,
      projectId: 'project-1',
      project: {
        id: 'project-1',
        name: 'Pre-canvas backup',
        storageSchemaVersion: 6,
        createdAt: 1,
        updatedAt: 1
      },
      data: {},
      counts: {}
    });

    expect(snapshot.schemaVersion).toBe(9);
    expect(snapshot.data.worldCanvases).toEqual([]);
    expect(snapshot.counts.worldCanvases).toBe(0);
  });

  it('migrates schema-7 Canvas notes, links, and thread statuses losslessly', () => {
    const snapshot = normalizeProjectSnapshot({
      schemaVersion: 7,
      project: {id: 'project-1', name: 'Legacy Canvas', storageSchemaVersion: 6, createdAt: 1, updatedAt: 1},
      data: {worldCanvases: [{
        id: 'project-1', projectId: 'project-1', premise: 'A city forgets.',
        lenses: [{kind: 'places', note: 'The crater sings.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1'], updatedAt: 4}],
        questions: [{id: 'q1', text: 'The river remembers.', status: 'answered', createdAt: 2, updatedAt: 3}],
        createdAt: 1, updatedAt: 5
      }]},
      counts: {worldCanvases: 1}
    });

    expect(snapshot.schemaVersion).toBe(9);
    expect(snapshot.data.worldCanvases[0]).toMatchObject({schemaVersion: 2, premise: 'A city forgets.', openThreads: [{id: 'q1', text: 'The river remembers.', status: 'settled'}]});
    expect(snapshot.data.worldCanvases[0].lenses[0].sketches[0]).toMatchObject({text: 'The crater sings.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1'], createdAt: 4, updatedAt: 4});
  });

  it('quarantines invalid ruleset rules while migrating schema 8 without dropping them', () => {
    const invalidRule = {id: 'rule-bad', name: 'Half a rule', category: 'not-a-category'};
    const snapshot = normalizeProjectSnapshot({
      schemaVersion: 8,
      project: {id: 'project-1', name: 'Rules', storageSchemaVersion: 6, createdAt: 1, updatedAt: 1},
      data: {ruleset: {
        id: 'ruleset-1', projectId: 'project-1', name: 'Rules', version: '1.0.0',
        statDefinitions: [], resourceDefinitions: [], itemTemplates: [], statusTemplates: [],
        rules: [{id: 'rule-ok', name: 'Long Rest', category: 'time'}, invalidRule],
        createdAt: 1, updatedAt: 1
      }},
      counts: {}
    });

    expect(snapshot.schemaVersion).toBe(9);
    expect(snapshot.project.storageSchemaVersion).toBe(7);
    expect(snapshot.data.ruleset?.rules).toEqual([
      {id: 'rule-ok', name: 'Long Rest', category: 'time', enabled: true, priority: 100, tags: [], effects: []}
    ]);
    expect(snapshot.data.ruleset?.quarantinedRules).toEqual([
      {raw: invalidRule, name: 'Half a rule', issues: [expect.stringContaining('category')]}
    ]);
  });

  it('rejects snapshots created by a newer app with an actionable error', () => {
    expect(() => migrateProjectSnapshotPayload({schemaVersion: 10})).toThrow(
      'Update the app before importing it.'
    );
    expect(() => normalizeProjectSnapshot({schemaVersion: 10})).toThrow(
      'Update the app before importing it.'
    );
    expect(() =>
      normalizeProjectSnapshot({
        schemaVersion: 9,
        project: {id: 'project-1', name: 'Future', storageSchemaVersion: 8}
      })
    ).toThrow('Backup project data uses storage schema 8');
  });

  it('classifies v1 character identities and adds complete v2 backup fields', () => {
    const snapshot = normalizeProjectSnapshot(legacySnapshot());

    expect(snapshot.schemaVersion).toBe(9);
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

  it('preserves explicit chapter-card and negative-space links through schema 5', () => {
    const snapshot = normalizeProjectSnapshot({
      schemaVersion: 3,
      project: {
        id: 'project-1',
        name: 'Linked plan',
        storageSchemaVersion: 3,
        createdAt: 1,
        updatedAt: 1
      },
      data: {
        categories: [{
          id: 'problems',
          projectId: 'project-1',
          kind: 'general',
          recordType: 'system-negative-space',
          name: 'Problems Power Cannot Solve',
          slug: 'problems-power-cannot-solve',
          fieldSchema: [],
          createdAt: 1
        }],
        entities: [{
          id: 'grief',
          projectId: 'project-1',
          categoryId: 'problems',
          name: 'Grief',
          fields: {},
          systemNegativeSpace: {status: 'worsening', sceneIds: ['scene-2']},
          links: [],
          createdAt: 1,
          updatedAt: 1
        }],
        corkboardChapterCards: [{
          id: 'card-1',
          projectId: 'project-1',
          title: 'Chapter One',
          summary: '',
          status: 'planned',
          order: 0,
          sceneIds: ['scene-1', 'scene-2'],
          plotPoints: [],
          createdAt: 1,
          updatedAt: 1
        }]
      },
      counts: {corkboardChapterCards: 1}
    });

    expect(snapshot.schemaVersion).toBe(9);
    expect(snapshot.project.storageSchemaVersion).toBe(7);
    expect(snapshot.data.corkboardChapterCards[0].sceneIds).toEqual(['scene-1', 'scene-2']);
    expect(snapshot.data.categories[0].recordType).toBe('system-negative-space');
    expect(snapshot.data.entities[0].systemNegativeSpace).toEqual({
      status: 'worsening',
      sceneIds: ['scene-2']
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
    const replay = (
      sheet: CharacterSheet,
      events: StateMutationEvent[],
      actorResolutions = after.data.actorResolutions.slice(0, 0)
    ) =>
      replayCharacterState({
        sheet,
        ruleset,
        events,
        target: {sheetId: sheet.id, characterId: sheet.characterId},
        actorResolutions,
        upToSceneOrder: 1
      });

    const beforeReplay = replay(
      before.data.characterSheets[0] as CharacterSheet,
      before.data.stateMutationEvents as StateMutationEvent[]
    );
    const afterReplay = replay(
      after.data.characterSheets[0],
      after.data.stateMutationEvents,
      after.data.actorResolutions
    );

    expect(afterReplay.actorId).toBe('entity-mira');
    expect(beforeReplay.actorId).toBe('character-mira');
    expect({...afterReplay, actorId: beforeReplay.actorId}).toEqual(beforeReplay);
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
