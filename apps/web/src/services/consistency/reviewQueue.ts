import type {WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from './aliasStorage';

export type ReviewQueueReason = 'needsCompletion' | 'aliasFollowUp';

interface BuildWorldReviewQueueOptions {
  excludedCategoryIds?: string[];
}

export interface ReviewQueueItem {
  entity: WorldEntity;
  aliasCount: number;
  latestAliasUpdateAt: number | null;
  reasons: ReviewQueueReason[];
}

export function buildWorldReviewQueue(
  entities: WorldEntity[],
  aliases: ConsistencyAlias[],
  options: BuildWorldReviewQueueOptions = {}
): ReviewQueueItem[] {
  const excludedCategoryIds = new Set(options.excludedCategoryIds ?? []);
  return entities
    .filter((entity) => !excludedCategoryIds.has(entity.categoryId))
    .map((entity) => {
      const entityAliases = Array.from(
        new Map(
          aliases
            .filter((alias) => alias.targetType === 'entity' && alias.targetId === entity.id)
            .map((alias) => [alias.alias.trim().toLowerCase(), alias])
        ).values()
      );
      const aliasCount = entityAliases.length;
      const latestAliasUpdateAt =
        entityAliases.length > 0
          ? Math.max(...entityAliases.map((alias) => alias.updatedAt ?? alias.createdAt))
          : null;
      const reasons: ReviewQueueReason[] = [];
      if (entity.needsCompletion) {
        reasons.push('needsCompletion');
      }
      if (latestAliasUpdateAt !== null && latestAliasUpdateAt > (entity.aliasesReviewedAt ?? 0)) {
        reasons.push('aliasFollowUp');
      }
      return {entity, aliasCount, latestAliasUpdateAt, reasons};
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => {
      if (a.entity.needsCompletion !== b.entity.needsCompletion) {
        return a.entity.needsCompletion ? -1 : 1;
      }
      return a.entity.name.localeCompare(b.entity.name);
    });
}
