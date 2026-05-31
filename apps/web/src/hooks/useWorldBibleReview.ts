import {useMemo} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {
  buildWorldReviewQueue,
  type ConsistencyAlias,
  type ReviewQueueItem,
  type ReviewQueueReason
} from '../services/consistency';
import {
  buildPotentialEntityMatches,
  buildReviewEntityInsightsById,
  type PotentialEntityMatch,
  type ReviewResolution
} from '../services/worldBible/worldBibleReviewHelpers';

interface UseWorldBibleReviewParams {
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  categories: EntityCategory[];
  aliasMapByEntityId: Map<string, string[]>;
  activeTab: string | null;
  viewMode: 'category' | 'review';
  reviewFilter: 'all' | ReviewQueueReason;
  recommendedFilter: 'all' | ReviewResolution;
  editingId: string | null;
  name: string;
  fieldValues: Record<string, string>;
  selectedEntity: WorldEntity | null;
  alternativeNamesKey: string;
  ignoredEntityMatchKeys?: Set<string>;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
}

export const useWorldBibleReview = ({
  entities,
  aliases,
  categories,
  aliasMapByEntityId,
  activeTab,
  viewMode,
  reviewFilter,
  recommendedFilter,
  editingId,
  name,
  fieldValues,
  selectedEntity,
  alternativeNamesKey,
  ignoredEntityMatchKeys,
  normalizeName,
  parseAlternativeNames
}: UseWorldBibleReviewParams) => {
  const reviewQueue = useMemo<ReviewQueueItem[]>(
    () => buildWorldReviewQueue(entities, aliases),
    [aliases, entities]
  );

  const potentialEntityMatches = useMemo<PotentialEntityMatch[]>(
    () =>
      buildPotentialEntityMatches({
        entities,
        aliasMapByEntityId,
        editingId,
        name,
        fieldValues,
        alternativeNamesKey,
        ignoredEntityMatchKeys,
        normalizeName,
        parseAlternativeNames
      }),
    [
      aliasMapByEntityId,
      alternativeNamesKey,
      editingId,
      entities,
      fieldValues,
      ignoredEntityMatchKeys,
      name,
      normalizeName,
      parseAlternativeNames
    ]
  );

  const reviewEntityInsightsById = useMemo(
    () =>
      buildReviewEntityInsightsById({
        entities,
        categories,
        aliasMapByEntityId,
        alternativeNamesKey,
        ignoredEntityMatchKeys,
        normalizeName,
        parseAlternativeNames
      }),
    [
      aliasMapByEntityId,
      alternativeNamesKey,
      categories,
      entities,
      ignoredEntityMatchKeys,
      normalizeName,
      parseAlternativeNames
    ]
  );

  const filteredReviewQueue = useMemo(
    () =>
      reviewQueue
        .filter((item) =>
          reviewFilter === 'all' ? true : item.reasons.includes(reviewFilter)
        )
        .filter((item) => {
          if (recommendedFilter === 'all') return true;
          const insight = reviewEntityInsightsById.get(item.entity.id);
          return insight?.recommendedResolution === recommendedFilter;
        }),
    [recommendedFilter, reviewEntityInsightsById, reviewFilter, reviewQueue]
  );

  const reviewCounts = useMemo(
    () => ({
      all: reviewQueue.length,
      needsCompletion: reviewQueue.filter((item) =>
        item.reasons.includes('needsCompletion')
      ).length,
      aliasFollowUp: reviewQueue.filter((item) =>
        item.reasons.includes('aliasFollowUp')
      ).length
    }),
    [reviewQueue]
  );

  const recommendedCounts = useMemo(
    () => ({
      all: reviewQueue.length,
      complete: reviewQueue.filter(
        (item) =>
          reviewEntityInsightsById.get(item.entity.id)?.recommendedResolution === 'complete'
      ).length,
      rename: reviewQueue.filter(
        (item) =>
          reviewEntityInsightsById.get(item.entity.id)?.recommendedResolution === 'rename'
      ).length,
      alias: reviewQueue.filter(
        (item) =>
          reviewEntityInsightsById.get(item.entity.id)?.recommendedResolution === 'alias'
      ).length,
      merge: reviewQueue.filter(
        (item) =>
          reviewEntityInsightsById.get(item.entity.id)?.recommendedResolution === 'merge'
      ).length,
      ignore: reviewQueue.filter(
        (item) =>
          reviewEntityInsightsById.get(item.entity.id)?.recommendedResolution === 'ignore'
      ).length
    }),
    [reviewEntityInsightsById, reviewQueue]
  );

  const filteredEntities = useMemo(
    () => entities.filter((entity) => entity.categoryId === activeTab),
    [activeTab, entities]
  );

  const visibleEntities =
    viewMode === 'review'
      ? filteredReviewQueue.map((item) => item.entity)
      : filteredEntities;

  const selectedEntityQueueItem =
    selectedEntity
      ? reviewQueue.find((item) => item.entity.id === selectedEntity.id) ?? null
      : null;

  return {
    reviewQueue,
    filteredReviewQueue,
    reviewCounts,
    recommendedCounts,
    potentialEntityMatches,
    reviewEntityInsightsById,
    visibleEntities,
    selectedEntityQueueItem
  };
};
