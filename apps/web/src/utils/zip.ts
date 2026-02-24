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

export function buildSingleFileZip(params: {
  fileName: string;
  fileData: Uint8Array;
}): Uint8Array {
  const encoder = new TextEncoder();
  const fileNameBytes = encoder.encode(params.fileName);
  const data = params.fileData;
  const crc = crc32(data);

  const localHeaderSize = 30 + fileNameBytes.length;
  const centralHeaderSize = 46 + fileNameBytes.length;
  const eocdSize = 22;
  const totalSize = localHeaderSize + data.length + centralHeaderSize + eocdSize;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Local file header
  let offset = 0;
  writeU32LE(view, offset, 0x04034b50);
  writeU16LE(view, offset + 4, 20);
  writeU16LE(view, offset + 6, 0);
  writeU16LE(view, offset + 8, 0);
  writeU16LE(view, offset + 10, 0);
  writeU16LE(view, offset + 12, 0);
  writeU32LE(view, offset + 14, crc);
  writeU32LE(view, offset + 18, data.length);
  writeU32LE(view, offset + 22, data.length);
  writeU16LE(view, offset + 26, fileNameBytes.length);
  writeU16LE(view, offset + 28, 0);
  out.set(fileNameBytes, offset + 30);
  offset += localHeaderSize;

  out.set(data, offset);
  offset += data.length;

  const centralDirOffset = offset;

  // Central directory file header
  writeU32LE(view, offset, 0x02014b50);
  writeU16LE(view, offset + 4, 20);
  writeU16LE(view, offset + 6, 20);
  writeU16LE(view, offset + 8, 0);
  writeU16LE(view, offset + 10, 0);
  writeU16LE(view, offset + 12, 0);
  writeU16LE(view, offset + 14, 0);
  writeU32LE(view, offset + 16, crc);
  writeU32LE(view, offset + 20, data.length);
  writeU32LE(view, offset + 24, data.length);
  writeU16LE(view, offset + 28, fileNameBytes.length);
  writeU16LE(view, offset + 30, 0);
  writeU16LE(view, offset + 32, 0);
  writeU16LE(view, offset + 34, 0);
  writeU16LE(view, offset + 36, 0);
  writeU32LE(view, offset + 38, 0);
  writeU32LE(view, offset + 42, 0);
  out.set(fileNameBytes, offset + 46);
  offset += centralHeaderSize;

  const centralDirSize = offset - centralDirOffset;

  // End of central directory record
  writeU32LE(view, offset, 0x06054b50);
  writeU16LE(view, offset + 4, 0);
  writeU16LE(view, offset + 6, 0);
  writeU16LE(view, offset + 8, 1);
  writeU16LE(view, offset + 10, 1);
  writeU32LE(view, offset + 12, centralDirSize);
  writeU32LE(view, offset + 16, centralDirOffset);
  writeU16LE(view, offset + 20, 0);

  return out;
}
