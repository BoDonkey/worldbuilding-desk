import type {LoreDocumentFormat} from '../../entityTypes';

export interface ParsedLoreImport {
  title: string;
  content: string;
  format: LoreDocumentFormat;
  fileName: string;
  mimeType?: string;
}

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const fileNameToTitle = (name: string): string => {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || 'Imported lore document';
};

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
  for (let index = bytes.length - minEocdSize; index >= searchStart; index -= 1) {
    if (readU32LE(bytes, index) === eocdSignature) {
      eocdOffset = index;
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

async function parseDocxToText(file: File): Promise<string> {
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

  return docxXmlToText(new TextDecoder('utf-8').decode(xmlBytes));
}

export async function parseLoreImport(file: File): Promise<ParsedLoreImport> {
  const lowerName = file.name.toLowerCase();
  let content = '';
  let format: LoreDocumentFormat = 'plain_text';

  if (lowerName.endsWith('.docx')) {
    content = await parseDocxToText(file);
    format = 'plain_text';
  } else {
    content = await file.text();
    format = lowerName.endsWith('.md') ? 'markdown' : 'plain_text';
  }

  const normalized = content.trim();
  if (!normalized) {
    throw new Error('Imported file was empty.');
  }

  return {
    title: fileNameToTitle(file.name),
    content: normalized,
    format,
    fileName: file.name,
    mimeType: file.type || undefined
  };
}
