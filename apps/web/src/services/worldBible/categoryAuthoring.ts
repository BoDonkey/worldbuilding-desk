import type {EntityCategory} from '../../entityTypes';

export const normalizeWorldCategoryName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const buildWorldCategorySlug = (value: string): string =>
  normalizeWorldCategoryName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function buildWorldCategory(params: {
  projectId: string;
  name: string;
  id?: string;
  createdAt?: number;
}): EntityCategory {
  const name = normalizeWorldCategoryName(params.name);
  if (!name) {
    throw new Error('Enter a name for the new World Bible type.');
  }

  const slug = buildWorldCategorySlug(name);
  if (!slug) {
    throw new Error('Use at least one letter or number in the World Bible type name.');
  }

  return {
    id: params.id ?? crypto.randomUUID(),
    projectId: params.projectId,
    kind: 'general',
    name,
    slug,
    fieldSchema: [
      {key: 'description', label: 'Description', type: 'textarea'}
    ],
    createdAt: params.createdAt ?? Date.now()
  };
}
