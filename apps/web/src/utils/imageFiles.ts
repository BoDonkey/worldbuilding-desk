/**
 * Browser helpers for image files the author adds: map backgrounds (4.80) and
 * record images (4.100).
 */

/** The file's bytes as a data URL. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the image.'));
    reader.readAsDataURL(file);
  });
}

/** Loads a data URL as an image element; null when the browser cannot decode it. */
export function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/** Pixel size of an image data URL; 0 × 0 when it cannot be decoded. */
export async function decodeImageSize(dataUrl: string): Promise<{width: number; height: number}> {
  const image = await loadImage(dataUrl);
  return image ? {width: image.naturalWidth, height: image.naturalHeight} : {width: 0, height: 0};
}

/** "1.2 MB", "340 KB", for showing how big an image is. */
export function formatImageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
