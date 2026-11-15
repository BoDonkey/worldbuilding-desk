import type {EntityCategory} from '../../entityTypes';

/**
 * The one "is this a place" hint list (slice 3.52), matched against a
 * category's slug. Containment and positions, the World Canvas Places lens,
 * and the unknown-name category suggestion all read it, so a `zone` or
 * `cities` category is a place everywhere or nowhere.
 */
export const LOCATION_CATEGORY_HINTS: readonly string[] = [
  'location',
  'locations',
  'place',
  'places',
  'region',
  'zone',
  'city',
  'cities',
  'town',
  'landmark'
];

/** Location-like by slug only. */
export const isLocationCategory = (category: EntityCategory | null | undefined): boolean => {
  const slug = (category?.slug ?? '').toLowerCase();
  return LOCATION_CATEGORY_HINTS.some((hint) => slug.includes(hint));
};
