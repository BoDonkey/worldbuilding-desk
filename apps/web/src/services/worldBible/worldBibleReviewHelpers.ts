import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {extractPlainTextFromRichText} from './worldBibleEntityHelpers';

export interface PotentialEntityMatch {
  entity: WorldEntity;
  matchKey: string | null;
  reasons: string[];
  recommendedResolution: ReviewResolution;
}

export type ReviewResolution = 'complete' | 'rename' | 'alias' | 'merge' | 'ignore';

export interface ReviewEntityInsight {
  matchCount: number;
  missingRequiredFields: string[];
  recommendedResolution: ReviewResolution;
}

export const buildEntityMatchKey = (leftEntityId: string, rightEntityId: string): string =>
  [leftEntityId, rightEntityId].sort().join('::');

export const getReviewResolutionLabel = (resolution: ReviewResolution): string => {
  switch (resolution) {
    case 'complete':
      return 'Complete fields';
    case 'rename':
      return 'Rename to canonical';
    case 'alias':
      return 'Convert to alias';
    case 'merge':
      return 'Merge records';
    case 'ignore':
      return 'Ignore match';
  }
};

export const getRecommendedMatchResolution = (reasons: string[]): ReviewResolution => {
  if (reasons.includes('Same name as an existing record')) {
    return 'merge';
  }
  if (
    reasons.includes('Current name already exists as an alias') ||
    reasons.includes('Current name looks like a short form of an existing record')
  ) {
    return 'alias';
  }
  return 'ignore';
};

const isLikelyShortFormOf = (shortName: string, fullName: string): boolean => {
  if (!shortName || !fullName || shortName === fullName) return false;
  if (shortName.includes(' ') || !fullName.includes(' ')) return false;
  return fullName.split(/\s+/).filter(Boolean)[0] === shortName;
};

export const getMissingRequiredFieldLabels = (
  entity: WorldEntity,
  category: EntityCategory | null | undefined
): string[] => {
  if (!category) return [];
  return category.fieldSchema
    .filter((field) => field.required)
    .filter((field) => {
      const rawValue = entity.fields[field.key];
      if (typeof rawValue === 'boolean') {
        return false;
      }
      if (Array.isArray(rawValue)) {
        return rawValue.length === 0;
      }
      return extractPlainTextFromRichText(String(rawValue ?? '')).length === 0;
    })
    .map((field) => field.label);
};

export const buildPotentialEntityMatches = (params: {
  entities: WorldEntity[];
  aliasMapByEntityId: Map<string, string[]>;
  editingId: string | null;
  name: string;
  fieldValues: Record<string, string>;
  alternativeNamesKey: string;
  ignoredEntityMatchKeys?: Set<string>;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
}): PotentialEntityMatch[] => {
  const normalizedName = params.normalizeName(params.name);
  const aliasValues = params.parseAlternativeNames(
    params.fieldValues[params.alternativeNamesKey] || ''
  );
  const normalizedAliases = aliasValues
    .map((alias) => params.normalizeName(alias))
    .filter(Boolean);

  if (!normalizedName && normalizedAliases.length === 0) {
    return [];
  }

  return params.entities
    .filter((entity) => entity.id !== params.editingId)
    .map((entity) => {
      const matchKey =
        params.editingId ? buildEntityMatchKey(params.editingId, entity.id) : null;
      if (matchKey && params.ignoredEntityMatchKeys?.has(matchKey)) {
        return {
          entity,
          matchKey,
          reasons: [],
          recommendedResolution: 'ignore' as ReviewResolution
        };
      }
      const reasons = new Set<string>();
      const entityName = params.normalizeName(entity.name);
      const entityAliases =
        params.aliasMapByEntityId
          .get(entity.id)
          ?.map((alias) => params.normalizeName(alias))
          .filter(Boolean) ?? [];

      if (normalizedName && entityName === normalizedName) {
        reasons.add('Same name as an existing record');
      }
      if (normalizedName && entityAliases.includes(normalizedName)) {
        reasons.add('Current name already exists as an alias');
      }
      if (normalizedName && isLikelyShortFormOf(normalizedName, entityName)) {
        reasons.add('Current name looks like a short form of an existing record');
      }
      if (normalizedAliases.includes(entityName)) {
        reasons.add('One of your aliases matches an existing record name');
      }
      if (normalizedAliases.some((alias) => entityAliases.includes(alias))) {
        reasons.add('One or more aliases overlap with another record');
      }

      const reasonList = Array.from(reasons);
      return {
        entity,
        matchKey,
        reasons: reasonList,
        recommendedResolution: getRecommendedMatchResolution(reasonList)
      };
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => a.entity.name.localeCompare(b.entity.name));
};

export const buildReviewEntityInsightsById = (params: {
  entities: WorldEntity[];
  categories: EntityCategory[];
  aliasMapByEntityId: Map<string, string[]>;
  alternativeNamesKey: string;
  ignoredEntityMatchKeys?: Set<string>;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
}): Map<string, ReviewEntityInsight> => {
  const insights = new Map<string, ReviewEntityInsight>();

  params.entities.forEach((entity) => {
    const normalizedEntityName = params.normalizeName(entity.name);
    const entityAliases = [
      ...params.parseAlternativeNames(
        typeof entity.fields[params.alternativeNamesKey] === 'string'
          ? String(entity.fields[params.alternativeNamesKey])
          : ''
      ),
      ...(params.aliasMapByEntityId.get(entity.id) ?? [])
    ]
      .map((alias) => params.normalizeName(alias))
      .filter(Boolean)
      .filter((alias) => alias !== normalizedEntityName);
    const entityAliasSet = new Set(entityAliases);
    let matchCount = 0;
    let recommendedResolution: ReviewResolution = 'ignore';

    params.entities.forEach((candidate) => {
      if (candidate.id === entity.id) return;
      if (
        params.ignoredEntityMatchKeys?.has(buildEntityMatchKey(entity.id, candidate.id))
      ) {
        return;
      }
      const normalizedCandidateName = params.normalizeName(candidate.name);
      const candidateAliases = [
        ...params.parseAlternativeNames(
          typeof candidate.fields[params.alternativeNamesKey] === 'string'
            ? String(candidate.fields[params.alternativeNamesKey])
            : ''
        ),
        ...(params.aliasMapByEntityId.get(candidate.id) ?? [])
      ]
        .map((alias) => params.normalizeName(alias))
        .filter(Boolean)
        .filter((alias) => alias !== normalizedCandidateName);
      const candidateAliasSet = new Set(candidateAliases);

      if (
        normalizedCandidateName === normalizedEntityName ||
        candidateAliasSet.has(normalizedEntityName) ||
        isLikelyShortFormOf(normalizedEntityName, normalizedCandidateName) ||
        isLikelyShortFormOf(normalizedCandidateName, normalizedEntityName) ||
        entityAliasSet.has(normalizedCandidateName) ||
        candidateAliases.some((alias) => entityAliasSet.has(alias))
      ) {
        matchCount += 1;
        if (normalizedCandidateName === normalizedEntityName) {
          recommendedResolution = 'merge';
          return;
        }
        if (
          recommendedResolution !== 'merge' &&
          (candidateAliasSet.has(normalizedEntityName) ||
            isLikelyShortFormOf(normalizedEntityName, normalizedCandidateName) ||
            isLikelyShortFormOf(normalizedCandidateName, normalizedEntityName) ||
            entityAliasSet.has(normalizedCandidateName))
        ) {
          recommendedResolution = 'alias';
        }
      }
    });

    const missingRequiredFields = getMissingRequiredFieldLabels(
      entity,
      params.categories.find((category) => category.id === entity.categoryId)
    );

    insights.set(entity.id, {
      matchCount,
      missingRequiredFields,
      recommendedResolution:
        missingRequiredFields.length > 0 ? 'complete' : recommendedResolution
    });
  });

  return insights;
};
