// Singular/plural spellings of a World Bible name, for editor highlighting only
// (see knownLoreHighlights.ts).
// Deterministic English rules applied to the last word; no inflection library.

import {normalizeCanonText} from './textMatcher';

const MIN_STEM_LENGTH = 3;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const variantsOfWord = (word: string): string[] => {
  const lower = word.toLowerCase();
  const variants: string[] = [];

  // Plural -> singular
  if (lower.endsWith('ies') && word.length - 3 >= MIN_STEM_LENGTH - 1) {
    variants.push(`${word.slice(0, -3)}y`);
  } else if (/(?:ch|sh|x|z|ss)es$/.test(lower) && word.length - 2 >= MIN_STEM_LENGTH) {
    variants.push(word.slice(0, -2));
  } else if (lower.endsWith('s') && !lower.endsWith('ss') && word.length - 1 >= MIN_STEM_LENGTH) {
    variants.push(word.slice(0, -1));
  }

  // Singular -> plural
  if (lower.endsWith('y') && word.length >= 2 && !VOWELS.has(lower[lower.length - 2])) {
    variants.push(`${word.slice(0, -1)}ies`);
  } else if (/(?:ch|sh|x|z|ss)$/.test(lower)) {
    variants.push(`${word}es`);
  } else if (!lower.endsWith('s')) {
    variants.push(`${word}s`);
  }

  return variants;
};

/**
 * Returns the other-number spellings of a name ("Dhemons" -> "Dhemon",
 * "Fairy" -> "Fairies", "Iron Guards" -> "Iron Guard"). The name itself is
 * not included. Names whose last word is too short to inflect safely yield none.
 */
export const getNumberVariants = (surface: string): string[] => {
  const trimmed = surface.trim();
  const match = trimmed.match(/^(.*?)(\p{L}+)$/u);
  if (!match) return [];
  const [, prefix, lastWord] = match;
  if (lastWord.length < MIN_STEM_LENGTH) return [];
  return variantsOfWord(lastWord)
    .map((variant) => `${prefix}${variant}`)
    .filter((variant) => variant.toLowerCase() !== trimmed.toLowerCase());
};

/**
 * Appends other-number spellings for the entries `shouldInflect` allows.
 * A variant that is already some entry's exact surface is skipped, so exact
 * names and aliases always win.
 */
export const withNumberVariants = <T extends {surface: string}>(
  entries: T[],
  shouldInflect: (entry: T) => boolean
): T[] => {
  const exactSurfaces = new Set(entries.map((entry) => normalizeCanonText(entry.surface)));
  const variants = entries.flatMap((entry) =>
    shouldInflect(entry)
      ? getNumberVariants(entry.surface)
          .filter((variant) => !exactSurfaces.has(normalizeCanonText(variant)))
          .map((variant) => ({...entry, surface: variant}))
      : []
  );
  return [...entries, ...variants];
};
