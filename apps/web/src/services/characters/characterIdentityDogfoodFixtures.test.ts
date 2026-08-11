import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {CharacterTransferPayload} from './characterTransferService';
import {
  isCharacterTransferPayload,
  prepareCharacterTransferImport
} from './characterTransferService';
import {buildCharacterIdentityResolutionQueue} from './characterIdentityResolution';

const readFixture = (name: string): CharacterTransferPayload => {
  const value: unknown = JSON.parse(
    readFileSync(
      new URL(
        `../../../../../fixtures/trust-dogfood/character-identity/${name}`,
        import.meta.url
      ),
      'utf8'
    )
  );
  expect(isCharacterTransferPayload(value)).toBe(true);
  return value as CharacterTransferPayload;
};

describe('character identity dogfood fixtures', () => {
  it('keeps the legacy Tam package unresolved and conserves its trust-boundary note', () => {
    const prepared = prepareCharacterTransferImport({
      payload: readFixture('legacy-tam-tools-only.v1.json'),
      projectId: 'dogfood-target',
      includeSheets: false,
      existingCategories: [],
      existingEntities: [],
      generatedAt: 20
    });

    expect(prepared.entities).toEqual([]);
    expect(prepared.characters).toHaveLength(1);
    expect(prepared.characters[0]).toMatchObject({
      name: 'Tam',
      entityId: undefined
    });
    expect(prepared.characters[0].description).toContain('Do not treat this as canon');
    expect(prepared.identityReport.records).toMatchObject([
      {name: 'Tam', classification: 'tools-only-orphan'}
    ]);
  });

  it('classifies every matrix record without silently merging ambiguous duplicates', () => {
    const prepared = prepareCharacterTransferImport({
      payload: readFixture('legacy-identity-matrix.v1.json'),
      projectId: 'dogfood-target',
      includeSheets: true,
      existingCategories: [
        {
          id: 'characters',
          projectId: 'dogfood-target',
          kind: 'character',
          name: 'Characters',
          slug: 'characters',
          fieldSchema: [],
          createdAt: 1
        }
      ],
      existingEntities: [
        {
          id: 'entity-maren',
          projectId: 'dogfood-target',
          categoryId: 'characters',
          name: 'Maren Kestrel',
          fields: {},
          links: [],
          createdAt: 1,
          updatedAt: 1
        }
      ],
      generatedAt: 20
    });

    const classifications = prepared.identityReport.records.map((record) => ({
      name: record.name,
      type: record.recordType,
      classification: record.classification
    }));
    expect(classifications).toEqual(
      expect.arrayContaining([
        {name: 'Maren Kestrel', type: 'character', classification: 'ambiguous-collision'},
        {name: 'Maren Kestrel', type: 'character', classification: 'ambiguous-collision'},
        {name: 'Pell', type: 'character', classification: 'tools-only-orphan'},
        {name: 'Orin', type: 'sheet', classification: 'sheet-only'}
      ])
    );
    expect(prepared.identityReport.classifiedRecordCount).toBe(5);
    expect(
      classifications.reduce<Record<string, number>>((counts, record) => {
        counts[record.classification] = (counts[record.classification] ?? 0) + 1;
        return counts;
      }, {})
    ).toEqual({
      'ambiguous-collision': 3,
      'tools-only-orphan': 1,
      'sheet-only': 1
    });
    expect(prepared.characters.every((record) => record.entityId === undefined)).toBe(true);
    expect(prepared.characterSheets[0].characterEntityId).toBeUndefined();
    expect(
      buildCharacterIdentityResolutionQueue({
        projectId: 'dogfood-target',
        categories: prepared.categories,
        entities: prepared.entities,
        characters: prepared.characters,
        sheets: prepared.characterSheets,
        report: prepared.identityReport
      })
    ).toHaveLength(4);
  });
});
