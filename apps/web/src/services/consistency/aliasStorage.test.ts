import {describe, expect, it} from 'vitest';
import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from './aliasStorage';
import {resolveCharacterAliasEntityMigrations} from './aliasStorage';

const makeAlias = (overrides: Partial<ConsistencyAlias>): ConsistencyAlias => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  targetId: overrides.targetId ?? 'target-1',
  targetType: overrides.targetType ?? 'character',
  entityId: overrides.entityId,
  alias: overrides.alias ?? 'Alias',
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1
});

const makeCharacter = (overrides: Partial<Character>): Character => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  name: overrides.name ?? 'Garcia de Terra',
  description: overrides.description,
  characterStyleId: overrides.characterStyleId,
  fields: overrides.fields ?? {},
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1
});

const makeEntity = (overrides: Partial<WorldEntity>): WorldEntity => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  categoryId: overrides.categoryId ?? 'characters',
  name: overrides.name ?? 'Garcia de Terra',
  fields: overrides.fields ?? {},
  isNew: overrides.isNew ?? false,
  needsCompletion: overrides.needsCompletion ?? false,
  links: overrides.links ?? [],
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  aliasesReviewedAt: overrides.aliasesReviewedAt
});

const makeCategory = (overrides: Partial<EntityCategory>): EntityCategory => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  name: overrides.name ?? 'Characters',
  slug: overrides.slug ?? 'characters',
  fieldSchema: overrides.fieldSchema ?? [],
  createdAt: overrides.createdAt ?? 1
});

describe('resolveCharacterAliasEntityMigrations', () => {
  it('migrates a character alias onto the linked world bible character entity', () => {
    const alias = makeAlias({
      id: 'alias-1',
      targetId: 'character-1',
      targetType: 'character',
      alias: 'Garcia'
    });
    const migrations = resolveCharacterAliasEntityMigrations({
      aliases: [alias],
      characters: [makeCharacter({id: 'character-1', name: 'Garcia de Terra'})],
      entities: [makeEntity({id: 'entity-1', categoryId: 'cat-characters', name: 'Garcia de Terra'})],
      categories: [makeCategory({id: 'cat-characters', slug: 'characters'})]
    });

    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.from.id).toBe('alias-1');
    expect(migrations[0]?.to).toMatchObject({
      id: 'alias-1',
      targetId: 'entity-1',
      targetType: 'entity',
      entityId: 'entity-1',
      alias: 'Garcia'
    });
  });

  it('drops the character alias when the canonical entity alias already exists', () => {
    const migrations = resolveCharacterAliasEntityMigrations({
      aliases: [
        makeAlias({
          id: 'alias-character',
          targetId: 'character-1',
          targetType: 'character',
          alias: 'Garcia'
        }),
        makeAlias({
          id: 'alias-entity',
          targetId: 'entity-1',
          targetType: 'entity',
          entityId: 'entity-1',
          alias: 'Garcia'
        })
      ],
      characters: [makeCharacter({id: 'character-1', name: 'Garcia de Terra'})],
      entities: [makeEntity({id: 'entity-1', categoryId: 'cat-characters', name: 'Garcia de Terra'})],
      categories: [makeCategory({id: 'cat-characters', slug: 'characters'})]
    });

    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.from.id).toBe('alias-character');
    expect(migrations[0]?.to).toBeNull();
  });

  it('skips migration when the matching world bible character entity is ambiguous', () => {
    const migrations = resolveCharacterAliasEntityMigrations({
      aliases: [
        makeAlias({
          id: 'alias-1',
          targetId: 'character-1',
          targetType: 'character',
          alias: 'Garcia'
        })
      ],
      characters: [makeCharacter({id: 'character-1', name: 'Garcia de Terra'})],
      entities: [
        makeEntity({id: 'entity-1', categoryId: 'cat-characters', name: 'Garcia de Terra'}),
        makeEntity({id: 'entity-2', categoryId: 'cat-characters', name: 'Garcia de Terra'})
      ],
      categories: [makeCategory({id: 'cat-characters', slug: 'characters'})]
    });

    expect(migrations).toHaveLength(0);
  });
});
