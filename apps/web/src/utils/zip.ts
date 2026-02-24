const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

function writeU32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

export interface ZipEntryInput {
  fileName: string;
  fileData: Uint8Array;
}

export function buildZip(entries: ZipEntryInput[]): Uint8Array {
  if (entries.length === 0) {
    throw new Error('ZIP archive requires at least one file.');
  }

  const encoder = new TextEncoder();
  const normalized = entries.map((entry) => {
    const fileNameBytes = encoder.encode(entry.fileName);
    const data = entry.fileData;
    return {
      fileNameBytes,
      data,
      crc: crc32(data)
    };
  });

  const localHeaderSizes = normalized.map(
    (entry) => 30 + entry.fileNameBytes.length
  );
  const centralHeaderSizes = normalized.map(
    (entry) => 46 + entry.fileNameBytes.length
  );
  const eocdSize = 22;
  const totalSize =
    normalized.reduce(
      (sum, entry, index) =>
        sum + localHeaderSizes[index] + entry.data.length + centralHeaderSizes[index],
      0
    ) + eocdSize;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  normalized.forEach((entry, index) => {
    localOffsets.push(offset);
    writeU32LE(view, offset, 0x04034b50);
    writeU16LE(view, offset + 4, 20);
    writeU16LE(view, offset + 6, 0);
    writeU16LE(view, offset + 8, 0);
    writeU16LE(view, offset + 10, 0);
    writeU16LE(view, offset + 12, 0);
    writeU32LE(view, offset + 14, entry.crc);
    writeU32LE(view, offset + 18, entry.data.length);
    writeU32LE(view, offset + 22, entry.data.length);
    writeU16LE(view, offset + 26, entry.fileNameBytes.length);
    writeU16LE(view, offset + 28, 0);
    out.set(entry.fileNameBytes, offset + 30);
    offset += localHeaderSizes[index];

    out.set(entry.data, offset);
    offset += entry.data.length;
  });

  const centralDirOffset = offset;

  normalized.forEach((entry, index) => {
    writeU32LE(view, offset, 0x02014b50);
    writeU16LE(view, offset + 4, 20);
    writeU16LE(view, offset + 6, 20);
    writeU16LE(view, offset + 8, 0);
    writeU16LE(view, offset + 10, 0);
    writeU16LE(view, offset + 12, 0);
    writeU16LE(view, offset + 14, 0);
    writeU32LE(view, offset + 16, entry.crc);
    writeU32LE(view, offset + 20, entry.data.length);
    writeU32LE(view, offset + 24, entry.data.length);
    writeU16LE(view, offset + 28, entry.fileNameBytes.length);
    writeU16LE(view, offset + 30, 0);
    writeU16LE(view, offset + 32, 0);
    writeU16LE(view, offset + 34, 0);
    writeU16LE(view, offset + 36, 0);
    writeU32LE(view, offset + 38, 0);
    writeU32LE(view, offset + 42, localOffsets[index]);
    out.set(entry.fileNameBytes, offset + 46);
    offset += centralHeaderSizes[index];
  });

  const centralDirSize = offset - centralDirOffset;

  writeU32LE(view, offset, 0x06054b50);
  writeU16LE(view, offset + 4, 0);
  writeU16LE(view, offset + 6, 0);
  writeU16LE(view, offset + 8, normalized.length);
  writeU16LE(view, offset + 10, normalized.length);
  writeU32LE(view, offset + 12, centralDirSize);
  writeU32LE(view, offset + 16, centralDirOffset);
  writeU16LE(view, offset + 20, 0);

  return out;
}

export function buildSingleFileZip(params: {
  fileName: string;
  fileData: Uint8Array;
}): Uint8Array {
  return buildZip([
    {
      fileName: params.fileName,
      fileData: params.fileData
    }
  ]);
}
