/**
 * A name as a safe, lowercase part of a file name or path: letters, digits,
 * `-` and `_`, with runs of anything else as one `-`. A name with none of
 * those (for example one written only in non-Latin letters) becomes `fallback`.
 */
export function sanitizeFileNamePart(value: string, fallback = 'project'): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

/** Saves `blob` as a file through the browser's download. */
export const triggerBlobDownload = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Saves `data` bytes as a file of MIME `type`. The bytes are copied first so
 * the Blob always gets a plain ArrayBuffer-backed array.
 */
export const triggerBytesDownload = (fileName: string, data: Uint8Array, type: string): void => {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  triggerBlobDownload(fileName, new Blob([bytes], {type}));
};

/** Saves `data` as a pretty-printed JSON file through the browser's download. */
export const triggerJsonDownload = (fileName: string, data: unknown): void => {
  triggerBlobDownload(fileName, new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
};
