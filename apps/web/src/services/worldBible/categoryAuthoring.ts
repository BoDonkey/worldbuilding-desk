import type {EntityCategory} from '../../entityTypes';

export const normalizeWorldCategoryName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

/**
 * A type's key from its name: lowercase letters and digits from any script,
 * with everything else as one `-` (slice 3.65). Empty when the name has no
 * letter or digit. Every way of making a type uses this; it used to keep only
 * a-z and 0-9 here, so a type named "人物" was refused.
 */
export const buildWorldCategorySlug = (value: string): string =>
  normalizeWorldCategoryName(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/** The key for a type made or renamed in the category screens, which accept any name. */
export const categorySlugForName = (name: string, current?: {name: string; slug: string}): string =>
  current && normalizeWorldCategoryName(current.name) === normalizeWorldCategoryName(name)
    ? current.slug
    : buildWorldCategorySlug(name) || 'custom';

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
