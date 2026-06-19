import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ChangeEvent, Dispatch, SetStateAction} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {saveEntity} from '../entityStorage';
import {saveCategory} from '../categoryStorage';
import {
  convertPlainTextToRichHtml,
  normalizeRichTextValue
} from '../services/worldBible/worldBibleEntityHelpers';

export type ImportMode = 'create' | 'upsert';

export interface WorldBibleImportDraft {
  id: string;
  fileName: string;
  name: string;
  text: string;
  richTextHtml?: string;
  preview: string;
  categoryId: string;
  mode: ImportMode;
  include: boolean;
  detectedSections?: WorldBibleImportSectionDraft[];
  useDetectedSections?: boolean;
  parseError?: string;
}

export interface WorldBibleImportSectionDraft {
  id: string;
  title: string;
  content: string;
}

interface JsonImportRowInput {
  rowIndex: number;
  record: Record<string, unknown>;
}

export interface JsonImportSession {
  fileName: string;
  rows: JsonImportRowInput[];
  keys: string[];
  categoryId: string;
  mode: ImportMode;
  nameKey: string;
  fieldMap: Record<string, string>;
}

export type JsonImportConflictResolution = ImportMode | 'skip';

interface JsonImportConflict {
  kind: 'existing' | 'batch-duplicate';
  message: string;
}

export interface JsonImportPreparedRow {
  rowIndex: number;
  name: string;
  fields: Record<string, string>;
  errors: string[];
  existingEntityId?: string;
  conflict?: JsonImportConflict;
  resolution: JsonImportConflictResolution;
}

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleImportsParams {
  activeProjectId: string | null;
  activeCategory: EntityCategory | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  onEntitySaved?: (entity: WorldEntity, category: EntityCategory) => Promise<void>;
  onEntitiesChanged?: () => Promise<void>;
}

const fileNameToEntityName = (name: string): string => {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/^\s*(?:race|species|character|item|location|faction)\s+sheet\s*/i, '')
    .trim();
  return base || 'Imported entry';
};

const normalizeImportLine = (line: string): string =>
  line
    .replace(/^[\s\u200f\u200e]+/g, '')
    .replace(/^[•*·▪◦]\s*/u, '')
    .replace(/\t+/g, ' ')
    .trim();

const parseImportLabelValue = (line: string): {label: string; value: string} | null => {
  const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
  if (!match) return null;
  return {label: match[1].trim(), value: match[2].trim()};
};

const IMPORT_NAME_LABELS = new Set(['name', 'title', 'concept', 'race', 'species']);
const COLLAPSED_SECTION_HEADING_PATTERN =
  /\b(Background(?:\s+and\s+[A-Z][A-Za-z'’/-]+)?|[A-Z][A-Za-z'’/-]+\s+and\s+[A-Z][A-Za-z'’/-]+|Interaction\s+with\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*|Role\s+in\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*|Broader\s+Implications|Inclusion\s+of\s+[A-Z][A-Za-z'’/-]+(?:\s+[A-Z][A-Za-z'’/-]+)*):\s/gi;
const INLINE_LABEL_PATTERN = /^[A-Z][A-Za-z'’/-]{1,32}(?:\s+[A-Z][A-Za-z'’/-]{1,32}){0,2}$/;

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
  if (INLINE_LABEL_PATTERN.test(candidate) && !/\b(and|with|in|of)\b/i.test(candidate)) {
    return !previousLine && Boolean(nextLine) && !parseImportLabelValue(nextLine);
  }
  return true;
};

const slugifyFieldKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
  crypto.randomUUID();

const isExistingFieldMatch = (
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

export const detectImportDocumentName = (text: string, fileName: string): string => {
  const lines = text.replace(/\r/g, '').split('\n').map(normalizeImportLine);
  for (const line of lines.slice(0, 12)) {
    const pair = parseImportLabelValue(line);
    if (pair && IMPORT_NAME_LABELS.has(pair.label.toLowerCase()) && pair.value.trim()) {
      const name = trimCollapsedSectionTextFromName(pair.value);
      if (name) return name;
    }
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
        content: normalized.slice(contentStart, contentEnd).trim()
      };
    })
    .filter((section) => section.title && section.content);
};

export const detectImportSections = (text: string): WorldBibleImportSectionDraft[] => {
  const lines = text.replace(/\r/g, '').split('\n').map(normalizeImportLine);
  const sections: Array<{title: string; contentLines: string[]}> = [];
  let currentSection: {title: string; contentLines: string[]} | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      if (currentSection) currentSection.contentLines.push('');
      continue;
    }

    const previousLine = lines[index - 1] ?? '';
    const nextLine = lines.slice(index + 1).find(Boolean) ?? '';
    if (looksLikeImportSectionHeading(line, previousLine, nextLine)) {
      currentSection = {title: line.slice(0, -1).trim(), contentLines: []};
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.contentLines.push(line);
    }
  }

  const lineSections = sections
    .map((section, index) => ({
      id: `${slugifyFieldKey(section.title)}-${index}`,
      title: section.title,
      content: section.contentLines.join('\n').trim()
    }))
    .filter((section) => section.content.length > 0);
  return lineSections.length > 0 ? lineSections : detectCollapsedImportSections(text);
};

const findFirstLineSectionIndex = (lines: string[]): number => {
  const normalizedLines = lines.map(normalizeImportLine);
  return normalizedLines.findIndex((line, index) => {
    if (!line) return false;
    const previousLine = normalizedLines[index - 1] ?? '';
    const nextLine = normalizedLines.slice(index + 1).find(Boolean) ?? '';
    return looksLikeImportSectionHeading(line, previousLine, nextLine);
  });
};

const getImportIntroText = (
  text: string,
  sections: WorldBibleImportSectionDraft[]
): string => {
  if (sections.length === 0) return text.trim();
  const lines = text.replace(/\r/g, '').split('\n');
  const firstLineSectionIndex = findFirstLineSectionIndex(lines);
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

const mapInlineLabelsToExistingFields = (
  category: EntityCategory,
  fields: Record<string, string>,
  sections: WorldBibleImportSectionDraft[]
): void => {
  sections.forEach((section) => {
    section.content
      .replace(/\r/g, '')
      .split('\n')
      .map(normalizeImportLine)
      .forEach((line) => {
        const pair = parseImportLabelValue(line);
        if (!pair) return;
        const field = category.fieldSchema.find(
          (candidate) =>
            canMapImportField(candidate) &&
            !fields[candidate.key] &&
            isExistingFieldMatch(candidate, pair.label)
        );
        if (!field) return;
        fields[field.key] =
          field.type === 'textarea'
            ? normalizeRichTextValue(pair.value)
            : pair.value;
      });
  });
};

const htmlToText = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  return parsed.body.textContent?.trim() ?? '';
};

const sanitizeImportedHtml = (raw: string): string => {
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
  const stack: boolean[] = [];

  items.forEach((item, index) => {
    const next = items[index + 1];

    while (stack.length > item.level + 1) {
      html += '</li>';
      const closingOrdered = stack.pop();
      html += closingOrdered ? '</ol>' : '</ul>';
    }

    if (stack.length === item.level + 1) {
      html += '</li>';
      if (stack[stack.length - 1] !== item.ordered) {
        const closingOrdered = stack.pop();
        html += closingOrdered ? '</ol>' : '</ul>';
      }
    }

    while (stack.length < item.level + 1) {
      stack.push(item.ordered);
      html += item.ordered ? '<ol>' : '<ul>';
    }

    html += `<li>${renderMarkdownInline(item.content)}`;

    const shouldNest =
      next &&
      (next.level > item.level ||
        (next.level === item.level && next.ordered !== item.ordered));
    if (!shouldNest) {
      html += '</li>';
    }
  });

  while (stack.length > 0) {
    const closingOrdered = stack.pop();
    html += closingOrdered ? '</ol>' : '</ul>';
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

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const findDocxDocumentEntry = (
  bytes: Uint8Array
): {
  compressionMethod: number;
  compressedData: Uint8Array;
} | null => {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;

  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
    if (readU32LE(bytes, i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.length) return null;

  const decoder = new TextDecoder('utf-8');
  let cursor = centralDirectoryOffset;

  while (cursor + 46 <= centralDirectoryEnd) {
    if (readU32LE(bytes, cursor) !== centralSignature) {
      break;
    }
    const compressionMethod = readU16LE(bytes, cursor + 10);
    const compressedSize = readU32LE(bytes, cursor + 20);
    const fileNameLength = readU16LE(bytes, cursor + 28);
    const extraLength = readU16LE(bytes, cursor + 30);
    const commentLength = readU16LE(bytes, cursor + 32);
    const localHeaderOffset = readU32LE(bytes, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > bytes.length) return null;

    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
    cursor = fileNameEnd + extraLength + commentLength;

    if (fileName !== 'word/document.xml') continue;
    if (localHeaderOffset + 30 > bytes.length) return null;
    if (readU32LE(bytes, localHeaderOffset) !== localSignature) return null;

    const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;

    return {
      compressionMethod,
      compressedData: bytes.slice(dataStart, dataEnd)
    };
  }

  return null;
};

const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
  const copy = new Uint8Array(compressedData.byteLength);
  copy.set(compressedData);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(
    new DecompressionStream('deflate-raw')
  );
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
};

const docxXmlToText = (xml: string): string => {
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:cr\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  const parser = new DOMParser();
  const decoded = parser.parseFromString(
    `<!doctype html><body>${withoutTags}`,
    'text/html'
  ).body.textContent;
  return decoded?.trim() ?? '';
};

const parseDocxToText = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entry = findDocxDocumentEntry(bytes);
  if (!entry) {
    throw new Error('Could not read DOCX structure.');
  }

  let xmlBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    xmlBytes = entry.compressedData;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateRaw(entry.compressedData);
  } else {
    throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
  }

  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  return docxXmlToText(xml);
};

const buildPreview = (text: string, limit = 180): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '(empty)';
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
};

const valueToString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => valueToString(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
};

export const mapImportedTextToFields = (
  category: EntityCategory,
  text: string,
  richTextHtml?: string,
  sections: WorldBibleImportSectionDraft[] = []
): Record<string, string> => {
  const normalized = text.trim();
  const fields: Record<string, string> = {};

  sections.forEach((section) => {
    const field = category.fieldSchema.find((candidate) =>
      canMapImportField(candidate) && isExistingFieldMatch(candidate, section.title)
    );
    if (!field) return;
    fields[field.key] =
      field.type === 'textarea' ? normalizeRichTextValue(section.content) : section.content;
  });
  mapInlineLabelsToExistingFields(category, fields, sections);

  const preferredField =
    sections.length > 0
      ? category.fieldSchema.find((field) => field.key === 'description')
      : category.fieldSchema.find((field) => field.key === 'description') ??
        category.fieldSchema.find((field) => field.type === 'textarea') ??
        category.fieldSchema.find((field) => field.type === 'text');
  const descriptionText = sections.length > 0
    ? getImportIntroText(text, sections)
    : normalized;

  if (descriptionText && preferredField) {
    fields[preferredField.key] =
      preferredField.type === 'textarea'
        ? sections.length > 0
          ? normalizeRichTextValue(descriptionText)
          : richTextHtml || normalizeRichTextValue(descriptionText)
        : descriptionText;
  } else if (!sections.length && !preferredField) {
    fields.description = richTextHtml || normalizeRichTextValue(normalized);
  }

  return fields;
};

const ensureSectionFields = async (
  category: EntityCategory,
  sections: WorldBibleImportSectionDraft[]
): Promise<EntityCategory> => {
  if (sections.length === 0) return category;
  const existingKeys = new Set(category.fieldSchema.map((field) => field.key));
  const nextFields = [...category.fieldSchema];
  let changed = false;

  sections.forEach((section) => {
    const existing = nextFields.find((field) => isExistingFieldMatch(field, section.title));
    if (existing) return;

    const baseKey = slugifyFieldKey(section.title);
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    existingKeys.add(key);
    nextFields.push({key, label: section.title, type: 'textarea'});
    changed = true;
  });

  if (!changed) return category;
  const updatedCategory = {...category, fieldSchema: nextFields};
  await saveCategory(updatedCategory);
  return updatedCategory;
};

interface ApplyImportDraftOptions {
  draftIds?: string[];
}

export const useWorldBibleImports = ({
  activeProjectId,
  activeCategory,
  categories,
  entities,
  setCategories,
  setEntities,
  setFeedback,
  onEntitySaved,
  onEntitiesChanged
}: UseWorldBibleImportsParams) => {
  const [isImportingEntities, setIsImportingEntities] = useState(false);
  const [isApplyingImports, setIsApplyingImports] = useState(false);
  const [importDrafts, setImportDrafts] = useState<WorldBibleImportDraft[]>([]);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [isApplyingJsonImport, setIsApplyingJsonImport] = useState(false);
  const [jsonImportSession, setJsonImportSession] = useState<JsonImportSession | null>(
    null
  );
  const [jsonImportConflictResolutions, setJsonImportConflictResolutions] = useState<
    Record<number, JsonImportConflictResolution>
  >({});

  useEffect(() => {
    if (!activeProjectId) {
      setImportDrafts([]);
      setJsonImportSession(null);
      setJsonImportConflictResolutions({});
    }
  }, [activeProjectId]);

  const activeJsonCategory = useMemo(
    () =>
      jsonImportSession
        ? categories.find((category) => category.id === jsonImportSession.categoryId) ?? null
        : null,
    [categories, jsonImportSession]
  );

  const preparedJsonRows = useMemo<JsonImportPreparedRow[]>(() => {
    if (!jsonImportSession || !activeJsonCategory) return [];
    const existingByName = new Map(
      entities
        .filter((entity) => entity.categoryId === jsonImportSession.categoryId)
        .map((entity) => [entity.name.trim().toLowerCase(), entity])
    );
    const duplicateNameCounts = new Map<string, number>();
    jsonImportSession.rows.forEach((row) => {
      const nameRaw = valueToString(row.record[jsonImportSession.nameKey]);
      const normalized = nameRaw.trim().toLowerCase();
      if (!normalized) return;
      duplicateNameCounts.set(normalized, (duplicateNameCounts.get(normalized) ?? 0) + 1);
    });

    return jsonImportSession.rows.map((row) => {
      const errors: string[] = [];
      const nameRaw = valueToString(row.record[jsonImportSession.nameKey]);
      const name = nameRaw.trim();
      if (!name) {
        errors.push('Missing name value.');
      }

      const fields: Record<string, string> = {};
      for (const field of activeJsonCategory.fieldSchema) {
        const mappedKey = jsonImportSession.fieldMap[field.key];
        if (!mappedKey) {
          if (field.required) {
            errors.push(`Required field "${field.label}" is not mapped.`);
          }
          continue;
        }
        const value = valueToString(row.record[mappedKey]);
        if (field.required && !value) {
          errors.push(`Required field "${field.label}" is empty.`);
        }
        if (value) {
          fields[field.key] = value;
        }
      }
      const normalizedName = name.trim().toLowerCase();
      const existingEntity = normalizedName
        ? existingByName.get(normalizedName)
        : undefined;
      const hasBatchDuplicate = normalizedName
        ? (duplicateNameCounts.get(normalizedName) ?? 0) > 1
        : false;
      const conflict =
        jsonImportSession.mode === 'create' && existingEntity
          ? {
              kind: 'existing' as const,
              message: `Matches existing ${activeJsonCategory.name.slice(0, -1).toLowerCase()} "${existingEntity.name}". Choose whether to create a duplicate, update it, or skip this row.`
            }
          : hasBatchDuplicate
            ? {
                kind: 'batch-duplicate' as const,
                message:
                  'Another JSON row uses this same name in the selected category. Choose whether to create, update by name, or skip this row.'
              }
            : undefined;
      const resolution =
        jsonImportConflictResolutions[row.rowIndex] ??
        (conflict ? ('skip' as const) : jsonImportSession.mode);
      return {
        rowIndex: row.rowIndex,
        name,
        fields,
        errors,
        existingEntityId: existingEntity?.id,
        conflict,
        resolution
      };
    });
  }, [activeJsonCategory, entities, jsonImportConflictResolutions, jsonImportSession]);

  const jsonImportValidCount = preparedJsonRows.filter(
    (row) => row.errors.length === 0
  ).length;
  const jsonImportConflictCount = preparedJsonRows.filter((row) => row.conflict).length;
  const unresolvedJsonConflictCount = preparedJsonRows.filter(
    (row) => row.conflict && !jsonImportConflictResolutions[row.rowIndex]
  ).length;

  const handleImportEntities = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProjectId || !activeCategory) return;
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsImportingEntities(true);
    setFeedback(null);
    const drafts: WorldBibleImportDraft[] = [];
    let parseFailures = 0;

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith('.doc')) {
            parseFailures += 1;
            drafts.push({
              id: crypto.randomUUID(),
              fileName: file.name,
              name: fileNameToEntityName(file.name),
              text: '',
              preview: '',
              categoryId: activeCategory.id,
              mode: 'create',
              include: false,
              parseError:
                'Legacy .doc files are not supported yet. Convert to .docx, .txt, or .md.'
            });
            continue;
          }
          const raw = lower.endsWith('.docx')
            ? await parseDocxToText(file)
            : await file.text();
          const richTextHtml =
            lower.endsWith('.html') || lower.endsWith('.htm')
              ? sanitizeImportedHtml(raw)
              : lower.endsWith('.md') || lower.endsWith('.markdown')
                ? markdownToRichHtml(raw)
                : convertPlainTextToRichHtml(raw.trim());
          const text =
            lower.endsWith('.html') || lower.endsWith('.htm')
              ? htmlToText(raw)
              : raw.trim();
          const detectedSections = detectImportSections(text);
          drafts.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            name: detectImportDocumentName(text, file.name),
            text,
            richTextHtml,
            preview: buildPreview(text),
            categoryId: activeCategory.id,
            mode: 'create',
            include: true,
            detectedSections,
            useDetectedSections: detectedSections.length > 0
          });
        } catch {
          parseFailures += 1;
          drafts.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            name: fileNameToEntityName(file.name),
            text: '',
            preview: '',
            categoryId: activeCategory.id,
            mode: 'create',
            include: false,
            parseError: 'Failed to parse this file.'
          });
        }
      }
      setImportDrafts(drafts);
      setFeedback({
        tone: parseFailures > 0 ? 'error' : 'success',
        message:
          parseFailures > 0
            ? `Prepared ${drafts.length - parseFailures} import draft(s); ${parseFailures} file(s) need attention.`
            : `Prepared ${drafts.length} import draft(s). Review and apply when ready.`
      });
    } finally {
      setIsImportingEntities(false);
      event.target.value = '';
    }
  }, [activeCategory, activeProjectId, setFeedback]);

  const updateImportDraft = useCallback(
    (draftId: string, updates: Partial<WorldBibleImportDraft>) => {
      setImportDrafts((prev) =>
        prev.map((draft) => (draft.id === draftId ? {...draft, ...updates} : draft))
      );
    },
    []
  );

  const handleJsonImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProjectId || !activeCategory) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingJson(true);
    setFeedback(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const recordsSource = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null
          ? ((parsed as Record<string, unknown>).entries ??
            (parsed as Record<string, unknown>).items ??
            (parsed as Record<string, unknown>).rows)
          : null;

      if (!Array.isArray(recordsSource)) {
        throw new Error(
          'JSON must be an array of objects or an object with entries/items/rows.'
        );
      }

      const rows: JsonImportRowInput[] = [];
      const keySet = new Set<string>();
      recordsSource.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        const record = item as Record<string, unknown>;
        Object.keys(record).forEach((key) => keySet.add(key));
        rows.push({
          rowIndex: index + 1,
          record
        });
      });

      if (rows.length === 0) {
        throw new Error('No object rows found in JSON.');
      }

      const keys = Array.from(keySet).sort();
      const defaultNameKey = keys.includes('name') ? 'name' : (keys[0] ?? '');
      const defaultFieldMap: Record<string, string> = {};
      activeCategory.fieldSchema.forEach((field) => {
        defaultFieldMap[field.key] = keys.includes(field.key) ? field.key : '';
      });

      setJsonImportSession({
        fileName: file.name,
        rows,
        keys,
        categoryId: activeCategory.id,
        mode: 'create',
        nameKey: defaultNameKey,
        fieldMap: defaultFieldMap
      });
      setJsonImportConflictResolutions({});
      setFeedback({
        tone: 'success',
        message: `Loaded ${rows.length} JSON row(s). Map fields and apply when ready.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to parse JSON import file.';
      setFeedback({tone: 'error', message});
      setJsonImportSession(null);
      setJsonImportConflictResolutions({});
    } finally {
      setIsImportingJson(false);
      event.target.value = '';
    }
  }, [activeCategory, activeProjectId, setFeedback]);

  const handleJsonCategoryChange = useCallback((categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    setJsonImportSession((prev) => {
      if (!prev) return prev;
      const nextFieldMap: Record<string, string> = {};
      if (category) {
        category.fieldSchema.forEach((field) => {
          nextFieldMap[field.key] = prev.keys.includes(field.key) ? field.key : '';
        });
      }
      return {
        ...prev,
        categoryId,
        fieldMap: nextFieldMap
      };
    });
    setJsonImportConflictResolutions({});
  }, [categories]);

  const handleJsonFieldMapChange = useCallback((fieldKey: string, sourceKey: string) => {
    setJsonImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fieldMap: {
          ...prev.fieldMap,
          [fieldKey]: sourceKey
        }
      };
    });
  }, []);

  const handleJsonConflictResolutionChange = useCallback(
    (rowIndex: number, resolution: JsonImportConflictResolution) => {
      setJsonImportConflictResolutions((prev) => ({
        ...prev,
        [rowIndex]: resolution
      }));
    },
    []
  );

  const handleJsonNameKeyChange = useCallback((nameKey: string) => {
    setJsonImportSession((prev) => (prev ? {...prev, nameKey} : prev));
  }, []);

  const handleJsonModeChange = useCallback((mode: ImportMode) => {
    setJsonImportSession((prev) => (prev ? {...prev, mode} : prev));
  }, []);

  const clearImportDrafts = useCallback(() => {
    setImportDrafts([]);
  }, []);

  const clearJsonImportSession = useCallback(() => {
    setJsonImportSession(null);
    setJsonImportConflictResolutions({});
  }, []);

  const applyImportDrafts = useCallback(async (options?: ApplyImportDraftOptions) => {
    if (!activeProjectId) return null;
    const queuedDrafts = importDrafts.filter(
      (draft) =>
        draft.include &&
        !draft.parseError &&
        (!options?.draftIds || options.draftIds.includes(draft.id))
    );
    if (queuedDrafts.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid import drafts selected.'
      });
      return null;
    }

    setIsApplyingImports(true);
    setFeedback(null);
    const nextEntities = [...entities];
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let categoriesChanged = false;
    let firstImportedEntity: WorldEntity | null = null;

    try {
      for (const draft of queuedDrafts) {
        const category = categoryById.get(draft.categoryId);
        if (!category) {
          failedCount += 1;
          continue;
        }

        try {
          const sectionDrafts = draft.useDetectedSections
            ? draft.detectedSections ?? []
            : [];
          const importCategory = await ensureSectionFields(category, sectionDrafts);
          if (importCategory !== category) {
            categoryById.set(importCategory.id, importCategory);
            categoriesChanged = true;
          }
          const now = Date.now();
          const normalizedName = draft.name.trim().toLowerCase();
          const existing =
            draft.mode === 'upsert'
              ? nextEntities.find(
                  (entity) =>
                    entity.categoryId === draft.categoryId &&
                    entity.name.trim().toLowerCase() === normalizedName
                )
              : undefined;

          const entity: WorldEntity = existing
            ? {
                ...existing,
                fields: {
                  ...existing.fields,
                  ...mapImportedTextToFields(
                    importCategory,
                    draft.text,
                    draft.richTextHtml,
                    sectionDrafts
                  )
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                categoryId: draft.categoryId,
                name: draft.name.trim() || fileNameToEntityName(draft.fileName),
                fields: mapImportedTextToFields(
                  importCategory,
                  draft.text,
                  draft.richTextHtml,
                  sectionDrafts
                ),
                needsCompletion: false,
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          await onEntitySaved?.(entity, importCategory);
          if (!firstImportedEntity) {
            firstImportedEntity = entity;
          }

          if (existing) {
            const idx = nextEntities.findIndex((item) => item.id === existing.id);
            if (idx !== -1) nextEntities[idx] = entity;
            updatedCount += 1;
          } else {
            nextEntities.push(entity);
            createdCount += 1;
          }
        } catch {
          failedCount += 1;
        }
      }

      setEntities(nextEntities);
      if (categoriesChanged) {
        setCategories(Array.from(categoryById.values()));
      }
      if (createdCount + updatedCount > 0) {
        await onEntitiesChanged?.();
      }

      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `Imported ${createdCount} new entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });

      if (failedCount === 0) {
        if (options?.draftIds?.length) {
          setImportDrafts((prev) =>
            prev.filter((draft) => !options.draftIds?.includes(draft.id))
          );
        } else {
          setImportDrafts([]);
        }
      }

      return firstImportedEntity;
    } finally {
      setIsApplyingImports(false);
    }
  }, [
    activeProjectId,
    categories,
    entities,
    importDrafts,
    onEntitiesChanged,
    onEntitySaved,
    setCategories,
    setEntities,
    setFeedback
  ]);

  const applyJsonImport = useCallback(async () => {
    if (!activeProjectId || !jsonImportSession || !activeJsonCategory) return;
    const validRows = preparedJsonRows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid JSON rows to import. Fix mapping/validation first.'
      });
      return;
    }
    if (unresolvedJsonConflictCount > 0) {
      setFeedback({
        tone: 'error',
        message: `Review ${unresolvedJsonConflictCount} conflicting JSON row(s) before importing.`
      });
      return;
    }

    setIsApplyingJsonImport(true);
    setFeedback(null);
    const nextEntities = [...entities];
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const row of validRows) {
        try {
          if (row.resolution === 'skip') {
            skippedCount += 1;
            continue;
          }
          const now = Date.now();
          const normalizedName = row.name.trim().toLowerCase();
          const existing =
            row.resolution === 'upsert'
              ? nextEntities.find(
                  (entity) =>
                    entity.categoryId === jsonImportSession.categoryId &&
                    entity.name.trim().toLowerCase() === normalizedName
                )
              : undefined;
          const normalizedRowFields = {...row.fields};
          activeJsonCategory.fieldSchema.forEach((field) => {
            if (field.type !== 'textarea') return;
            const rawValue = normalizedRowFields[field.key];
            normalizedRowFields[field.key] =
              typeof rawValue === 'string' ? normalizeRichTextValue(rawValue) : '<p></p>';
          });

          const entity: WorldEntity = existing
            ? {
                ...existing,
                fields: {
                  ...existing.fields,
                  ...normalizedRowFields
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                categoryId: jsonImportSession.categoryId,
                name: row.name,
                fields: normalizedRowFields,
                needsCompletion: false,
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          await onEntitySaved?.(entity, activeJsonCategory);

          if (existing) {
            const idx = nextEntities.findIndex((item) => item.id === existing.id);
            if (idx !== -1) nextEntities[idx] = entity;
            updatedCount += 1;
          } else {
            nextEntities.push(entity);
            createdCount += 1;
          }
        } catch {
          failedCount += 1;
        }
      }

      setEntities(nextEntities);
      await onEntitiesChanged?.();
      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `JSON import created ${createdCount} entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (skippedCount > 0 ? ` Skipped ${skippedCount}.` : '') +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });
      if (failedCount === 0) {
        clearJsonImportSession();
      }
    } finally {
      setIsApplyingJsonImport(false);
    }
  }, [
    activeJsonCategory,
    activeProjectId,
    clearJsonImportSession,
    entities,
    jsonImportSession,
    onEntitiesChanged,
    onEntitySaved,
    preparedJsonRows,
    setEntities,
    setFeedback,
    unresolvedJsonConflictCount
  ]);

  return {
    isImportingEntities,
    isApplyingImports,
    importDrafts,
    clearImportDrafts,
    isImportingJson,
    isApplyingJsonImport,
    jsonImportSession,
    jsonImportConflictResolutions,
    activeJsonCategory,
    preparedJsonRows,
    jsonImportValidCount,
    jsonImportConflictCount,
    unresolvedJsonConflictCount,
    handleImportEntities,
    updateImportDraft,
    applyImportDrafts,
    applyJsonImport,
    handleJsonImportFile,
    handleJsonCategoryChange,
    handleJsonNameKeyChange,
    handleJsonModeChange,
    handleJsonFieldMapChange,
    handleJsonConflictResolutionChange,
    clearJsonImportSession
  };
};
