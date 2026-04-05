import type {Character, WorldEntity, EntityCategory} from '../entityTypes';

const TITLE_CASE_SPLIT = /[_-]+/g;

const prettifyFieldKey = (key: string) =>
  key
    .replace(TITLE_CASE_SPLIT, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (match) => match.toUpperCase());

const valueToText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => valueToText(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
};

const pickField = (fields: WorldEntity['fields'], keys: string[]) => {
  for (const key of keys) {
    const value = valueToText(fields[key]);
    if (value) return value;
  }
  return '';
};

const omitPromotedKeys = new Set([
  'age',
  'role',
  'occupation',
  'description',
  'summary',
  'bio',
  'biography',
  'notes'
]);

export function createCharacterFromWorldEntity(params: {
  entity: WorldEntity;
  projectId: string;
  category?: EntityCategory | null;
}): Character {
  const {entity, projectId, category} = params;
  const now = Date.now();
  const description =
    pickField(entity.fields, ['description', 'summary', 'bio', 'biography', 'appearance']) || undefined;
  const role =
    pickField(entity.fields, ['role', 'occupation', 'title', 'archetype']) || undefined;
  const age = pickField(entity.fields, ['age']) || undefined;
  const notes = pickField(entity.fields, ['notes']) || undefined;

  const importedSections = Object.entries(entity.fields)
    .filter(([key, value]) => !omitPromotedKeys.has(key.toLowerCase()) && valueToText(value))
    .map(([key, value]) => ({
      id: crypto.randomUUID(),
      title: prettifyFieldKey(key),
      content: valueToText(value),
      action: 'notes' as const
    }));

  return {
    id: crypto.randomUUID(),
    projectId,
    name: entity.name,
    description,
    fields: {
      age,
      role,
      notes,
      importedSections: importedSections.length > 0 ? importedSections : undefined,
      sourceWorldEntityId: entity.id,
      sourceWorldEntityCategoryId: entity.categoryId,
      sourceWorldEntityCategoryName: category?.name
    },
    createdAt: now,
    updatedAt: now
  };
}
