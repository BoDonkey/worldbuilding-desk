import type {EntityCategory} from '../../entityTypes';
import {convertPlainTextToRichHtml} from './worldBibleEntityHelpers';

export type WorldBibleImportSectionAction =
  | 'existing-field'
  | 'record-section'
  | 'new-field'
  | 'ignore';

/** How textarea content from an import is rendered to rich text. */
export type ImportSourceFormat = 'markdown' | 'text';

export interface WorldBibleImportSectionDraft {
  id: string;
  title: string;
  content: string;
  action: WorldBibleImportSectionAction;
}

export const fileNameToEntityName = (name: string): string => {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/^\s*(?:race|species|character|item|location|faction)\s+sheet\s*/i, '')
    .trim();
  return base || 'Imported entry';
};

const stripInlineMarkdown = (value: string): string =>
  value
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

/**
 * Reduces a source line to plain "Label: value" form: drops list markers
 * (`-`, `*`, `+`, bullets, `1.`) and Markdown emphasis around a leading label
 * (`**Age:** Mid-30s`, `**Age**: Mid-30s`).
 */
const normalizeImportLine = (line: string): string =>
  line
    .replace(/^[\s\u200f\u200e]+/g, '')
    .replace(/^(?:[•·▪◦]\s*|[-+*]\s+|\d{1,3}[.)]\s+)/u, '')
    .replace(/^(\*\*|__)([^*_\n]{1,80}?):\1\s*/, '$2: ')
    .replace(/^(\*\*|__)([^*_\n]{1,80}?)\1:\s*/, '$2: ')
    .replace(/\t+/g, ' ')
    .trim();

const MARKDOWN_HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;

const getMarkdownHeadingTitle = (rawLine: string): string | null => {
  const match = rawLine.match(MARKDOWN_HEADING_PATTERN);
  if (!match) return null;
  return stripInlineMarkdown(match[2]).replace(/:\s*$/, '').trim() || null;
};

/** HTML comments are invisible in rendered Markdown, so imports drop them too. */
export const stripMarkdownComments = (raw: string): string =>
  raw.replace(/<!--[\s\S]*?-->/g, '');

const parseImportLabelValue = (line: string): {label: string; value: string} | null => {
  const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
  if (!match) return null;
  return {label: match[1].trim(), value: match[2].trim()};
};

const IMPORT_NAME_LABELS = new Set([
  'name',
  'title',
  'concept',
  'race',
  'species',
  'character',
  'character name'
]);
const COLLAPSED_SECTION_HEADING_PATTERN =
  /\b(Background(?:\s+and\s+[A-Z][A-Za-z'’/-]+)?|[A-Z][A-Za-z'’/-]+\s+and\s+[A-Z][A-Za-z'’/-]+|Interaction\s+with\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*|Role\s+in\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*|Broader\s+Implications|Inclusion\s+of\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*):\s/gi;
const INLINE_LABEL_PATTERN = /^[A-Z][A-Za-z'’/-]{1,32}(?:\s+[A-Z][A-Za-z'’/-]{1,32}){0,2}$/;
const COMMON_IMPORT_SECTION_HEADINGS = new Set([
  'basic information',
  'physical description',
  'personality',
  'background',
  'skills',
  'special traits',
  'social dynamics',
  'goals and motivations',
  'character arc',
  'new additions'
]);

const looksLikeImportSectionHeading = (
  line: string,
  previousLine: string,
  nextLine: string
): boolean => {
  if (!line.endsWith(':')) return false;
  const candidate = line.slice(0, -1).trim();
  if (!candidate || candidate.includes(':') || candidate.includes('  ')) return false;
  if (IMPORT_NAME_LABELS.has(candidate.toLowerCase())) return false;
  if (candidate.length > 72) return false;
  if (COMMON_IMPORT_SECTION_HEADINGS.has(candidate.toLowerCase())) return true;
  if (INLINE_LABEL_PATTERN.test(candidate) && !/\b(and|with|in|of)\b/i.test(candidate)) {
    return !previousLine && Boolean(nextLine) && !parseImportLabelValue(nextLine);
  }
  return true;
};

export const slugifyFieldKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
  crypto.randomUUID();

const COMMON_REUSABLE_SECTION_LABELS = new Set([
  'abilities',
  'appearance',
  'background',
  'background and traits',
  'biology',
  'culture',
  'cultural aspects',
  'description',
  'diet',
  'government',
  'history',
  'interaction with other races',
  'lifespan',
  'magic',
  'notes',
  'origin',
  'personality',
  'physical traits',
  'religion',
  'role in the story',
  'society',
  'traits'
]);

const titleWords = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/'s$/, '').trim())
    .filter((word) => word.length > 2);

const classifyImportSection = (
  title: string,
  category: EntityCategory,
  recordName: string
): WorldBibleImportSectionAction => {
  if (
    category.fieldSchema.some(
      (field) => canMapImportField(field) && isExistingFieldMatch(field, title)
    )
  ) {
    return 'existing-field';
  }

  const normalizedTitle = slugifyFieldKey(title).replace(/_/g, ' ');
  const recordWords = new Set(titleWords(recordName));
  const headingWords = titleWords(title);
  const mentionsRecord = headingWords.some((word) => recordWords.has(word));
  if (mentionsRecord) {
    return 'record-section';
  }

  if (COMMON_REUSABLE_SECTION_LABELS.has(normalizedTitle)) {
    return 'new-field';
  }

  if (/\b(and|with|in|of)\b/i.test(title)) {
    return 'record-section';
  }

  return 'record-section';
};

export const classifyImportSections = (
  sections: WorldBibleImportSectionDraft[],
  category: EntityCategory,
  recordName: string
): WorldBibleImportSectionDraft[] =>
  sections.map((section) => ({
    ...section,
    action: classifyImportSection(section.title, category, recordName)
  }));

export const isExistingFieldMatch = (
  field: EntityCategory['fieldSchema'][number],
  sectionTitle: string
): boolean => {
  const normalizedTitle = slugifyFieldKey(sectionTitle);
  return field.key === normalizedTitle || slugifyFieldKey(field.label) === normalizedTitle;
};

const canMapImportField = (field: EntityCategory['fieldSchema'][number]): boolean =>
  field.type === 'textarea' || field.type === 'text';

const trimCollapsedSectionTextFromName = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const nextHeadingMatch = normalized.match(
    /\s+(?:Background|Origin|Appearance|Traits|Culture|Cultural|Society|Interaction|Relations|Relationships|Role|Broader|Implications|History|Notes|Description|Personality|Abilities|Magic|Pheromones|Trafficking|Inclusion)(?:\s+[A-Z][A-Za-z'’/&-]*|\s+and|\s+or|\s+of|\s+with|\s+in|\s+the){0,8}:\s/i
  );
  const candidate = nextHeadingMatch
    ? normalized.slice(0, nextHeadingMatch.index).trim()
    : normalized;
  return candidate.length <= 80 ? candidate : '';
};

const SHEET_TITLE_PATTERN =
  /^(?:(?:character|race|species|item|location|faction)\s+)?sheet\s*[:\u2013\u2014-]\s*(.+)$/i;

export const detectImportDocumentName = (text: string, fileName: string): string => {
  const lines = text.replace(/\r/g, '').split('\n').map(normalizeImportLine);
  for (const line of lines.slice(0, 12)) {
    const pair = parseImportLabelValue(line);
    if (pair && IMPORT_NAME_LABELS.has(pair.label.toLowerCase()) && pair.value.trim()) {
      const name = trimCollapsedSectionTextFromName(stripInlineMarkdown(pair.value));
      if (name) return name;
    }
  }
  for (const line of lines.slice(0, 12)) {
    const title = line.replace(/^#{1,6}\s+/, '').match(SHEET_TITLE_PATTERN)?.[1];
    const name = title ? trimCollapsedSectionTextFromName(stripInlineMarkdown(title)) : '';
    if (name) return name;
  }
  return fileNameToEntityName(fileName);
};

const detectCollapsedImportSections = (text: string): WorldBibleImportSectionDraft[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const matches = Array.from(normalized.matchAll(COLLAPSED_SECTION_HEADING_PATTERN));
  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match, index) => {
      const title = match[1]?.trim() ?? '';
      const contentStart = (match.index ?? 0) + match[0].length;
      const contentEnd =
        index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
      return {
        id: `${slugifyFieldKey(title)}-${index}`,
        title,
        content: normalized.slice(contentStart, contentEnd).trim(),
        action: 'record-section' as const
      };
    })
    .filter((section) => section.title && section.content);
};

/**
 * Returns the section title each line starts, or null. Markdown headings
 * (including DOCX heading paragraphs, which the DOCX reader emits as
 * Markdown) always count; otherwise a line must look like a `Heading:` row.
 * A heading on the first line that has no content of its own before the next
 * heading is the document title, not a section.
 */
const scanSectionHeadings = (rawLines: string[]): Array<string | null> => {
  const lines = rawLines.map(normalizeImportLine);
  const titles = lines.map((line, index) => {
    if (!line) return null;
    const markdownTitle = getMarkdownHeadingTitle(rawLines[index]);
    if (markdownTitle) return markdownTitle;
    const previousLine = lines[index - 1] ?? '';
    const nextLine = lines.slice(index + 1).find(Boolean) ?? '';
    return looksLikeImportSectionHeading(line, previousLine, nextLine)
      ? line.slice(0, -1).trim()
      : null;
  });

  const firstIndex = lines.findIndex(Boolean);
  if (firstIndex >= 0 && getMarkdownHeadingTitle(rawLines[firstIndex])) {
    const nextIndex = lines.findIndex((line, index) => index > firstIndex && Boolean(line));
    if (nextIndex === -1 || titles[nextIndex]) {
      titles[firstIndex] = null;
    }
  }
  return titles;
};

const splitImportLines = (text: string): string[] => text.replace(/\r/g, '').split('\n');

export const detectImportSections = (text: string): WorldBibleImportSectionDraft[] => {
  const rawLines = splitImportLines(text);
  const titles = scanSectionHeadings(rawLines);
  const sections: Array<{title: string; contentLines: string[]}> = [];
  let currentSection: {title: string; contentLines: string[]} | null = null;

  rawLines.forEach((rawLine, index) => {
    const title = titles[index];
    if (title) {
      currentSection = {title, contentLines: []};
      sections.push(currentSection);
      return;
    }
    currentSection?.contentLines.push(rawLine.trimEnd());
  });

  const lineSections = sections
    .map((section, index) => ({
      id: `${slugifyFieldKey(section.title)}-${index}`,
      title: section.title,
      content: section.contentLines.join('\n').trim(),
      action: 'record-section' as const
    }))
    .filter((section) => section.content.length > 0);
  return lineSections.length > 0 ? lineSections : detectCollapsedImportSections(text);
};

const getImportIntroText = (
  text: string,
  sections: WorldBibleImportSectionDraft[]
): string => {
  if (sections.length === 0) return text.trim();
  const lines = splitImportLines(text);
  const firstLineSectionIndex = scanSectionHeadings(lines).findIndex(Boolean);
  if (firstLineSectionIndex >= 0) {
    return lines.slice(0, firstLineSectionIndex).join('\n').trim();
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  const firstCollapsedSection = normalized.match(
    new RegExp(COLLAPSED_SECTION_HEADING_PATTERN.source, 'i')
  );
  return firstCollapsedSection && firstCollapsedSection.index
    ? normalized.slice(0, firstCollapsedSection.index).trim()
    : '';
};

/** Label rows that fill a field whose label differs, e.g. `Occupation:` → Role. */
const LABEL_FIELD_ALIASES: Record<string, string[]> = {
  role: ['occupation', 'profession']
};

const isLabelAliasMatch = (
  field: EntityCategory['fieldSchema'][number],
  label: string
): boolean => (LABEL_FIELD_ALIASES[field.key] ?? []).includes(slugifyFieldKey(label));

/** Renders imported textarea content, keeping Markdown structure when the source has it. */
export const renderImportRichText = (value: string, format: ImportSourceFormat): string => {
  const trimmed = value.trim();
  if (!trimmed) return '<p></p>';
  if (format === 'markdown') return markdownToRichHtml(trimmed);

  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  const flush = () => {
    const paragraph = paragraphLines.join('\n').trim();
    if (paragraph) blocks.push(convertPlainTextToRichHtml(paragraph));
    paragraphLines = [];
  };
  trimmed.split('\n').forEach((line) => {
    const heading = line.match(MARKDOWN_HEADING_PATTERN);
    if (!heading) {
      paragraphLines.push(line);
      return;
    }
    flush();
    const level = heading[1].length;
    blocks.push(`<h${level}>${escapeHtml(heading[2].trim())}</h${level}>`);
  });
  flush();
  return blocks.join('') || '<p></p>';
};

/**
 * Copies `Label: value` rows from anywhere in the document into empty
 * existing fields whose label matches. Exact label matches win over aliases.
 */
const mapInlineLabelsToExistingFields = (
  category: EntityCategory,
  fields: Record<string, string>,
  sourceTexts: string[],
  format: ImportSourceFormat
): void => {
  sourceTexts.forEach((sourceText) => {
    splitImportLines(sourceText)
      .map(normalizeImportLine)
      .forEach((line) => {
        const pair = parseImportLabelValue(line);
        if (!pair) return;
        const candidates = category.fieldSchema.filter(
          (candidate) => canMapImportField(candidate) && !fields[candidate.key]
        );
        const field =
          candidates.find((candidate) => isExistingFieldMatch(candidate, pair.label)) ??
          candidates.find((candidate) => isLabelAliasMatch(candidate, pair.label));
        if (!field) return;
        fields[field.key] =
          field.type === 'textarea'
            ? renderImportRichText(pair.value, format)
            : stripInlineMarkdown(pair.value);
      });
  });
};

export const htmlToText = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  return parsed.body.textContent?.trim() ?? '';
};

export const sanitizeImportedHtml = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  parsed.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
  return parsed.body.innerHTML.trim() || '<p></p>';
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const renderMarkdownInline = (value: string): string => {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  return html;
};

const splitMarkdownTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isMarkdownTableSeparator = (line: string): boolean => {
  const cells = splitMarkdownTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
};

type MarkdownListItem = {
  content: string;
  ordered: boolean;
  level: number;
};

const buildMarkdownListHtml = (items: MarkdownListItem[]): string => {
  if (items.length === 0) return '';

  let html = '';
  // One entry per open list (true = ordered); each open list has one open <li>.
  const stack: boolean[] = [];
  const closeList = () => {
    html += '</li>';
    html += stack.pop() ? '</ol>' : '</ul>';
  };

  items.forEach((item) => {
    const level = Math.min(item.level, stack.length);
    while (stack.length > level + 1) {
      closeList();
    }
    if (stack.length === level + 1) {
      if (stack[level] === item.ordered) {
        html += '</li>';
      } else {
        closeList();
      }
    }
    while (stack.length < level + 1) {
      stack.push(item.ordered);
      html += item.ordered ? '<ol>' : '<ul>';
    }
    html += `<li>${renderMarkdownInline(item.content)}`;
  });

  while (stack.length > 0) {
    closeList();
  }
  return html;
};

const buildMarkdownTableHtml = (rows: string[]): string => {
  if (rows.length < 2) return '';
  const headerCells = splitMarkdownTableRow(rows[0]);
  const bodyRows = rows.slice(2).map(splitMarkdownTableRow).filter((cells) => cells.length > 0);
  if (headerCells.length === 0) return '';

  return (
    '<table><thead><tr>' +
    headerCells.map((cell) => `<th>${renderMarkdownInline(cell)}</th>`).join('') +
    '</tr></thead><tbody>' +
    bodyRows
      .map(
        (cells) =>
          '<tr>' +
          headerCells
            .map((_, index) => `<td>${renderMarkdownInline(cells[index] ?? '')}</td>`)
            .join('') +
          '</tr>'
      )
      .join('') +
    '</tbody></table>'
  );
};

export const markdownToRichHtml = (raw: string): string => {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p></p>';
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: MarkdownListItem[] = [];
  let blockquoteLines: string[] = [];
  let tableLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push(`<p>${renderMarkdownInline(paragraphLines.join('\n')).replace(/\n/g, '<br />')}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(buildMarkdownListHtml(listItems));
    listItems = [];
  };

  const flushBlockquote = () => {
    if (!blockquoteLines.length) return;
    blocks.push(
      `<blockquote><p>${renderMarkdownInline(blockquoteLines.join('\n')).replace(/\n/g, '<br />')}</p></blockquote>`
    );
    blockquoteLines = [];
  };

  const flushTable = () => {
    if (tableLines.length < 2) {
      if (tableLines.length === 1) {
        paragraphLines.push(tableLines[0]);
      }
      tableLines = [];
      return;
    }
    blocks.push(buildMarkdownTableHtml(tableLines));
    tableLines = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      return;
    }

    const nextLine = lines[index + 1]?.trim() ?? '';
    const isTableStart =
      trimmed.includes('|') && nextLine.includes('|') && isMarkdownTableSeparator(nextLine);
    const isTableContinuation =
      tableLines.length > 0 && trimmed.includes('|') && !/^#{1,6}\s+/.test(trimmed);
    if (isTableStart || isTableContinuation) {
      flushParagraph();
      flushList();
      flushBlockquote();
      tableLines.push(trimmed);
      if (!lines[index + 1]?.trim()) {
        flushTable();
      }
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      const level = Math.min(headingMatch[1].length, 6);
      blocks.push(`<h${level}>${renderMarkdownInline(headingMatch[2])}</h${level}>`);
      return;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      blocks.push('<hr />');
      return;
    }

    const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      flushTable();
      blockquoteLines.push(blockquoteMatch[1]);
      return;
    }

    flushBlockquote();

    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushTable();
      listItems.push({
        content: unorderedMatch[2],
        ordered: false,
        level: Math.floor(unorderedMatch[1].replace(/\t/g, '  ').length / 2)
      });
      return;
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushTable();
      listItems.push({
        content: orderedMatch[2],
        ordered: true,
        level: Math.floor(orderedMatch[1].replace(/\t/g, '  ').length / 2)
      });
      return;
    }

    if (listItems.length) {
      flushList();
    }
    flushTable();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushBlockquote();
  flushTable();
  return blocks.join('') || '<p></p>';
};

export const buildPreview = (text: string, limit = 180): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '(empty)';
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
};

export const mapImportedTextToFields = (
  category: EntityCategory,
  text: string,
  richTextHtml?: string,
  sections: WorldBibleImportSectionDraft[] = [],
  format: ImportSourceFormat = 'text'
): Record<string, string> => {
  const normalized = text.trim();
  const fields: Record<string, string> = {};
  const mappedSections: WorldBibleImportSectionDraft[] = [];
  const recordSections: WorldBibleImportSectionDraft[] = [];

  sections.forEach((section) => {
    if (section.action === 'ignore') return;
    if (section.action === 'record-section') {
      recordSections.push(section);
      return;
    }
    const field = category.fieldSchema.find((candidate) =>
      canMapImportField(candidate) && isExistingFieldMatch(candidate, section.title)
    );
    if (field) {
      mappedSections.push(section);
    } else if (section.action === 'existing-field') {
      recordSections.push(section);
    }
  });

  mappedSections.forEach((section) => {
    const field = category.fieldSchema.find((candidate) =>
      canMapImportField(candidate) && isExistingFieldMatch(candidate, section.title)
    );
    if (!field) return;
    // Same-named headings (or headings sharing one field) append, never overwrite.
    const value = field.type === 'textarea'
      ? renderImportRichText(section.content, format)
      : section.content;
    const previous = fields[field.key];
    fields[field.key] = previous
      ? field.type === 'textarea' ? `${previous}${value}` : `${previous}\n${value}`
      : value;
  });

  const preferredField =
    sections.length > 0
      ? category.fieldSchema.find((field) => field.key === 'description')
      : category.fieldSchema.find((field) => field.key === 'description') ??
        category.fieldSchema.find((field) => field.type === 'textarea') ??
        category.fieldSchema.find((field) => field.type === 'text');
  const descriptionText = sections.length > 0
    ? getImportIntroText(text, sections)
    : normalized;
  mapInlineLabelsToExistingFields(
    category,
    fields,
    [
      descriptionText,
      ...sections.filter((section) => section.action !== 'ignore').map((section) => section.content)
    ],
    format
  );
  const isRichPreferredField = preferredField?.type === 'textarea';
  const recordSectionText = recordSections
    .map((section) =>
      isRichPreferredField
        ? `## ${section.title}\n\n${section.content}`
        : `${section.title}\n${section.content}`
    )
    .join('\n\n')
    .trim();
  const descriptionWithRecordSections = [descriptionText, recordSectionText]
    .filter(Boolean)
    .join('\n\n');

  if (descriptionWithRecordSections && preferredField) {
    fields[preferredField.key] =
      preferredField.type === 'textarea'
        ? sections.length > 0
          ? renderImportRichText(descriptionWithRecordSections, format)
          : richTextHtml || renderImportRichText(descriptionWithRecordSections, format)
        : descriptionWithRecordSections;
  } else if (!sections.length && !preferredField) {
    fields.description = richTextHtml || renderImportRichText(normalized, format);
  }

  return fields;
};
