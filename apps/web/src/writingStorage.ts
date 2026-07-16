import type { WritingDocument } from './entityTypes';
import { openDb, WRITING_STORE_NAME } from './db';

const sceneTitleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

const getSortableOrder = (doc: WritingDocument): number | null =>
  typeof doc.order === 'number' && Number.isFinite(doc.order) ? doc.order : null;

const compareNumbers = (left: number | undefined, right: number | undefined): number => {
  const leftValue = typeof left === 'number' && Number.isFinite(left) ? left : 0;
  const rightValue = typeof right === 'number' && Number.isFinite(right) ? right : 0;
  return leftValue - rightValue;
};

export const compareWritingDocuments = (
  left: WritingDocument,
  right: WritingDocument
): number => {
  const leftOrder = getSortableOrder(left);
  const rightOrder = getSortableOrder(right);

  if (leftOrder !== null && rightOrder !== null) {
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }

  const createdAtComparison = compareNumbers(left.createdAt, right.createdAt);
  if (createdAtComparison !== 0) return createdAtComparison;

  const titleComparison = sceneTitleCollator.compare(
    left.title || 'Untitled scene',
    right.title || 'Untitled scene'
  );
  if (titleComparison !== 0) return titleComparison;

  const updatedAtComparison = compareNumbers(left.updatedAt, right.updatedAt);
  if (updatedAtComparison !== 0) return updatedAtComparison;

  return left.id.localeCompare(right.id);
};

export const sortWritingDocuments = (documents: WritingDocument[]): WritingDocument[] =>
  documents.slice().sort(compareWritingDocuments);

export const getNextWritingDocumentOrder = (documents: WritingDocument[]): number => {
  const orderedValues = documents
    .map((doc) => getSortableOrder(doc))
    .filter((order): order is number => order !== null);

  if (orderedValues.length > 0) {
    return Math.max(...orderedValues) + 1;
  }

  return documents.length;
};

export async function getDocumentsByProject(projectId: string): Promise<WritingDocument[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readonly');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as WritingDocument[];
      resolve(sortWritingDocuments(all.filter(doc => doc.projectId === projectId)));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveWritingDocument(doc: WritingDocument): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.put(doc);

    request.onsuccess = () => {
      window.dispatchEvent(new CustomEvent('wbd:writing-records-changed'));
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteWritingDocument(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WRITING_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WRITING_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      window.dispatchEvent(new CustomEvent('wbd:writing-records-changed'));
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
