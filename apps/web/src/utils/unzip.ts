function readU16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

export function extractSingleFileZip(params: {zipBytes: Uint8Array}): {
  fileName: string;
  fileData: Uint8Array;
} {
  const bytes = params.zipBytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 30) {
    throw new Error('ZIP file is too small.');
  }

  // Local file header signature.
  if (readU32LE(view, 0) !== 0x04034b50) {
    throw new Error('Invalid ZIP header.');
  }

  const compressionMethod = readU16LE(view, 8);
  const compressedSize = readU32LE(view, 18);
  const uncompressedSize = readU32LE(view, 22);
  const fileNameLength = readU16LE(view, 26);
  const extraLength = readU16LE(view, 28);
  const fileNameStart = 30;
  const fileNameEnd = fileNameStart + fileNameLength;
  const dataStart = fileNameEnd + extraLength;
  const dataEnd = dataStart + compressedSize;

  if (dataEnd > bytes.byteLength) {
    throw new Error('ZIP entry data is truncated.');
  }
  if (compressionMethod !== 0) {
    throw new Error('Unsupported ZIP compression method. Expected stored (no compression).');
  }

  const fileNameBytes = bytes.slice(fileNameStart, fileNameEnd);
  const fileName = new TextDecoder('utf-8').decode(fileNameBytes);
  const fileData = bytes.slice(dataStart, dataEnd);

  if (fileData.byteLength !== uncompressedSize) {
    throw new Error('ZIP entry size mismatch.');
  }

  return {fileName, fileData};
}
