import type {EntityImage, EntityPortrait} from '../../entityTypes';
import {decodeImageSize, loadImage, readFileAsDataUrl} from '../../utils/imageFiles';

/**
 * Images on World Bible records (slice 4.100). No size limit (author
 * decision, 2026-11-28); sizes are shown so the author can see what a backup
 * will carry. Display only: nothing here is sent to an AI provider.
 */

export const ENTITY_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Longer side of the portrait thumbnail kept on the record, in pixels. */
export const PORTRAIT_THUMBNAIL_SIDE = 160;

/** Why a chosen file cannot be a record image, or null. */
export const entityImageFileProblem = (file: {type: string; name: string}): string | null =>
  ENTITY_IMAGE_TYPES.includes(file.type)
    ? null
    : `${file.name} is not a PNG, JPEG, WebP, or GIF image.`;

/** Reads an image file into an `EntityImage` for the record, or an error message. */
export async function readEntityImageFile(
  file: File,
  owner: {projectId: string; entityId: string},
  now = Date.now()
): Promise<{image: EntityImage} | {error: string}> {
  const problem = entityImageFileProblem(file);
  if (problem) return {error: problem};
  const dataUrl = await readFileAsDataUrl(file);
  const {width, height} = await decodeImageSize(dataUrl);
  if (!(width > 0) || !(height > 0)) {
    return {error: `${file.name} could not be read as an image. Try saving it again as PNG or JPEG.`};
  }
  return {
    image: {
      id: crypto.randomUUID(),
      projectId: owner.projectId,
      entityId: owner.entityId,
      dataUrl,
      mimeType: file.type,
      width,
      height,
      byteLength: file.size,
      fileName: file.name,
      createdAt: now
    }
  };
}

/** The size the thumbnail is drawn at, keeping the image's shape and never enlarging it. */
export function thumbnailSize(
  width: number,
  height: number,
  maxSide = PORTRAIT_THUMBNAIL_SIDE
): {width: number; height: number} {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

/**
 * A small copy of the image for lists. WebP keeps transparency; a browser
 * that cannot write WebP gives PNG. When the image cannot be drawn at all
 * (no canvas), the full image is used.
 */
export async function buildPortraitThumbnail(image: Pick<EntityImage, 'dataUrl' | 'width' | 'height'>): Promise<string> {
  const element = await loadImage(image.dataUrl);
  const size = thumbnailSize(image.width, image.height);
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const context = canvas?.getContext('2d') ?? null;
  if (!element || !canvas || !context) return image.dataUrl;
  canvas.width = size.width;
  canvas.height = size.height;
  context.drawImage(element, 0, 0, size.width, size.height);
  try {
    return canvas.toDataURL('image/webp', 0.85);
  } catch {
    return image.dataUrl;
  }
}

export async function portraitFor(image: EntityImage): Promise<EntityPortrait> {
  return {imageId: image.id, thumbnailDataUrl: await buildPortraitThumbnail(image)};
}

export const totalImageBytes = (images: readonly Pick<EntityImage, 'byteLength'>[]): number =>
  images.reduce((total, image) => total + image.byteLength, 0);
