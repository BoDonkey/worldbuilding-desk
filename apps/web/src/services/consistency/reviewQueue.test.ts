import {describe, expect, it} from 'vitest';
import {buildWorldReviewQueue} from './reviewQueue';
import type {ConsistencyAlias} from './aliasStorage';
import type {WorldEntity} from '../../entityTypes';

const makeEntity = (overrides: Partial<WorldEntity>): WorldEntity => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  categoryId: overrides.categoryId ?? 'category-1',
  name: overrides.name ?? 'Untitled',
  fields: overrides.fields ?? {},
  isNew: overrides.isNew ?? false,
  needsCompletion: overrides.needsCompletion ?? false,
  links: overrides.links ?? [],
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  aliasesReviewedAt: overrides.aliasesReviewedAt
});

const makeAlias = (overrides: Partial<ConsistencyAlias>): ConsistencyAlias => ({
  id: overrides.id ?? crypto.randomUUID(),
  projectId: overrides.projectId ?? 'project-1',
  targetId: overrides.targetId ?? 'entity-1',
  targetType: overrides.targetType ?? 'entity',
  entityId: overrides.entityId,
  alias: overrides.alias ?? 'Alias',
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1
});

describe('buildWorldReviewQueue', () => {
  it('includes location records with alias follow-up work', () => {
    const location = makeEntity({
      id: 'location-1',
      categoryId: 'locations',
      name: 'Iron Warrens',
      aliasesReviewedAt: 5
    });
    const alias = makeAlias({
      targetId: 'location-1',
      targetType: 'entity',
      entityId: 'location-1',
      alias: 'Warrens',
      updatedAt: 10
    });

    const queue = buildWorldReviewQueue([location], [alias]);

    expect(queue).toHaveLength(1);
    expect(queue[0]?.entity.id).toBe('location-1');
    expect(queue[0]?.reasons).toContain('aliasFollowUp');
  });
});
