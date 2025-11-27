/**
 * Convert HTML content (like TipTap output) to plain text.
 * Useful for word counts and future RAG pipelines.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  // Use DOM to strip tags. This runs in the browser.
  const container = document.createElement('div');
  container.innerHTML = html;

  const text = container.textContent || container.innerText || '';

  // Normalize whitespace: collapse multiple spaces/newlines into single spaces
  return text.replace(/\s+/g, ' ').trim();
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
