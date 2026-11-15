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

/** Saves `data` as a pretty-printed JSON file through the browser's download. */
export const triggerJsonDownload = (fileName: string, data: unknown): void => {
  triggerBlobDownload(fileName, new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
};
