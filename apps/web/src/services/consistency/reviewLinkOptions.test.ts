import {describe, expect, it} from 'vitest';
import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import {
  buildCharacterCategoryIds,
  buildCharacterLoreEntityIdByCharacterId,
  buildCloseUnknownLinkOptions,
  buildKnownConsistencyEntities,
  buildUnknownLinkOptions,
  namesLikelyReferToSameCharacter
} from './reviewLinkOptions';

const categories: EntityCategory[] = [
  {id: 'characters', projectId: 'project', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1},
  {id: 'places', projectId: 'project', name: 'Places', slug: 'locations', fieldSchema: [], createdAt: 1}
];
const characters: Character[] = [
  {id: 'character', projectId: 'project', name: 'Harrison Vale', fields: {}, createdAt: 1, updatedAt: 1},
  {id: 'other', projectId: 'project', name: 'Mira', fields: {}, createdAt: 1, updatedAt: 1}
];
const entities: WorldEntity[] = [
  {id: 'harrison', projectId: 'project', categoryId: 'characters', name: 'Harrison Vale', fields: {}, links: [], createdAt: 1, updatedAt: 1},
  {id: 'citadel', projectId: 'project', categoryId: 'places', name: 'Citadel', fields: {}, links: [], createdAt: 1, updatedAt: 1}
];

describe('review link option models', () => {
  it('links matching character tools records to character canon', () => {
    const characterCategoryIds = buildCharacterCategoryIds(categories);
    const links = buildCharacterLoreEntityIdByCharacterId({
      characterCategoryIds,
      characters,
      entities
    });
    expect(links.get('character')).toBe('harrison');
    expect(namesLikelyReferToSameCharacter('Harrison', 'Harrison Vale')).toBe(true);

    expect(
      buildKnownConsistencyEntities({
        entities,
        aliases: [
          {id: 'alias', projectId: 'project', targetId: 'character', targetType: 'character', alias: 'Harry', createdAt: 1, updatedAt: 1}
        ],
        characterLoreEntityIdByCharacterId: links
      })
    ).toContainEqual({id: 'harrison', name: 'Harry', type: 'entity'});
  });

  it('ranks exact matches first and avoids duplicate character targets', () => {
    const characterCategoryIds = buildCharacterCategoryIds(categories);
    const links = buildCharacterLoreEntityIdByCharacterId({
      characterCategoryIds,
      characters,
      entities
    });
    const options = buildUnknownLinkOptions({
      categories,
      characterCategoryIds,
      characterLoreEntityIdByCharacterId: links,
      characters,
      consistencyReviewItems: [],
      entities,
      unknownGuardrailIssues: [
        {code: 'UNKNOWN_ENTITY', severity: 'blocking', message: 'Unknown', surface: 'Citadel'}
      ]
    });
    expect(options.Citadel[0]).toMatchObject({id: 'citadel', type: 'entity'});
    expect(options.Citadel.some((option) => option.id === 'character')).toBe(false);
  });

  it('keeps only close and short-form matches for quick linking', () => {
    const close = buildCloseUnknownLinkOptions({
      unknownGuardrailIssues: [
        {code: 'UNKNOWN_ENTITY', severity: 'blocking', message: 'Unknown', surface: 'Harrison'}
      ],
      unknownLinkOptions: {
        Harrison: [
          {id: 'harrison', name: 'Harrison Vale', type: 'entity', label: 'Characters'},
          {id: 'citadel', name: 'Citadel', type: 'entity', label: 'Places'}
        ]
      }
    });
    expect(close.Harrison.map((option) => option.id)).toEqual(['harrison']);
  });
});
