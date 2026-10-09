const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const findZipEntry = (
  bytes: Uint8Array,
  entryName: string
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

    if (fileName !== entryName) continue;
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

export const readZipEntryText = async (
  bytes: Uint8Array,
  entryName: string
): Promise<string | null> => {
  const entry = findZipEntry(bytes, entryName);
  if (!entry) return null;

  let xmlBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    xmlBytes = entry.compressedData;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateRaw(entry.compressedData);
  } else {
    throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
  }
  return new TextDecoder('utf-8').decode(xmlBytes);
};

export const parseDocxFile = async (file: File): Promise<DocxImportDocument> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentXml = await readZipEntryText(bytes, 'word/document.xml');
  if (documentXml === null) {
    throw new Error('Could not read DOCX structure.');
  }
  const stylesXml = await readZipEntryText(bytes, 'word/styles.xml').catch(() => null);
  return docxXmlToImportDocument(documentXml, stylesXml ?? '');
};
