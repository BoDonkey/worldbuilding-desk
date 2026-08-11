import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {
  createCharacterTransferPayload,
  prepareCharacterTransferImport,
  type CharacterTransferPayloadV1
} from './characterTransferService';

const category = (projectId = 'source'): EntityCategory => ({
  id: 'category-characters',
  projectId,
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [],
  createdAt: 1
});

const entity = (projectId = 'source'): WorldEntity => ({
  id: 'entity-mira',
  projectId,
  categoryId: 'category-characters',
  name: 'Mira Voss',
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1
});

const character = (entityId?: string): Character => ({
  id: 'character-mira',
  projectId: 'source',
  entityId,
  name: 'Mira Voss',
  fields: {role: 'Cartographer'},
  createdAt: 1,
  updatedAt: 1
});

const sheet = (characterEntityId?: string): CharacterSheet => ({
  id: 'sheet-mira',
  projectId: 'source',
  characterId: 'character-mira',
  characterEntityId,
  name: 'Mira Voss',
  level: 2,
  experience: 10,
  stats: [],
  resources: [],
  inventory: [],
  createdAt: 1,
  updatedAt: 1
});

const alias: ConsistencyAlias = {
  id: 'alias-mira',
  projectId: 'source',
  targetType: 'character',
  targetId: 'character-mira',
  alias: 'The Wayfinder',
  createdAt: 1,
  updatedAt: 1
};

const fact: CanonicalFact = {
  id: 'fact-mira',
  projectId: 'source',
  targetType: 'character',
  targetId: 'character-mira',
  targetName: 'Mira Voss',
  factType: 'occupation',
  value: 'Cartographer',
  acceptedAt: 1,
  updatedAt: 1
};

describe('character package transfer', () => {
  it('exports v2 with canonical identity records and rebases legacy character facts', () => {
    const payload = createCharacterTransferPayload({
      projectName: 'Source',
      includeSheets: true,
      exportedAt: 10,
      categories: [category()],
      entities: [entity()],
      aliases: [alias],
      canonicalFacts: [fact],
      characters: [character('entity-mira')],
      characterSheets: [sheet('entity-mira')]
    });

    expect(payload.schemaVersion).toBe(2);
    expect(payload.packageType).toBe('full');
    expect(payload.data.categories).toHaveLength(1);
    expect(payload.data.entities).toHaveLength(1);
    expect(payload.data.characters[0].entityId).toBe('entity-mira');
    expect(payload.data.characterSheets[0].characterEntityId).toBe('entity-mira');
    expect(payload.data.consistencyAliases[0]).toMatchObject({
      targetType: 'entity',
      targetId: 'entity-mira',
      entityId: 'entity-mira'
    });
    expect(payload.data.canonicalFacts[0]).toMatchObject({
      targetType: 'entity',
      targetId: 'entity-mira'
    });
  });

  it('imports v1 through exact-unique classification and conserves unresolved records', () => {
    const payload: CharacterTransferPayloadV1 = {
      schemaVersion: 1,
      kind: 'characters',
      packageType: 'full',
      exportedAt: 10,
      sourceProjectName: 'Legacy',
      data: {
        characters: [character(), {...character(), id: 'character-tam', name: 'Tam'}],
        characterSheets: [sheet()]
      }
    };
    const prepared = prepareCharacterTransferImport({
      payload,
      projectId: 'target',
      includeSheets: true,
      existingCategories: [category('target')],
      existingEntities: [entity('target')],
      generatedAt: 20
    });

    const mira = prepared.characters.find((record) => record.name === 'Mira Voss');
    const tam = prepared.characters.find((record) => record.name === 'Tam');
    expect(mira?.entityId).toBe('entity-mira');
    expect(tam?.entityId).toBeUndefined();
    expect(prepared.characterSheets[0].characterId).toBe(mira?.id);
    expect(prepared.characterSheets[0].characterEntityId).toBe('entity-mira');
    expect(prepared.actorResolutions).toHaveLength(2);
    expect(prepared.identityReport.classifiedRecordCount).toBe(4);
    expect(
      prepared.identityReport.records.find((record) => record.name === 'Tam')?.classification
    ).toBe('tools-only-orphan');
  });

  it('conserves unresolved character-targeted aliases and facts through v2 remapping', () => {
    const orphan = {...character(), id: 'character-tam', name: 'Tam'};
    const payload = createCharacterTransferPayload({
      projectName: 'Source',
      includeSheets: false,
      exportedAt: 10,
      categories: [category()],
      entities: [entity()],
      aliases: [{...alias, id: 'alias-tam', targetId: orphan.id, alias: 'T'}],
      canonicalFacts: [{...fact, id: 'fact-tam', targetId: orphan.id, targetName: 'Tam'}],
      characters: [orphan],
      characterSheets: []
    });

    expect(payload.data.entities).toEqual([]);
    expect(payload.data.consistencyAliases[0]).toMatchObject({
      targetType: 'character',
      targetId: orphan.id
    });
    expect(payload.data.canonicalFacts[0]).toMatchObject({
      targetType: 'character',
      targetId: orphan.id
    });

    const prepared = prepareCharacterTransferImport({
      payload,
      projectId: 'target',
      includeSheets: false,
      existingCategories: [],
      existingEntities: [],
      generatedAt: 20
    });
    expect(prepared.characters[0].entityId).toBeUndefined();
    expect(prepared.consistencyAliases[0]).toMatchObject({
      targetType: 'character',
      targetId: prepared.characters[0].id
    });
    expect(prepared.canonicalFacts[0]).toMatchObject({
      targetType: 'character',
      targetId: prepared.characters[0].id
    });
  });

  it('round-trips v2 counts while remapping every identity link to the target project', () => {
    const payload = createCharacterTransferPayload({
      projectName: 'Source',
      includeSheets: true,
      exportedAt: 10,
      categories: [category()],
      entities: [entity()],
      aliases: [alias],
      canonicalFacts: [fact],
      characters: [character('entity-mira')],
      characterSheets: [sheet('entity-mira')]
    });
    const prepared = prepareCharacterTransferImport({
      payload,
      projectId: 'target',
      includeSheets: true,
      existingCategories: [{...category('target'), id: 'general-characters', kind: 'general'}],
      existingEntities: [],
      generatedAt: 20
    });

    expect(prepared.categories).toHaveLength(payload.data.categories.length);
    expect(prepared.entities).toHaveLength(payload.data.entities.length);
    expect(prepared.consistencyAliases).toHaveLength(payload.data.consistencyAliases.length);
    expect(prepared.canonicalFacts).toHaveLength(payload.data.canonicalFacts.length);
    expect(prepared.characters).toHaveLength(payload.data.characters.length);
    expect(prepared.characterSheets).toHaveLength(payload.data.characterSheets.length);

    const importedEntityId = prepared.entities[0].id;
    expect(importedEntityId).not.toBe('entity-mira');
    expect(prepared.entities[0].projectId).toBe('target');
    expect(prepared.entities[0].categoryId).toBe(prepared.categories[0].id);
    expect(prepared.entities[0].categoryId).not.toBe('general-characters');
    expect(prepared.characters[0].entityId).toBe(importedEntityId);
    expect(prepared.characterSheets[0].characterEntityId).toBe(importedEntityId);
    expect(prepared.consistencyAliases[0]).toMatchObject({
      projectId: 'target',
      targetType: 'entity',
      targetId: importedEntityId
    });
    expect(prepared.canonicalFacts[0]).toMatchObject({
      projectId: 'target',
      targetType: 'entity',
      targetId: importedEntityId
    });
  });
});
