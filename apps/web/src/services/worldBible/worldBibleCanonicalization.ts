import type {WorldEntity} from '../../entityTypes';
import {extractPlainTextFromRichText} from './worldBibleEntityHelpers';

export const buildCanonicalAliasList = (params: {
  previousName?: string;
  nextName: string;
  aliases: string[];
  suggestedAliases?: string[];
}): string[] => {
  const nextNormalized = params.nextName.trim().toLowerCase();
  const previousNormalized = params.previousName?.trim().toLowerCase() ?? '';
  const combined = [...params.aliases, ...(params.suggestedAliases ?? [])];
  if (previousNormalized && nextNormalized && previousNormalized !== nextNormalized) {
    combined.unshift(params.previousName!.trim());
  }
  return Array.from(
    new Map(
      combined
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0 && alias.toLowerCase() !== nextNormalized)
        .map((alias) => [alias.toLowerCase(), alias])
    ).values()
  );
};

const NAME_ALIAS_STOP_WORDS = new Set([
  'a',
  'an',
  'captain',
  'detective',
  'da',
  'de',
  'del',
  'der',
  'di',
  'dos',
  'du',
  'el',
  'la',
  'las',
  'le',
  'lord',
  'lady',
  'madam',
  'madame',
  'master',
  'miss',
  'mister',
  'mr',
  'mrs',
  'ms',
  'mx',
  'of',
  'officer',
  'prof',
  'professor',
  'sir',
  'the',
  'van',
  'von'
]);

export const deriveFirstNameAlias = (name: string): string | null => {
  const tokens = name
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  const firstMeaningfulToken = tokens.find(
    (token) => !NAME_ALIAS_STOP_WORDS.has(token.toLowerCase())
  );
  if (!firstMeaningfulToken || firstMeaningfulToken.length < 3) {
    return null;
  }

  if (firstMeaningfulToken.toLowerCase() === name.trim().toLowerCase()) {
    return null;
  }

  return firstMeaningfulToken;
};

export const deriveCharacterAliasSuggestions = (name: string): string[] => {
  const tokens = name
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const firstName = deriveFirstNameAlias(name);
  const suggestions = [
    firstName,
    firstName ? `${firstName}'s` : null
  ];

  if (tokens.length >= 3) {
    suggestions.push(tokens.slice(1).join(' '));
  }

  const canonical = name.trim().toLowerCase();
  return Array.from(
    new Map(
      suggestions
        .filter((alias): alias is string => Boolean(alias?.trim()))
        .filter((alias) => alias.trim().toLowerCase() !== canonical)
        .map((alias) => [alias.trim().toLowerCase(), alias.trim()])
    ).values()
  );
};

const parseCommaSeparatedAliases = (value: string): string[] =>
  Array.from(
    new Map(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item])
    ).values()
  );

const formatAliasList = (names: string[]): string => names.join(', ');

export const mergeEntityFields = (
  targetFields: Record<string, unknown>,
  sourceFields: Record<string, unknown>,
  alternativeNamesKey: string
): Record<string, unknown> => {
  const merged = {...targetFields};

  Object.entries(sourceFields).forEach(([key, value]) => {
    const existing = merged[key];
    const normalizedExisting = typeof existing === 'string' ? existing.trim() : existing;
    const normalizedIncoming = typeof value === 'string' ? value.trim() : value;

    if (
      normalizedExisting === undefined ||
      normalizedExisting === null ||
      normalizedExisting === '' ||
      (Array.isArray(normalizedExisting) && normalizedExisting.length === 0)
    ) {
      merged[key] = value;
      return;
    }

    if (
      key === alternativeNamesKey &&
      (typeof normalizedExisting === 'string' || typeof normalizedIncoming === 'string')
    ) {
      merged[key] = formatAliasList(
        parseCommaSeparatedAliases(
          [String(normalizedExisting ?? ''), String(normalizedIncoming ?? '')]
            .filter(Boolean)
            .join(', ')
        )
      );
    }
  });

  return merged;
};

const normalizeFieldValueForComparison = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const normalized = extractPlainTextFromRichText(value);
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => item !== '' && item !== null && item !== undefined);
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value ?? null;
};

const fieldValuesMatch = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = normalizeFieldValueForComparison(left);
  const normalizedRight = normalizeFieldValueForComparison(right);

  if (Array.isArray(normalizedLeft) && Array.isArray(normalizedRight)) {
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
  }

  return normalizedLeft === normalizedRight;
};

export const getAliasConversionPlan = (params: {
  sourceName: string;
  sourceFields: Record<string, unknown>;
  sourceLinks: string[];
  targetName: string;
  targetFields: Record<string, unknown>;
  targetLinks: string[];
  sourceIndexedAliases: string[];
  targetIndexedAliases: string[];
  alternativeNamesKey: string;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
}) => {
  const transferAliases = Array.from(
    new Map(
      [
        ...params.targetIndexedAliases,
        ...params.parseAlternativeNames(
          typeof params.targetFields[params.alternativeNamesKey] === 'string'
            ? String(params.targetFields[params.alternativeNamesKey])
            : ''
        ),
        ...params.sourceIndexedAliases,
        ...params.parseAlternativeNames(
          typeof params.sourceFields[params.alternativeNamesKey] === 'string'
            ? String(params.sourceFields[params.alternativeNamesKey])
            : ''
        ),
        params.sourceName
      ]
        .map((alias) => alias.trim())
        .filter(Boolean)
        .filter((alias) => params.normalizeName(alias) !== params.normalizeName(params.targetName))
        .map((alias) => [params.normalizeName(alias), alias])
    ).values()
  );

  const blockingFieldKeys = Object.entries(params.sourceFields)
    .filter(([key]) => key !== params.alternativeNamesKey)
    .filter(([, value]) => normalizeFieldValueForComparison(value) !== null)
    .filter(([key, value]) => !fieldValuesMatch(value, params.targetFields[key]))
    .map(([key]) => key);

  const missingTargetLinks = params.sourceLinks.filter(
    (link) => !params.targetLinks.includes(link)
  );

  return {
    transferAliases,
    mergedLinks: Array.from(new Set([...params.targetLinks, ...params.sourceLinks])),
    canDeleteSource: blockingFieldKeys.length === 0,
    blockingFieldKeys,
    hasLinkChanges: missingTargetLinks.length > 0
  };
};

export const buildEntityMergePlan = (params: {
  source: WorldEntity;
  target: WorldEntity;
  sourceName?: string;
  targetName?: string;
  sourceFields: Record<string, unknown>;
  targetFields: Record<string, unknown>;
  sourceIndexedAliases: string[];
  targetIndexedAliases: string[];
  alternativeNamesKey: string;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
  aliasesReviewedAt?: number;
}): {
  mergedEntity: WorldEntity;
  aliases: string[];
} => {
  const sourceName = params.sourceName?.trim() || params.source.name;
  const targetName = params.targetName?.trim() || params.target.name;
  const sourceAliasTexts = [
    ...params.sourceIndexedAliases,
    ...params.parseAlternativeNames(
      typeof params.sourceFields[params.alternativeNamesKey] === 'string'
        ? String(params.sourceFields[params.alternativeNamesKey])
        : ''
    ),
    params.source.name,
    sourceName
  ].filter((alias) => params.normalizeName(alias) !== params.normalizeName(targetName));
  const targetAliasTexts = [
    ...params.targetIndexedAliases,
    ...params.parseAlternativeNames(
      typeof params.targetFields[params.alternativeNamesKey] === 'string'
        ? String(params.targetFields[params.alternativeNamesKey])
        : ''
    ),
    params.target.name
  ].filter((alias) => params.normalizeName(alias) !== params.normalizeName(targetName));

  const mergedFields = mergeEntityFields(
    params.targetFields,
    params.sourceFields,
    params.alternativeNamesKey
  );
  delete mergedFields[params.alternativeNamesKey];

  return {
    mergedEntity: {
      ...params.target,
      name: targetName,
      fields: mergedFields,
      links: Array.from(new Set([...(params.target.links ?? []), ...(params.source.links ?? [])])),
      isNew: false,
      needsCompletion: false,
      aliasesReviewedAt: params.aliasesReviewedAt,
      updatedAt: Date.now()
    },
    aliases: Array.from(
      new Map(
        [...targetAliasTexts, ...sourceAliasTexts]
          .map((alias) => alias.trim())
          .filter(Boolean)
          .map((alias) => [params.normalizeName(alias), alias])
      ).values()
    )
  };
};
