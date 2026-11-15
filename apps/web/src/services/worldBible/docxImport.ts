import {readZipEntryText} from '../../utils/unzip';

export interface DocxImportDocument {
  /** Paragraph text; heading paragraphs are prefixed with Markdown `#` markers. */
  text: string;
  html: string;
}

export interface DocxParagraphStyle {
  name?: string;
  outlineLevel?: number;
  basedOn?: string;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

export const decodeXmlEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? match;
  });

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const readAttribute = (xml: string, element: string): string | undefined =>
  xml.match(new RegExp(`<w:${element}\\b[^>]*\\bw:val="([^"]*)"`))?.[1];

export const parseDocxParagraphStyles = (stylesXml: string): Map<string, DocxParagraphStyle> => {
  const styles = new Map<string, DocxParagraphStyle>();
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const attributes = match[1];
    if (!/\bw:type="paragraph"/.test(attributes)) continue;
    const styleId = attributes.match(/\bw:styleId="([^"]*)"/)?.[1];
    if (!styleId) continue;
    const outlineLevel = readAttribute(match[2], 'outlineLvl');
    styles.set(styleId, {
      name: readAttribute(match[2], 'name'),
      outlineLevel: outlineLevel === undefined ? undefined : Number.parseInt(outlineLevel, 10),
      basedOn: readAttribute(match[2], 'basedOn')
    });
  }
  return styles;
};

const headingLevelFromStyleName = (value: string | undefined): number | null => {
  if (!value) return null;
  const normalized = decodeXmlEntities(value).trim();
  if (/^title$/i.test(normalized)) return 1;
  const heading = normalized.match(/^heading\s*([1-9])$/i);
  return heading ? Math.min(Number(heading[1]), 6) : null;
};

/** Outline levels 0-8 are headings; 9 is body text. */
export const headingLevelFromOutline = (outlineLevel: number): number | null =>
  outlineLevel >= 0 && outlineLevel < 9 ? Math.min(outlineLevel + 1, 6) : null;

export const resolveStyleHeadingLevel = (
  styleId: string,
  styles: Map<string, DocxParagraphStyle>
): number | null => {
  let currentId: string | undefined = styleId;
  for (let depth = 0; currentId && depth < 10; depth += 1) {
    const style = styles.get(currentId);
    if (style?.outlineLevel !== undefined && Number.isFinite(style.outlineLevel)) {
      return headingLevelFromOutline(style.outlineLevel);
    }
    const named = headingLevelFromStyleName(style?.name) ?? headingLevelFromStyleName(currentId);
    if (named) return named;
    currentId = style?.basedOn;
  }
  return null;
};

const paragraphXmlToText = (xml: string): string =>
  decodeXmlEntities(
    xml
      .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<w:cr\b[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
  );

/**
 * Converts WordprocessingML into import text and HTML, keeping heading
 * paragraphs (by paragraph outline level, style outline level, or a
 * Heading N / Title style) so section detection can see them.
 */
export const docxXmlToImportDocument = (
  documentXml: string,
  stylesXml = ''
): DocxImportDocument => {
  const styles = parseDocxParagraphStyles(stylesXml);
  const textBlocks: string[] = [];
  const htmlBlocks: string[] = [];
  const paragraphs = documentXml
    .replace(/<w:p\b[^>]*\/>/g, '')
    .matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g);

  for (const paragraph of paragraphs) {
    const body = paragraph[1];
    const properties = body.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/)?.[1] ?? '';
    const text = paragraphXmlToText(body.replace(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/, '')).trim();
    if (!text) {
      textBlocks.push('');
      continue;
    }
    const paragraphOutline = readAttribute(properties, 'outlineLvl');
    const styleId = readAttribute(properties, 'pStyle');
    const level = paragraphOutline !== undefined
      ? headingLevelFromOutline(Number.parseInt(paragraphOutline, 10))
      : styleId
        ? resolveStyleHeadingLevel(styleId, styles)
        : null;
    if (level) {
      const headingText = text.replace(/\s+/g, ' ');
      textBlocks.push(`${'#'.repeat(level)} ${headingText}`);
      htmlBlocks.push(`<h${level}>${escapeHtml(headingText)}</h${level}>`);
    } else {
      textBlocks.push(text);
      htmlBlocks.push(`<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>`);
    }
  }

  return {
    text: textBlocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
    html: htmlBlocks.join('') || '<p></p>'
  };
};

export const parseDocxFile = async (file: File): Promise<DocxImportDocument> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentXml = await readZipEntryText(bytes, 'word/document.xml', 'DOCX');
  if (documentXml === null) {
    throw new Error('Could not read DOCX structure.');
  }
  const stylesXml = await readZipEntryText(bytes, 'word/styles.xml', 'DOCX').catch(() => null);
  return docxXmlToImportDocument(documentXml, stylesXml ?? '');
};
