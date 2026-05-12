import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ChangeEvent, Dispatch, SetStateAction} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {
  convertPlainTextToRichHtml,
  extractPlainTextFromRichText
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
  parseError?: string;
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
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
}

const fileNameToEntityName = (name: string): string => {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || 'Imported entry';
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

const markdownToRichHtml = (raw: string): string => {
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
    blocks.push(`<p>${renderMarkdownInline(paragraphLines.join('<br />'))}</p>`);
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
      `<blockquote><p>${renderMarkdownInline(blockquoteLines.join('<br />'))}</p></blockquote>`
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

export const useWorldBibleImports = ({
  activeProjectId,
  activeCategory,
  categories,
  entities,
  setFeedback
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
              : extractPlainTextFromRichText(richTextHtml);
          drafts.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            name: fileNameToEntityName(file.name),
            text,
            richTextHtml,
            preview: buildPreview(text),
            categoryId: activeCategory.id,
            mode: 'create',
            include: true
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

  return {
    isImportingEntities,
    setIsApplyingImports,
    isApplyingImports,
    importDrafts,
    setImportDrafts,
    isImportingJson,
    isApplyingJsonImport,
    setIsApplyingJsonImport,
    jsonImportSession,
    setJsonImportSession,
    jsonImportConflictResolutions,
    setJsonImportConflictResolutions,
    activeJsonCategory,
    preparedJsonRows,
    jsonImportValidCount,
    jsonImportConflictCount,
    unresolvedJsonConflictCount,
    handleImportEntities,
    updateImportDraft,
    handleJsonImportFile,
    handleJsonCategoryChange,
    handleJsonFieldMapChange,
    handleJsonConflictResolutionChange
  };
};
