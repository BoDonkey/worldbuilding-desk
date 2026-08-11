import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import {CHARACTER_SHEET_STORE_NAME, openDb} from '../../db';
import {
  classifyCharacterIdentities,
  createCharacterLinkResolver,
  inferLegacyCategoryKind
} from './characterIdentity';
import {
  buildCharacterIdentityResolutionQueue,
  getCharacterIdentityResolutionKey,
  resolveCharacterIdentity
} from './characterIdentityResolution';
import {getCharacterSheet} from './characterSheetService';

const category = (overrides: Partial<EntityCategory> = {}): EntityCategory => ({
  id: 'characters',
  projectId: 'project-1',
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [],
  createdAt: 1,
  ...overrides
});

const entity = (id: string, name: string): WorldEntity => ({
  id,
  projectId: 'project-1',
  categoryId: 'characters',
  name,
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1
});

const character = (id: string, name: string, entityId?: string): Character => ({
  id,
  projectId: 'project-1',
  entityId,
  name,
  fields: {},
  createdAt: 1,
  updatedAt: 1
});

const sheet = (
  id: string,
  name: string,
  options: Partial<CharacterSheet> = {}
): CharacterSheet => ({
  id,
  projectId: 'project-1',
  name,
  level: 1,
  experience: 0,
  stats: [],
  resources: [],
  inventory: [],
  createdAt: 1,
  updatedAt: 1,
  ...options
});

describe('character identity classifier', () => {
  it('derives legacy category kinds from the broad historical hint set', () => {
    expect(inferLegacyCategoryKind({name: 'Important People', slug: 'cast'})).toBe(
      'character'
    );
    expect(inferLegacyCategoryKind({name: 'Characters', slug: 'characters', kind: 'general'})).toBe(
      'general'
    );
    expect(inferLegacyCategoryKind({name: 'Locations', slug: 'locations'})).toBe(
      'general'
    );
  });

  it('auto-links only exact normalized names that are unique on both sides', () => {
    const result = classifyCharacterIdentities({
      projectId: 'project-1',
      categories: [category()],
      entities: [entity('entity-mira', 'Mira Voss'), entity('entity-tam-1', 'Tam'), entity('entity-tam-2', ' Tam ')],
      characters: [character('character-mira', '  MIRA   VOSS '), character('character-tam', 'Tam'), character('character-orphan', 'Orin')],
      sheets: [sheet('sheet-mira', 'Mira', {characterId: 'character-mira'}), sheet('sheet-orphan', 'No Canon')],
      generatedAt: 10
    });

    expect(result.characters.find((record) => record.id === 'character-mira')?.entityId).toBe(
      'entity-mira'
    );
    expect(result.characters.find((record) => record.id === 'character-tam')?.entityId).toBeUndefined();
    expect(result.characters.find((record) => record.id === 'character-orphan')?.entityId).toBeUndefined();
    expect(result.sheets.find((record) => record.id === 'sheet-mira')?.characterEntityId).toBe(
      'entity-mira'
    );
    expect(result.sheets.find((record) => record.id === 'sheet-orphan')?.characterEntityId).toBeUndefined();
    expect(result.report.records.find((record) => record.recordId === 'character-tam')?.classification).toBe(
      'ambiguous-collision'
    );
    expect(result.report.records.find((record) => record.recordId === 'character-orphan')?.classification).toBe(
      'tools-only-orphan'
    );
    expect(result.report.records.find((record) => record.recordId === 'sheet-orphan')?.classification).toBe(
      'sheet-only'
    );
    expect(result.report.classifiedRecordCount).toBe(
      result.report.sourceCounts.characterEntities +
        result.report.sourceCounts.characters +
        result.report.sourceCounts.sheets
    );
    expect(
      Object.values(result.report.countsByClassification).reduce((sum, count) => sum + count, 0)
    ).toBe(result.report.classifiedRecordCount);
  });

  it('resolves explicit links and persisted legacy actor IDs without depending on names', () => {
    const categories = [category()];
    const entities = [entity('entity-mira', 'Mira Renamed')];
    const characters = [character('character-mira', 'Old Mira', 'entity-mira')];
    const sheets = [
      sheet('sheet-mira', 'Old Build Name', {
        characterId: 'character-mira',
        characterEntityId: 'entity-mira'
      })
    ];
    const resolver = createCharacterLinkResolver({
      categories,
      entities,
      characters,
      sheets,
      actorResolutions: [
        {
          id: 'resolution-legacy',
          projectId: 'project-1',
          legacyActorId: 'very-old-actor',
          legacyActorType: 'character',
          entityId: 'entity-mira',
          createdAt: 1
        }
      ]
    });

    expect(resolver.resolveEntityId({characterId: 'character-mira'})).toBe('entity-mira');
    expect(resolver.resolveEntityId({sheetId: 'sheet-mira'})).toBe('entity-mira');
    expect(resolver.resolveEntityId({actorId: 'very-old-actor'})).toBe('entity-mira');
    expect(resolver.getCharacter('entity-mira')?.id).toBe('character-mira');
    expect(resolver.getSheet('entity-mira')?.id).toBe('sheet-mira');
  });
});

describe('character identity resolution queue', () => {
  it('keeps historically ambiguous records queued until an explicit decision', () => {
    const categories = [category()];
    const entities = [entity('entity-tam', 'Tam')];
    const characters = [character('character-tam', 'Tam')];
    const report = classifyCharacterIdentities({
      projectId: 'project-1',
      categories,
      entities: [entity('entity-tam-1', 'Tam'), entity('entity-tam-2', 'Tam')],
      characters,
      sheets: [],
      generatedAt: 1
    }).report;

    const queue = buildCharacterIdentityResolutionQueue({
      projectId: 'project-1',
      categories,
      entities,
      characters,
      sheets: [],
      report
    });

    expect(queue).toMatchObject([
      {
        key: 'character:character-tam',
        classification: 'ambiguous-collision',
        name: 'Tam'
      }
    ]);
  });

  it('removes linked and author-dismissed records without deleting their source data', () => {
    const categories = [category()];
    const entities = [entity('entity-mira', 'Mira')];
    const unresolvedCharacter = character('character-tam', 'Tam');
    const unresolvedSheet = sheet('sheet-orin', 'Orin');
    const report = classifyCharacterIdentities({
      projectId: 'project-1',
      categories,
      entities,
      characters: [unresolvedCharacter],
      sheets: [unresolvedSheet],
      generatedAt: 1
    }).report;

    const queue = buildCharacterIdentityResolutionQueue({
      projectId: 'project-1',
      categories,
      entities,
      characters: [{...unresolvedCharacter, entityId: 'entity-mira'}],
      sheets: [unresolvedSheet],
      report,
      keptSeparateKeys: [getCharacterIdentityResolutionKey('sheet', 'sheet-orin')]
    });

    expect(queue).toEqual([]);
    expect(unresolvedCharacter.name).toBe('Tam');
    expect(unresolvedSheet.name).toBe('Orin');
  });

  it('does not group unrelated sheet-only records into one legacy family', async () => {
    const projectId = 'resolution-sheet-family-project';
    const sourceSheet = sheet('resolution-source-sheet', 'Orin', {projectId});
    const unrelatedSheet = sheet('resolution-unrelated-sheet', 'Aria', {projectId});
    const db = await openDb();
    const tx = db.transaction([CHARACTER_SHEET_STORE_NAME], 'readwrite');
    tx.objectStore(CHARACTER_SHEET_STORE_NAME).put(sourceSheet);
    tx.objectStore(CHARACTER_SHEET_STORE_NAME).put(unrelatedSheet);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();

    await resolveCharacterIdentity({
      projectId,
      item: {recordType: 'sheet', recordId: sourceSheet.id},
      entityId: 'resolution-orin-entity',
      entityToCreate: {
        ...entity('resolution-orin-entity', 'Orin'),
        projectId
      },
      resolvedAt: 2
    });

    expect((await getCharacterSheet(sourceSheet.id))?.characterEntityId).toBe(
      'resolution-orin-entity'
    );
    expect((await getCharacterSheet(unrelatedSheet.id))?.characterEntityId).toBeUndefined();
  });
});
