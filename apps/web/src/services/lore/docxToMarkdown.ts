import {
  decodeXmlEntities,
  headingLevelFromOutline,
  parseDocxParagraphStyles,
  readAttribute,
  readZipEntryText,
  resolveStyleHeadingLevel
} from '../worldBible/docxImport';
import type {DocxParagraphStyle} from '../worldBible/docxImport';

interface XmlElement {
  tag: string;
  inner: string;
}

const findClosingTag = (
  xml: string,
  tag: string,
  from: number
): {innerEnd: number; outerEnd: number} | null => {
  const pattern = new RegExp(`<(/?)w:${tag}(?=[\\s>/])[^>]*?(/?)>`, 'g');
  pattern.lastIndex = from;
  let depth = 1;
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    if (match[1]) {
      depth -= 1;
      if (depth === 0) return {innerEnd: match.index, outerEnd: pattern.lastIndex};
    } else if (!match[2]) {
      depth += 1;
    }
  }
  return null;
};

/** Top-level `w:` elements of the given tags, in document order; nested ones stay inside their parent. */
const childElements = (xml: string, tags: string[]): XmlElement[] => {
  const elements: XmlElement[] = [];
  const pattern = new RegExp(`<w:(${tags.join('|')})(?=[\\s>/])[^>]*?(/?)>`, 'g');
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const tag = match[1];
    if (match[2]) {
      elements.push({tag, inner: ''});
      continue;
    }
    const close = findClosingTag(xml, tag, pattern.lastIndex);
    if (!close) break;
    elements.push({tag, inner: xml.slice(pattern.lastIndex, close.innerEnd)});
    pattern.lastIndex = close.outerEnd;
  }
  return elements;
};

const isToggleOn = (properties: string, element: string): boolean => {
  const match = properties.match(new RegExp(`<w:${element}\\b([^>]*)/?>`));
  if (!match) return false;
  const value = match[1].match(/\bw:val="([^"]*)"/)?.[1];
  return value === undefined || !/^(0|false|off)$/i.test(value);
};

interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
}

const runText = (runXml: string): string =>
  decodeXmlEntities(
    runXml
      .replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g, '')
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<w:noBreakHyphen\b[^>]*\/>/g, '-')
      .replace(/<[^>]+>/g, '')
  );

const paragraphSegments = (paragraphXml: string): Segment[] => {
  const body = paragraphXml
    .replace(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/, '')
    .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')
    // Text boxes and drawings nest whole paragraphs inside a run.
    .replace(/<mc:AlternateContent\b[^>]*>[\s\S]*?<\/mc:AlternateContent>/g, '')
    .replace(/<w:(drawing|pict|object)\b[^>]*>[\s\S]*?<\/w:\1>/g, '');
  const segments: Segment[] = [];
  for (const run of body.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const text = runText(run[1]);
    if (!text) continue;
    const properties = run[1].match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/)?.[1] ?? '';
    const bold = isToggleOn(properties, 'b');
    const italic = isToggleOn(properties, 'i');
    const previous = segments[segments.length - 1];
    if (previous && previous.bold === bold && previous.italic === italic) {
      previous.text += text;
    } else {
      segments.push({text, bold, italic});
    }
  }
  return segments;
};

/** Emphasis markers must hug the text, so surrounding whitespace moves outside them. */
const segmentsToMarkdown = (segments: Segment[]): string =>
  segments
    .map(({text, bold, italic}) => {
      const marker = `${bold ? '**' : ''}${italic ? '*' : ''}`;
      const core = text.trim();
      if (!marker || !core) return text;
      const leading = text.slice(0, text.length - text.trimStart().length);
      const trailing = text.slice(text.trimEnd().length);
      return `${leading}${marker}${core}${[...marker].reverse().join('')}${trailing}`;
    })
    .join('');

interface ListNumbering {
  /** numId → abstractNumId */
  nums: Map<string, string>;
  /** abstractNumId → ilvl → numFmt */
  formats: Map<string, Map<string, string>>;
}

const parseNumbering = (numberingXml: string): ListNumbering => {
  const formats = new Map<string, Map<string, string>>();
  for (const match of numberingXml.matchAll(
    /<w:abstractNum\b[^>]*\bw:abstractNumId="([^"]*)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g
  )) {
    const levels = new Map<string, string>();
    for (const level of match[2].matchAll(/<w:lvl\b[^>]*\bw:ilvl="([^"]*)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      const format = readAttribute(level[2], 'numFmt');
      if (format) levels.set(level[1], format);
    }
    formats.set(match[1], levels);
  }
  const nums = new Map<string, string>();
  for (const match of numberingXml.matchAll(
    /<w:num\b[^>]*\bw:numId="([^"]*)"[^>]*>([\s\S]*?)<\/w:num>/g
  )) {
    const abstractId = readAttribute(match[2], 'abstractNumId');
    if (abstractId) nums.set(match[1], abstractId);
  }
  return {nums, formats};
};

const parseStyleNumbering = (stylesXml: string): Map<string, {numId: string; ilvl: string}> => {
  const styles = new Map<string, {numId: string; ilvl: string}>();
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const styleId = match[1].match(/\bw:styleId="([^"]*)"/)?.[1];
    const numPr = match[2].match(/<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/)?.[1];
    const numId = numPr ? readAttribute(numPr, 'numId') : undefined;
    if (styleId && numId) styles.set(styleId, {numId, ilvl: readAttribute(numPr ?? '', 'ilvl') ?? '0'});
  }
  return styles;
};

interface ConversionContext {
  styles: Map<string, DocxParagraphStyle>;
  styleNumbering: Map<string, {numId: string; ilvl: string}>;
  numbering: ListNumbering;
}

type ParagraphBlock =
  | {kind: 'heading'; level: number; text: string}
  | {kind: 'list'; ordered: boolean; level: number; text: string}
  | {kind: 'paragraph'; text: string};

const convertParagraph = (paragraphXml: string, context: ConversionContext): ParagraphBlock | null => {
  const properties = paragraphXml.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/)?.[1] ?? '';
  const segments = paragraphSegments(paragraphXml);
  const plain = segments.map((segment) => segment.text).join('').trim();
  if (!plain) return null;

  const styleId = readAttribute(properties, 'pStyle');
  const outline = readAttribute(properties, 'outlineLvl');
  const headingLevel = outline !== undefined
    ? headingLevelFromOutline(Number.parseInt(outline, 10))
    : styleId
      ? resolveStyleHeadingLevel(styleId, context.styles)
      : null;
  if (headingLevel) {
    return {kind: 'heading', level: headingLevel, text: plain.replace(/\s+/g, ' ')};
  }

  const text = segmentsToMarkdown(segments).trim();
  const numPr = properties.match(/<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/)?.[1];
  const styleList = styleId ? context.styleNumbering.get(styleId) : undefined;
  const numId = (numPr ? readAttribute(numPr, 'numId') : undefined) ?? styleList?.numId;
  if (numId && numId !== '0') {
    const ilvl = (numPr ? readAttribute(numPr, 'ilvl') : undefined) ?? styleList?.ilvl ?? '0';
    const abstractId = context.numbering.nums.get(numId);
    const format = abstractId ? context.numbering.formats.get(abstractId)?.get(ilvl) : undefined;
    return {
      kind: 'list',
      ordered: Boolean(format && format !== 'bullet' && format !== 'none'),
      level: Math.max(0, Number.parseInt(ilvl, 10) || 0),
      text: text.replace(/\n/g, ' ')
    };
  }
  return {kind: 'paragraph', text};
};

const escapeTableCell = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

const cellToMarkdown = (cellXml: string, context: ConversionContext): string =>
  childElements(cellXml, ['p', 'tbl', 'sdt'])
    .flatMap((element): string[] => {
      if (element.tag === 'tbl') {
        // A nested table cannot live in a pipe table cell; keep its text.
        return childElements(element.inner, ['tr']).map((row) =>
          childElements(row.inner, ['tc'])
            .map((cell) => cellToMarkdown(cell.inner, context))
            .join(' / ')
        );
      }
      if (element.tag === 'sdt') return [cellToMarkdown(element.inner, context)];
      const block = convertParagraph(element.inner, context);
      if (!block) return [];
      if (block.kind === 'list') return [`• ${escapeTableCell(block.text)}`];
      return [escapeTableCell(block.text)];
    })
    .filter(Boolean)
    .join('<br>');

const tableToMarkdown = (tableXml: string, context: ConversionContext): string | null => {
  const rows = childElements(tableXml, ['tr']).map((row) =>
    childElements(row.inner, ['tc']).flatMap((cell) => {
      const properties = cell.inner.match(/<w:tcPr\b[^>]*>([\s\S]*?)<\/w:tcPr>/)?.[1] ?? '';
      const span = Math.max(1, Number.parseInt(readAttribute(properties, 'gridSpan') ?? '1', 10) || 1);
      const vMerge = properties.match(/<w:vMerge\b([^>]*)\/?>/);
      // A vertically merged continuation cell repeats nothing; the first cell holds the text.
      const isContinuation = vMerge !== null && !/\bw:val="restart"/.test(vMerge[1]);
      const text = isContinuation ? '' : cellToMarkdown(cell.inner, context);
      return [text, ...Array<string>(span - 1).fill('')];
    })
  ).filter((cells) => cells.length > 0);
  if (rows.length === 0) return null;

  const columnCount = Math.max(...rows.map((cells) => cells.length));
  const formatRow = (cells: string[]) =>
    `| ${Array.from({length: columnCount}, (_, index) => cells[index] || ' ').join(' | ')} |`;
  return [
    formatRow(rows[0]),
    formatRow(Array<string>(columnCount).fill('---')),
    ...rows.slice(1).map(formatRow)
  ].join('\n');
};

const blockToMarkdown = (block: ParagraphBlock): string => {
  if (block.kind === 'heading') return `${'#'.repeat(block.level)} ${block.text}`;
  if (block.kind === 'list') {
    return `${'  '.repeat(block.level)}${block.ordered ? '1.' : '-'} ${block.text}`;
  }
  return block.text;
};

/**
 * Converts WordprocessingML to Markdown for Source Notes: heading styles,
 * bullet and numbered lists, bold/italic runs, and tables as pipe tables
 * (first row as header).
 */
export const docxXmlToMarkdown = (
  documentXml: string,
  stylesXml = '',
  numberingXml = ''
): string => {
  const context: ConversionContext = {
    styles: parseDocxParagraphStyles(stylesXml),
    styleNumbering: parseStyleNumbering(stylesXml),
    numbering: parseNumbering(numberingXml)
  };
  const body = documentXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)?.[1] ?? documentXml;
  const output: string[] = [];
  let previousWasList = false;

  const append = (markdown: string, isList: boolean) => {
    if (output.length > 0) output.push(isList && previousWasList ? '\n' : '\n\n');
    output.push(markdown);
    previousWasList = isList;
  };

  const visit = (xml: string) => {
    for (const element of childElements(xml, ['p', 'tbl', 'sdt'])) {
      if (element.tag === 'sdt') {
        visit(element.inner);
      } else if (element.tag === 'tbl') {
        const table = tableToMarkdown(element.inner, context);
        if (table) append(table, false);
      } else {
        const block = convertParagraph(element.inner, context);
        if (block) append(blockToMarkdown(block), block.kind === 'list');
      }
    }
  };

  visit(body);
  return output.join('').trim();
};

export const parseDocxFileToMarkdown = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentXml = await readZipEntryText(bytes, 'word/document.xml');
  if (documentXml === null) {
    throw new Error('Could not read DOCX structure.');
  }
  const [stylesXml, numberingXml] = await Promise.all([
    readZipEntryText(bytes, 'word/styles.xml').catch(() => null),
    readZipEntryText(bytes, 'word/numbering.xml').catch(() => null)
  ]);
  return docxXmlToMarkdown(documentXml, stylesXml ?? '', numberingXml ?? '');
};
