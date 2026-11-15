/**
 * The one HTML-to-text decoder (slice 3.52): the document body's text
 * content, exactly as the browser reads it, with tags dropped and entities
 * decoded. Callers that trim or collapse whitespace do so on top of this,
 * because evidence offsets depend on the exact text.
 *
 * Without a DOM (node unit tests) it strips tags the same way: removed, not
 * replaced with spaces, so adjacent blocks run together as they do in the
 * browser. Scene text with paragraph breaks kept is a different job; see
 * `manuscriptPlainText` and the export helpers.
 */
export function htmlTextContent(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  }
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * HTML (like TipTap output) as one line of plain text, whitespace collapsed.
 * Used for word counts, review hashes, and mention counts.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return htmlTextContent(html).replace(/\s+/g, ' ').trim();
}

/**
 * Rough word count: splits on whitespace after stripping HTML.
 */
export function countWords(html: string): number {
  const text = htmlToPlainText(html);
  if (!text) return 0;

  const parts = text.split(' ').filter(Boolean);
  return parts.length;
}
