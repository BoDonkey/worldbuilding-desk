import type {EntityImage} from '../../../entityTypes';
import {ENTITY_IMAGE_STORE_NAME, openDb} from '../db';
import {transactionToPromise} from '../idbRequest';
import {readProjectRecords} from '../projectIndex';
import {RECORDS_CHANGED} from '../../recordEvents';

/**
 * Images on World Bible records (slice 4.100). Reads go through the projectId
 * index and filter by record, because a locked vault record exposes only id
 * and projectId. A write the browser refuses for lack of space rejects with
 * its QuotaExceededError, which `describeError` explains.
 */

function emitEntityImagesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RECORDS_CHANGED.entityImages));
}

/** The record's images, oldest first. */
export async function getEntityImages(projectId: string, entityId: string): Promise<EntityImage[]> {
  const images = await readProjectRecords<EntityImage>(ENTITY_IMAGE_STORE_NAME, projectId);
  return images
    .filter((image) => image.entityId === entityId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** Every image in the project (character package export reads these). */
export async function getProjectEntityImages(projectId: string): Promise<EntityImage[]> {
  return readProjectRecords<EntityImage>(ENTITY_IMAGE_STORE_NAME, projectId);
}

/** Saves the images in one transaction: all or none. */
export async function saveEntityImages(images: readonly EntityImage[]): Promise<void> {
  if (images.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(ENTITY_IMAGE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ENTITY_IMAGE_STORE_NAME);
  for (const image of images) store.put(image);
  await transactionToPromise(tx);
  emitEntityImagesChanged();
}

export async function deleteEntityImage(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ENTITY_IMAGE_STORE_NAME, 'readwrite');
  tx.objectStore(ENTITY_IMAGE_STORE_NAME).delete(id);
  await transactionToPromise(tx);
  emitEntityImagesChanged();
}

/** Deletes every image on the record; used when the record is deleted. */
export async function deleteEntityImagesForEntity(projectId: string, entityId: string): Promise<void> {
  const images = await getEntityImages(projectId, entityId);
  if (images.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(ENTITY_IMAGE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ENTITY_IMAGE_STORE_NAME);
  for (const image of images) store.delete(image.id);
  await transactionToPromise(tx);
  emitEntityImagesChanged();
}

/** Moves every image from one record to another; used when records are merged. */
export async function moveEntityImages(projectId: string, fromEntityId: string, toEntityId: string): Promise<void> {
  const images = await getEntityImages(projectId, fromEntityId);
  await saveEntityImages(images.map((image) => ({...image, entityId: toEntityId})));
}
