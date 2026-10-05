import type {EntityCategory} from '../../entityTypes';
import type {GuardrailIssue} from './types';
import {normalizeCanonText} from './textMatcher';

/**
 * Which World Bible type an unknown name in review most likely belongs to.
 * Heuristics only: the author always chooses; this pre-selects a category.
 */

export type SuggestedUnknownCategory =
  | 'character'
  | 'location'
  | 'item'
  | 'creature'
  | 'faction'
  | 'flora'
  | 'mineral'
  | 'artifact'
  | 'concept'
  | null;

const hasUppercaseLetter = (value: string): boolean => /[A-Z]/.test(value);

const LOCATION_HINT_TOKENS = new Set([
  'archive',
  'bay',
  'camp',
  'capital',
  'castle',
  'cavern',
  'cave',
  'city',
  'district',
  'empire',
  'farm',
  'forest',
  'fort',
  'fortress',
  'garden',
  'hall',
  'harbor',
  'hollow',
  'inn',
  'island',
  'keep',
  'kingdom',
  'lake',
  'library',
  'manor',
  'market',
  'marsh',
  'mine',
  'monastery',
  'mountain',
  'outpost',
  'palace',
  'realm',
  'river',
  'road',
  'ruins',
  'sanctum',
  'settlement',
  'shore',
  'square',
  'street',
  'swamp',
  'temple',
  'tower',
  'town',
  'vale',
  'village',
  'woods'
]);

const ITEM_HINT_TOKENS = new Set([
  'amulet',
  'armor',
  'armour',
  'axe',
  'blade',
  'book',
  'bow',
  'bracelet',
  'charm',
  'cloak',
  'coin',
  'crown',
  'dagger',
  'elixir',
  'gem',
  'grimoire',
  'hammer',
  'helm',
  'helmet',
  'herb',
  'key',
  'knife',
  'lantern',
  'map',
  'medallion',
  'necklace',
  'orb',
  'potion',
  'relic',
  'ring',
  'robe',
  'scroll',
  'shield',
  'spear',
  'staff',
  'stone',
  'sword',
  'talisman',
  'tome',
  'vial',
  'wand'
]);

const CREATURE_HINT_TOKENS = new Set([
  'bear',
  'beast',
  'boar',
  'cat',
  'creature',
  'crow',
  'deer',
  'demon',
  'dog',
  'dragon',
  'drake',
  'eagle',
  'fiend',
  'fox',
  'giant',
  'goblin',
  'griffin',
  'hawk',
  'hound',
  'monster',
  'owl',
  'phantom',
  'rat',
  'serpent',
  'shade',
  'spider',
  'spirit',
  'stag',
  'tiger',
  'wolf',
  'wyrm'
]);

const FACTION_HINT_TOKENS = new Set([
  'alliance',
  'band',
  'brotherhood',
  'clan',
  'company',
  'council',
  'court',
  'cult',
  'dynasty',
  'faction',
  'family',
  'fellowship',
  'fleet',
  'guild',
  'house',
  'kingdom',
  'legion',
  'order',
  'syndicate',
  'tribe'
]);

const CATEGORY_SEMANTIC_SLUG_HINTS: Record<
  Exclude<SuggestedUnknownCategory, null>,
  string[]
> = {
  character: ['character', 'npc', 'person', 'people'],
  location: ['location', 'place', 'city', 'town', 'region', 'landmark'],
  item: ['item', 'object', 'gear', 'equipment', 'tool', 'weapon'],
  creature: ['creature', 'monster', 'beast', 'enemy', 'mob', 'species'],
  faction: ['faction', 'guild', 'clan', 'house', 'group', 'order'],
  flora: ['flora', 'plant', 'herb'],
  mineral: ['mineral', 'ore', 'rock', 'metal'],
  artifact: ['artifact', 'relic'],
  concept: ['concept', 'lore', 'rule', 'history', 'culture']
};

export function findCategoryIdForSuggestedKind(
  availableCategories: EntityCategory[],
  suggested: SuggestedUnknownCategory
): string | undefined {
  if (!suggested) {
    return undefined;
  }
  const slugHints = CATEGORY_SEMANTIC_SLUG_HINTS[suggested];
  const exactMatch = availableCategories.find((category) =>
    slugHints.some((hint) => category.slug.toLowerCase() === hint)
  );
  if (exactMatch) {
    return exactMatch.id;
  }
  return availableCategories.find((category) =>
    slugHints.some((hint) => category.slug.toLowerCase().includes(hint))
  )?.id;
}

/**
 * Suggests a kind from the detection reason, the name's last word, and the
 * words just before it in the scene (`documentContent` is the scene HTML the
 * issue's span points into, when known).
 */
export function suggestUnknownCategory(params: {
  surface: string;
  issue: GuardrailIssue | undefined;
  documentContent: string | null;
}): SuggestedUnknownCategory {
  const {surface, issue, documentContent} = params;
  const normalizedSurface = normalizeCanonText(surface);
  if (!normalizedSurface) {
    return null;
  }
  const detectionReason = issue?.detectionReason ?? null;
  if (
    detectionReason === 'titled_name' ||
    detectionReason === 'character_context_candidate'
  ) {
    return 'character';
  }
  if (detectionReason === 'action_object_candidate') {
    return 'item';
  }

  const tokens = normalizedSurface.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1] ?? '';
  const originalSurfaceLooksNamed = hasUppercaseLetter(surface);
  if (lastToken && LOCATION_HINT_TOKENS.has(lastToken) && originalSurfaceLooksNamed) {
    return 'location';
  }
  if (lastToken && ITEM_HINT_TOKENS.has(lastToken)) {
    return 'item';
  }
  if (lastToken && CREATURE_HINT_TOKENS.has(lastToken)) {
    return 'creature';
  }
  if (lastToken && FACTION_HINT_TOKENS.has(lastToken)) {
    return 'faction';
  }

  if (issue?.span && documentContent !== null) {
    const prefix = documentContent
      .slice(Math.max(0, issue.span.start - 32), issue.span.start)
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    if (/\b(from|to|into|toward|towards|at|in|near|inside|outside)\s*$/u.test(prefix)) {
      return 'location';
    }
    if (/\b(with|using|equip(?:ped)?|wield(?:ed)?|drink|drank|grab(?:bed)?|draw|drew|throw|threw|cast)\s*$/u.test(prefix)) {
      return 'item';
    }
    if (/\b(named|called)\s*$/u.test(prefix)) {
      return 'character';
    }
  }

  return null;
}
