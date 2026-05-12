export const ALTERNATIVE_NAMES_KEY = 'alternativeNames';

export const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const parseAlternativeNames = (value: string): string[] =>
  Array.from(
    new Map(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item])
    ).values()
  );

export const formatAlternativeNames = (names: string[]): string => names.join(', ');

const RICH_TEXT_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

export const convertPlainTextToRichHtml = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<p></p>';
  }

  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
};

export const normalizeRichTextValue = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<p></p>';
  }
  return RICH_TEXT_TAG_PATTERN.test(trimmed) ? trimmed : convertPlainTextToRichHtml(trimmed);
};

export const extractPlainTextFromRichText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!RICH_TEXT_TAG_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (typeof DOMParser === 'undefined') {
    return trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parser = new DOMParser();
  const decoded = parser.parseFromString(
    `<!doctype html><body>${trimmed}`,
    'text/html'
  ).body.textContent;
  return decoded?.replace(/\s+/g, ' ').trim() ?? '';
};

const normalizeSummarySegment = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s*([,;:.!?])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

const summarizeTable = (table: HTMLTableElement): string[] => {
  const rows = Array.from(table.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .map((cell) => normalizeSummarySegment(cell.textContent ?? ''))
        .filter(Boolean)
    )
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return [];
  }

  const headerRow = Array.from(table.querySelectorAll('tr')).find((row) =>
    row.querySelector('th')
  );
  const headers = headerRow
    ? Array.from(headerRow.querySelectorAll('th'))
        .map((cell) => normalizeSummarySegment(cell.textContent ?? ''))
        .filter(Boolean)
    : [];
  const dataRows = headerRow ? rows.slice(1) : rows;

  if (headers.length > 0 && dataRows.length > 0) {
    return dataRows.map((cells) =>
      cells
        .map((cell, index) =>
          headers[index] ? `${headers[index]}: ${cell}` : cell
        )
        .filter(Boolean)
        .join(' | ')
    );
  }

  return rows.map((cells) => cells.join(' | '));
};

export const extractStructuredSummaryFromRichText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!RICH_TEXT_TAG_PATTERN.test(trimmed)) {
    return trimmed.replace(/\s+/g, ' ').trim();
  }

  if (typeof DOMParser === 'undefined') {
    return extractPlainTextFromRichText(trimmed);
  }

  const parser = new DOMParser();
  const body = parser.parseFromString(`<!doctype html><body>${trimmed}`, 'text/html').body;

  const blocks: string[] = [];

  Array.from(body.children).forEach((node) => {
    if (node instanceof HTMLUListElement || node instanceof HTMLOListElement) {
      const items = Array.from(node.children)
        .filter((child): child is HTMLLIElement => child instanceof HTMLLIElement)
        .map((item) => normalizeSummarySegment(item.textContent ?? ''))
        .filter(Boolean)
        .map((item) => `- ${item}`);
      blocks.push(...items);
      return;
    }

    if (node instanceof HTMLTableElement) {
      blocks.push(...summarizeTable(node));
      return;
    }

    if (node instanceof HTMLQuoteElement) {
      const text = normalizeSummarySegment(node.textContent ?? '');
      if (text) {
        blocks.push(`"${text}"`);
      }
      return;
    }

    if (node instanceof HTMLHRElement) {
      blocks.push('---');
      return;
    }

    const text = normalizeSummarySegment(node.textContent ?? '');
    if (text) {
      blocks.push(text);
    }
  });

  if (blocks.length === 0) {
    return extractPlainTextFromRichText(trimmed);
  }

  return blocks
    .join(' \u2022 ')
    .replace(/\s+\u2022\s+---\s+\u2022\s+/g, ' --- ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isRichTextEffectivelyEmpty = (value: string): boolean =>
  extractPlainTextFromRichText(value).length === 0;

export const buildCanonicalAliasList = (params: {
  previousName?: string;
  nextName: string;
  aliases: string[];
}): string[] => {
  const nextNormalized = params.nextName.trim().toLowerCase();
  const previousNormalized = params.previousName?.trim().toLowerCase() ?? '';
  const combined = [...params.aliases];
  if (previousNormalized && nextNormalized && previousNormalized !== nextNormalized) {
    combined.unshift(params.previousName!.trim());
  }
  return Array.from(
    new Map(
      combined
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0 && alias.toLowerCase() !== nextNormalized)
        .map((alias) => [alias.toLowerCase(), alias])
    ).values()
  );
};

export const mergeEntityFields = (
  targetFields: Record<string, unknown>,
  sourceFields: Record<string, unknown>
): Record<string, unknown> => {
  const merged = {...targetFields};

  Object.entries(sourceFields).forEach(([key, value]) => {
    const existing = merged[key];
    const normalizedExisting = typeof existing === 'string' ? existing.trim() : existing;
    const normalizedIncoming = typeof value === 'string' ? value.trim() : value;

    if (
      normalizedExisting === undefined ||
      normalizedExisting === null ||
      normalizedExisting === '' ||
      (Array.isArray(normalizedExisting) && normalizedExisting.length === 0)
    ) {
      merged[key] = value;
      return;
    }

    if (
      key === ALTERNATIVE_NAMES_KEY &&
      (typeof normalizedExisting === 'string' || typeof normalizedIncoming === 'string')
    ) {
      merged[key] = formatAlternativeNames(
        parseAlternativeNames(
          [String(normalizedExisting ?? ''), String(normalizedIncoming ?? '')]
            .filter(Boolean)
            .join(', ')
        )
      );
    }
  });

  return merged;
};

const normalizeFieldValueForComparison = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const normalized = extractPlainTextFromRichText(value);
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => item !== '' && item !== null && item !== undefined);
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value ?? null;
};

const fieldValuesMatch = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = normalizeFieldValueForComparison(left);
  const normalizedRight = normalizeFieldValueForComparison(right);

  if (Array.isArray(normalizedLeft) && Array.isArray(normalizedRight)) {
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
  }

  return normalizedLeft === normalizedRight;
};

export const getAliasConversionPlan = (params: {
  sourceName: string;
  sourceFields: Record<string, unknown>;
  sourceLinks: string[];
  targetName: string;
  targetFields: Record<string, unknown>;
  targetLinks: string[];
  sourceIndexedAliases: string[];
  targetIndexedAliases: string[];
  alternativeNamesKey: string;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
}) => {
  const transferAliases = Array.from(
    new Map(
      [
        ...params.targetIndexedAliases,
        ...params.parseAlternativeNames(
          typeof params.targetFields[params.alternativeNamesKey] === 'string'
            ? String(params.targetFields[params.alternativeNamesKey])
            : ''
        ),
        ...params.sourceIndexedAliases,
        ...params.parseAlternativeNames(
          typeof params.sourceFields[params.alternativeNamesKey] === 'string'
            ? String(params.sourceFields[params.alternativeNamesKey])
            : ''
        ),
        params.sourceName
      ]
        .map((alias) => alias.trim())
        .filter(Boolean)
        .filter((alias) => params.normalizeName(alias) !== params.normalizeName(params.targetName))
        .map((alias) => [params.normalizeName(alias), alias])
    ).values()
  );

  const blockingFieldKeys = Object.entries(params.sourceFields)
    .filter(([key]) => key !== params.alternativeNamesKey)
    .filter(([, value]) => normalizeFieldValueForComparison(value) !== null)
    .filter(([key, value]) => !fieldValuesMatch(value, params.targetFields[key]))
    .map(([key]) => key);

  const missingTargetLinks = params.sourceLinks.filter(
    (link) => !params.targetLinks.includes(link)
  );

  return {
    transferAliases,
    mergedLinks: Array.from(new Set([...params.targetLinks, ...params.sourceLinks])),
    canDeleteSource: blockingFieldKeys.length === 0,
    blockingFieldKeys,
    hasLinkChanges: missingTargetLinks.length > 0
  };
};
