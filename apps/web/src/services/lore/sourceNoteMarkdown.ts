import type {JSONContent} from '@tiptap/core';

/**
 * Serializes a Source Note editor document to the Markdown dialect that
 * `markdownToRichHtml` renders, so a saved note displays as it was edited.
 * Bold is `**`, italic is `_` (so it can sit inside bold), hard breaks are a
 * newline in paragraphs and `<br>` where a newline would end the block, and
 * punctuation the renderer would read as markup is backslash-escaped.
 */

type Mark = 'link' | 'bold' | 'italic' | 'code';
const MARK_ORDER: Mark[] = ['link', 'bold', 'italic', 'code'];

interface InlineOptions {
  /** How a hard break is written: inside a paragraph a newline works; elsewhere it would end the block. */
  hardBreak: '\n' | '<br>' | ' ';
}

const escapeText = (text: string): string => text.replace(/[\\`*_[\]|<]/g, '\\$&');

/** Escapes what the renderer reads as block syntax at the start of a line. */
const escapeLineStarts = (markdown: string): string =>
  markdown
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)([#>+-])/, '$1\\$2')
        .replace(/^(\s*\d+)\.(\s)/, '$1\\.$2')
    )
    .join('\n');

const linkHref = (marks: JSONContent['marks']): string =>
  String(marks?.find((mark) => mark.type === 'link')?.attrs?.href ?? '')
    .replace(/\s/g, '%20')
    .replace(/\)/g, '%29');

const textMarks = (node: JSONContent): Mark[] =>
  MARK_ORDER.filter((mark) => node.marks?.some((candidate) => candidate.type === mark));

const openMarker = (mark: Mark): string =>
  mark === 'link' ? '[' : mark === 'bold' ? '**' : mark === 'italic' ? '_' : '`';

const closeMarker = (mark: Mark, href: string): string =>
  mark === 'link' ? `](${href})` : mark === 'bold' ? '**' : mark === 'italic' ? '_' : '`';

const serializeInline = (nodes: JSONContent[] | undefined, options: InlineOptions): string => {
  let output = '';
  let active: Mark[] = [];
  let activeHref = '';

  // Markers must hug their text, so whitespace moves outside a closing marker.
  const closeTo = (keep: number) => {
    const trailing = output.match(/\s*$/)?.[0] ?? '';
    output = output.slice(0, output.length - trailing.length);
    while (active.length > keep) {
      output += closeMarker(active.pop() as Mark, activeHref);
    }
    output += trailing;
  };

  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      closeTo(0);
      output += options.hardBreak;
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;

    const marks = textMarks(node);
    const href = marks.includes('link') ? linkHref(node.marks) : '';
    let shared = 0;
    while (
      shared < active.length &&
      shared < marks.length &&
      active[shared] === marks[shared] &&
      (active[shared] !== 'link' || href === activeHref)
    ) {
      shared += 1;
    }
    closeTo(shared);

    let text = marks.includes('code') ? node.text.replace(/`/g, "'") : escapeText(node.text);
    if (shared < marks.length && text.trim()) {
      const leading = text.match(/^\s*/)?.[0] ?? '';
      output += leading;
      text = text.slice(leading.length);
      for (const mark of marks.slice(shared)) {
        output += openMarker(mark);
        active.push(mark);
      }
      if (marks.includes('link')) activeHref = href;
    }
    output += text;
  }
  closeTo(0);
  active = [];
  return output;
};

const serializeTableCell = (cell: JSONContent): string =>
  (cell.content ?? [])
    .flatMap((block): string[] => {
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return (block.content ?? []).map(
          (item) => `• ${(item.content ?? []).map((child) => serializeTableCell(child)).join('<br>')}`
        );
      }
      if (block.content?.some((child) => child.type === 'text' || child.type === 'hardBreak')) {
        return [serializeInline(block.content, {hardBreak: '<br>'})];
      }
      return block.content ? [serializeTableCell(block)] : [];
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .join('<br>');

const serializeTable = (table: JSONContent): string => {
  const rows = (table.content ?? []).map((row) =>
    (row.content ?? []).flatMap((cell) => {
      const span = Math.max(1, Number(cell.attrs?.colspan) || 1);
      return [serializeTableCell(cell), ...Array<string>(span - 1).fill('')];
    })
  );
  if (rows.length === 0) return '';
  const columnCount = Math.max(1, ...rows.map((cells) => cells.length));
  const formatRow = (cells: string[]) =>
    `| ${Array.from({length: columnCount}, (_, index) => cells[index] || ' ').join(' | ')} |`;
  return [
    formatRow(rows[0]),
    formatRow(Array<string>(columnCount).fill('---')),
    ...rows.slice(1).map(formatRow)
  ].join('\n');
};

const serializeList = (list: JSONContent, depth: number): string => {
  const ordered = list.type === 'orderedList';
  const start = Number(list.attrs?.start) || 1;
  const indent = '  '.repeat(depth);
  return (list.content ?? [])
    .map((item, index) => {
      const marker = ordered ? `${start + index}.` : '-';
      const textParts: string[] = [];
      const nested: string[] = [];
      for (const child of item.content ?? []) {
        if (child.type === 'bulletList' || child.type === 'orderedList') {
          nested.push(serializeList(child, depth + 1));
        } else if (child.type === 'table') {
          textParts.push(serializeTable(child).replace(/\n/g, ' '));
        } else {
          textParts.push(serializeInline(child.content, {hardBreak: '<br>'}).trim());
        }
      }
      const text = textParts.filter(Boolean).join('<br>');
      return [`${indent}${marker} ${escapeLineStarts(text)}`, ...nested].join('\n');
    })
    .join('\n');
};

const serializeBlock = (block: JSONContent): string => {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(block.attrs?.level) || 1, 1), 6);
      const text = serializeInline(block.content, {hardBreak: ' '}).trim();
      return text ? `${'#'.repeat(level)} ${text}` : '';
    }
    case 'bulletList':
    case 'orderedList':
      return serializeList(block, 0);
    case 'blockquote': {
      const inner = serializeBlocks(block.content);
      return inner
        ? inner
            .split('\n')
            .map((line) => (line ? `> ${line}` : '>'))
            .join('\n')
        : '';
    }
    case 'horizontalRule':
      return '---';
    case 'table':
      return serializeTable(block);
    case 'paragraph':
      return escapeLineStarts(
        serializeInline(block.content, {hardBreak: '\n'})
          .split('\n')
          .map((line) => line.trim())
          .join('\n')
          .trim()
      );
    default:
      return block.content ? serializeBlocks(block.content) : '';
  }
};

const serializeBlocks = (blocks: JSONContent[] | undefined): string =>
  (blocks ?? [])
    .map(serializeBlock)
    .filter((markdown) => markdown.trim().length > 0)
    .join('\n\n');

export const sourceNoteDocToMarkdown = (doc: JSONContent): string => serializeBlocks(doc.content);
