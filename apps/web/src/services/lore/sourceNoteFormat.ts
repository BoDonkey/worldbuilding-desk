import type {LoreDocument, LoreDocumentFormat} from '../../entityTypes';
import {markdownToRichHtml} from '../worldBible/worldBibleImportParsing';
import {isMarkdownFileName} from './loreImport';

/**
 * Markdown imports were saved as `plain_text` before Slice 4.57; their
 * content is the file verbatim, so they are read as Markdown.
 */
export const resolveSourceNoteFormat = (
  document: Pick<LoreDocument, 'format' | 'source'>
): LoreDocumentFormat =>
  document.format === 'plain_text' &&
  document.source.type === 'import' &&
  isMarkdownFileName(document.source.fileName)
    ? 'markdown'
    : document.format;

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'li', 'ol', 'p', 'pre', 's', 'strong', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'u', 'ul'
]);
const DROPPED_TAGS = 'script, style, noscript, iframe, object, embed, template, svg, math';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const plainTextToHtml = (content: string): string =>
  content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');

/**
 * Keeps only allow-listed formatting tags; other elements are unwrapped to
 * their text, and every attribute except a web or mail link's href is removed.
 */
export const sanitizeSourceNoteHtml = (html: string): string => {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  parsed.querySelectorAll(DROPPED_TAGS).forEach((node) => node.remove());
  const elements = Array.from(parsed.body.querySelectorAll('*')).reverse();
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    const href = tag === 'a' ? element.getAttribute('href') ?? '' : '';
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
    if (tag === 'a' && /^(https?:|mailto:)/i.test(href.trim())) {
      element.setAttribute('href', href.trim());
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return parsed.body.innerHTML;
};

/** Display HTML for a Source Note body; stored content is never changed. */
export const sourceNoteContentToHtml = (
  content: string,
  format: LoreDocumentFormat
): string => {
  if (!content.trim()) return '';
  const html =
    format === 'markdown'
      ? markdownToRichHtml(content)
      : format === 'html'
        ? content
        : plainTextToHtml(content);
  return sanitizeSourceNoteHtml(html);
};
