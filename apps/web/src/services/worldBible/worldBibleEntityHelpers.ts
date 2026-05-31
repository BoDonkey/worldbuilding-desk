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

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const stripTags = (value: string): string =>
  decodeHtmlEntities(value).replace(/<[^>]+>/g, ' ');

const extractStructuredSummaryWithoutDom = (value: string): string => {
  const blocks: string[] = [];
  const blockPattern =
    /<(p|ul|ol|blockquote|table|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\b[^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(value)) !== null) {
    const tag = (match[1] ?? 'hr').toLowerCase();
    const content = match[2] ?? '';

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
        .map((itemMatch) => normalizeSummarySegment(stripTags(itemMatch[1] ?? '')))
        .filter(Boolean)
        .map((item) => `- ${item}`);
      blocks.push(...items);
      continue;
    }

    if (tag === 'blockquote') {
      const text = normalizeSummarySegment(stripTags(content));
      if (text) {
        blocks.push(`"${text}"`);
      }
      continue;
    }

    if (tag === 'table') {
      const rowMatches = Array.from(content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
      const rows = rowMatches
        .map((rowMatch) =>
          Array.from(rowMatch[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi))
            .map((cellMatch) => normalizeSummarySegment(stripTags(cellMatch[2] ?? '')))
            .filter(Boolean)
        )
        .filter((cells) => cells.length > 0);

      if (rows.length === 0) {
        continue;
      }

      const headerCells = Array.from(
        (rowMatches.find((rowMatch) => /<th\b/i.test(rowMatch[1]))?.[1] ?? '').matchAll(
          /<th\b[^>]*>([\s\S]*?)<\/th>/gi
        )
      )
        .map((cellMatch) => normalizeSummarySegment(stripTags(cellMatch[1] ?? '')))
        .filter(Boolean);

      const dataRows = headerCells.length > 0 ? rows.slice(1) : rows;
      const summaries =
        headerCells.length > 0
          ? dataRows.map((cells) =>
              cells
                .map((cell, index) => (headerCells[index] ? `${headerCells[index]}: ${cell}` : cell))
                .filter(Boolean)
                .join(' | ')
            )
          : rows.map((cells) => cells.join(' | '));
      blocks.push(...summaries);
      continue;
    }

    if (tag === 'hr') {
      blocks.push('---');
      continue;
    }

    const text = normalizeSummarySegment(stripTags(content));
    if (text) {
      blocks.push(text);
    }
  }

  if (blocks.length === 0) {
    return extractPlainTextFromRichText(value);
  }

  return blocks
    .join(' \u2022 ')
    .replace(/\s+\u2022\s+---\s+\u2022\s+/g, ' --- ')
    .replace(/\s+/g, ' ')
    .trim();
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
    return extractStructuredSummaryWithoutDom(trimmed);
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
