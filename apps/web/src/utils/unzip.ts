/*
 * The one ZIP reader (slice 3.52). It walks the central directory, so it
 * finds an entry anywhere in the archive, and reads stored or deflated
 * entries. Backups, scene import (.docx, .pages), and World Bible and Source
 * Note import (.docx) all read through here.
 */

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export interface ZipEntryLocation {
  fileName: string;
  compressionMethod: number;
  compressedData: Uint8Array;
  uncompressedSize: number;
}

/**
 * The first entry whose name matches, with its raw (possibly compressed)
 * bytes. Null when no entry matches or the archive is malformed.
 */
export const findZipEntry = (
  bytes: Uint8Array,
  matcher: (fileName: string) => boolean
): ZipEntryLocation | null => {
  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
    if (readU32LE(bytes, i) === EOCD_SIGNATURE) {
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
    if (readU32LE(bytes, cursor) !== CENTRAL_SIGNATURE) break;
    const compressionMethod = readU16LE(bytes, cursor + 10);
    const compressedSize = readU32LE(bytes, cursor + 20);
    const uncompressedSize = readU32LE(bytes, cursor + 24);
    const fileNameLength = readU16LE(bytes, cursor + 28);
    const extraLength = readU16LE(bytes, cursor + 30);
    const commentLength = readU16LE(bytes, cursor + 32);
    const localHeaderOffset = readU32LE(bytes, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > bytes.length) return null;

    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
    cursor = fileNameEnd + extraLength + commentLength;

    if (!matcher(fileName)) continue;
    if (localHeaderOffset + 30 > bytes.length) return null;
    if (readU32LE(bytes, localHeaderOffset) !== LOCAL_SIGNATURE) return null;

    const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;

    return {fileName, compressionMethod, compressedData: bytes.slice(dataStart, dataEnd), uncompressedSize};
  }

  return null;
};

const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
  const copy = new Uint8Array(compressedData.byteLength);
  copy.set(compressedData);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * The first matching entry's bytes, inflated when deflated; null when no
 * entry matches. `format` names the file type in the error for an
 * unsupported compression method ("DOCX", ".pages").
 */
export const readZipEntry = async (
  bytes: Uint8Array,
  matcher: (fileName: string) => boolean,
  format = 'ZIP'
): Promise<{fileName: string; data: Uint8Array} | null> => {
  const entry = findZipEntry(bytes, matcher);
  if (!entry) return null;
  if (entry.compressionMethod === 0) return {fileName: entry.fileName, data: entry.compressedData};
  if (entry.compressionMethod === 8) return {fileName: entry.fileName, data: await inflateRaw(entry.compressedData)};
  throw new Error(`Unsupported ${format} compression method (${entry.compressionMethod}).`);
};

/** The named entry decoded as UTF-8 text, or null when the archive has no such entry. */
export const readZipEntryText = async (
  bytes: Uint8Array,
  entryName: string,
  format = 'ZIP'
): Promise<string | null> => {
  const entry = await readZipEntry(bytes, (fileName) => fileName === entryName, format);
  return entry ? new TextDecoder('utf-8').decode(entry.data) : null;
};

/** The one stored file in a project backup ZIP. */
export function extractSingleFileZip(params: {zipBytes: Uint8Array}): {
  fileName: string;
  fileData: Uint8Array;
} {
  const bytes = params.zipBytes;
  if (bytes.byteLength < 30) {
    throw new Error('ZIP file is too small.');
  }
  const entry = findZipEntry(bytes, () => true);
  if (!entry) {
    throw new Error('Invalid ZIP header.');
  }
  if (entry.compressionMethod !== 0) {
    throw new Error('Unsupported ZIP compression method. Expected stored (no compression).');
  }
  if (entry.compressedData.byteLength !== entry.uncompressedSize) {
    throw new Error('ZIP entry size mismatch.');
  }
  return {fileName: entry.fileName, fileData: entry.compressedData};
}
