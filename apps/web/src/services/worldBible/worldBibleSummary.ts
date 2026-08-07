import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {
  ALTERNATIVE_NAMES_KEY,
  extractPlainTextFromRichText,
  extractStructuredSummaryFromRichText,
  formatAlternativeNames,
  parseAlternativeNames
} from './worldBibleEntityHelpers';

const CATEGORY_SUMMARY_PRIORITY: Record<string, string[]> = {
  characters: ['description', 'role', 'age', 'notes'],
  locations: ['description', 'climate', 'population', 'notes'],
  items: ['description', 'rarity', 'notes'],
  factions: ['description', 'notes'],
  concepts: ['description', 'notes']
};

export const CHARACTER_CATEGORY_HINTS = [
  'character',
  'characters',
  'npc',
  'person',
  'people'
];
const ITEM_CATEGORY_NAMES = new Set(['item', 'items']);
export const CHARACTER_NOTES_FIELD = 'notes';
export const CHARACTER_IDENTITY_FIELD_KEYS = ['age', 'role'];
export const CHARACTER_AUTHORING_FIELD_KEYS = new Set([
  'description',
  CHARACTER_NOTES_FIELD,
  ...CHARACTER_IDENTITY_FIELD_KEYS,
  ALTERNATIVE_NAMES_KEY
]);

const compactEntityCardText = (value: string, maxLength = 140): string => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trim()}...`;
};

export const isCharacterCategory = (category: EntityCategory): boolean => {
  const slug = category.slug.toLowerCase();
  const name = category.name.toLowerCase();
  return CHARACTER_CATEGORY_HINTS.some(
    (hint) => slug.includes(hint) || name.includes(hint)
  );
};

export const isItemCategory = (category: EntityCategory): boolean =>
  ITEM_CATEGORY_NAMES.has(category.slug.trim().toLowerCase()) ||
  ITEM_CATEGORY_NAMES.has(category.name.trim().toLowerCase());

export interface EntityCardSummary {
  primarySummary: string | null;
  summarySourceLabel: string | null;
  summaryIsTruncated: boolean;
  secondaryFields: Array<{label: string; value: string}>;
  hiddenFieldCount: number;
}

export function buildEntityCardSummary(
  entity: WorldEntity,
  category: EntityCategory | null | undefined,
  aliasTexts: string[] = []
): EntityCardSummary {
  const labelByKey = new Map(
    [
      ...(category?.fieldSchema ?? []).map(
        (field) => [field.key, field.label] as const
      ),
      [ALTERNATIVE_NAMES_KEY, 'Alternative names'] as const
    ]
  );
  const richTextKeys = new Set(
    (category?.fieldSchema ?? [])
      .filter((field) => field.type === 'textarea')
      .map((field) => field.key)
  );

  const summaryPriority = [
    ...(category ? CATEGORY_SUMMARY_PRIORITY[category.slug] ?? [] : []),
    'description',
    'summary',
    'notes'
  ];
  const dedupedSummaryKeys = Array.from(new Set(summaryPriority));
  const summarySourceKey =
    dedupedSummaryKeys.find((key) => {
      const value = entity.fields[key];
      return (
        typeof value === 'string' &&
        extractPlainTextFromRichText(value).length > 0
      );
    }) ??
    Array.from(richTextKeys).find((key) => {
      const value = entity.fields[key];
      return (
        typeof value === 'string' &&
        extractPlainTextFromRichText(value).length > 0
      );
    }) ??
    null;

  const primarySummary =
    summarySourceKey && typeof entity.fields[summarySourceKey] === 'string'
      ? extractStructuredSummaryFromRichText(
          entity.fields[summarySourceKey] as string
        )
      : null;

  const secondaryPriority = Array.from(
    new Set([
      ...(category?.fieldSchema.map((field) => field.key) ?? []),
      ...(aliasTexts.length > 0 ? [ALTERNATIVE_NAMES_KEY] : []),
      ...Object.keys(entity.fields)
    ])
  );

  const allSecondaryFields = secondaryPriority
    .filter((key) => key !== summarySourceKey)
    .map((key) => {
      if (key === ALTERNATIVE_NAMES_KEY) {
        const fieldAliases = parseAlternativeNames(
          typeof entity.fields[ALTERNATIVE_NAMES_KEY] === 'string'
            ? String(entity.fields[ALTERNATIVE_NAMES_KEY])
            : ''
        );
        return {
          label: labelByKey.get(key) ?? key,
          value: formatAlternativeNames(
            parseAlternativeNames([...fieldAliases, ...aliasTexts].join(', '))
          )
        };
      }
      const value = entity.fields[key];
      if (typeof value === 'string') {
        return {
          label: labelByKey.get(key) ?? key,
          value: extractPlainTextFromRichText(value)
        };
      }
      if (Array.isArray(value)) {
        return {
          label: labelByKey.get(key) ?? key,
          value: value.map((item) => String(item)).filter(Boolean).join(', ')
        };
      }
      if (typeof value === 'boolean') {
        return {
          label: labelByKey.get(key) ?? key,
          value: value ? 'Yes' : 'No'
        };
      }
      return {
        label: labelByKey.get(key) ?? key,
        value: String(value ?? '')
      };
    })
    .filter((field) => field.value.trim().length > 0);
  const secondaryFields = allSecondaryFields.slice(0, 3);

  return {
    primarySummary: primarySummary
      ? compactEntityCardText(primarySummary, 180)
      : null,
    summarySourceLabel: summarySourceKey
      ? labelByKey.get(summarySourceKey) ?? summarySourceKey
      : null,
    summaryIsTruncated: Boolean(primarySummary && primarySummary.length > 180),
    secondaryFields: secondaryFields.map((field) => ({
      ...field,
      value: compactEntityCardText(field.value, 96)
    })),
    hiddenFieldCount: Math.max(
      0,
      allSecondaryFields.length - secondaryFields.length
    )
  };
}
