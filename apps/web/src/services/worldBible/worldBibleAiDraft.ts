import type {EntityCategory, FieldDefinition} from '../../entityTypes';
import {normalizeRichTextValue} from './worldBibleEntityHelpers';

export interface WorldBibleAiDraft {
  name?: string;
  fields: Record<string, string>;
}

const stripCodeFence = (value: string): string =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];

const normalizeOption = (value: string): string => value.trim().toLowerCase();

const coerceFieldValue = (
  field: FieldDefinition,
  value: unknown
): string | undefined => {
  if (value === null || value === undefined) return undefined;

  switch (field.type) {
    case 'textarea': {
      const text = readString(value);
      return text ? normalizeRichTextValue(text) : undefined;
    }
    case 'text':
    case 'number':
    case 'dice':
    case 'modifier': {
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return readString(value);
    }
    case 'select': {
      const text = readString(value);
      if (!text) return undefined;
      const matchingOption = field.options?.find(
        (option) => normalizeOption(option) === normalizeOption(text)
      );
      return matchingOption;
    }
    case 'multiselect': {
      const values = readStringArray(value);
      if (!values.length) return undefined;
      const optionsByKey = new Map(
        (field.options ?? []).map((option) => [normalizeOption(option), option])
      );
      const selectedOptions = values
        .map((item) => optionsByKey.get(normalizeOption(item)))
        .filter((item): item is string => Boolean(item));
      return selectedOptions.length ? selectedOptions.join(', ') : undefined;
    }
    case 'checkbox':
      return undefined;
    default:
      return undefined;
  }
};

export const getWorldBibleAiDraftableFields = (
  category: EntityCategory
): FieldDefinition[] =>
  category.fieldSchema.filter((field) => field.type !== 'checkbox');

export const buildWorldBibleAiDraftPrompt = (
  category: EntityCategory,
  premise: string
): string => {
  const fields = getWorldBibleAiDraftableFields(category).map((field) => {
    const options = field.options?.length
      ? ` Options: ${field.options.join(', ')}.`
      : '';
    return `- ${field.key}: ${field.label} (${field.type}).${options}`;
  });

  return [
    `Create a World Bible draft for the category "${category.name}" from this author brief.`,
    '',
    premise.trim(),
    '',
    'Return only valid JSON with this shape:',
    '{"name":"","fields":{"fieldKey":""}}',
    '',
    'Use only field keys listed below. Do not invent categories or save canon automatically.',
    'For textarea fields, write concise editable canon prose, not final-scene prose.',
    'For select and multiselect fields, use only the provided option labels.',
    '',
    'Available fields:',
    fields.length ? fields.join('\n') : '- No custom fields. Return a useful name only.'
  ].join('\n');
};

export const parseWorldBibleAiDraft = (
  raw: string,
  category: EntityCategory
): WorldBibleAiDraft => {
  const fenced = stripCodeFence(raw);
  const jsonMatch = fenced.match(/\{[\s\S]*\}/);
  const json = jsonMatch ? jsonMatch[0] : fenced;
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const rawFields =
    parsed.fields && typeof parsed.fields === 'object'
      ? (parsed.fields as Record<string, unknown>)
      : {};
  const fieldByKey = new Map(category.fieldSchema.map((field) => [field.key, field]));
  const fields: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawFields)) {
    const field = fieldByKey.get(key);
    if (!field) continue;
    const coerced = coerceFieldValue(field, value);
    if (coerced !== undefined) {
      fields[key] = coerced;
    }
  }

  return {
    name: readString(parsed.name),
    fields
  };
};
