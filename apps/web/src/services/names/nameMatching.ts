/**
 * The two ways the app decides whether two names are the same (review D5).
 *
 * - `normalizeNameExact` — the name as written, ignoring case and spacing.
 *   Use it for record names, aliases, categories, and duplicate checks.
 * - `normalizeNameLoose` — letters and digits only, so punctuation and
 *   hyphens do not matter. Use it where names are pulled out of prose or
 *   commands ("the Ember-Archive" vs "Ember Archive").
 *
 * Both keep letters from every script. Surfaces must not write their own
 * copies (docs/domain-model.md, normalized-name joins).
 */

/** "  Kael   Voss " and "kael voss" compare equal. */
export const normalizeNameExact = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * "Ember-Archive!" and "ember archive" compare equal. With
 * `dropLeadingArticle`, "The Ember Archive" does too.
 */
export const normalizeNameLoose = (
  value: string,
  options: {dropLeadingArticle?: boolean} = {}
): string => {
  const loose = value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
  return options.dropLeadingArticle ? loose.replace(/^the /, '') : loose;
};
