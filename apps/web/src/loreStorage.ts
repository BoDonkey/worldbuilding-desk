import type {LoreDocument, LoreDocumentLink} from './entityTypes';
import {
  openDb,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME
} from './db';

function emitLoreRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:lore-records-changed'));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllLoreDocuments(): Promise<LoreDocument[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_DOCUMENT_STORE_NAME, 'readonly');
    const request = tx.objectStore(LORE_DOCUMENT_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as LoreDocument[]);
    request.onerror = () => reject(request.error);
  });
}

async function getAllLoreDocumentLinks(): Promise<LoreDocumentLink[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_DOCUMENT_LINK_STORE_NAME, 'readonly');
    const request = tx.objectStore(LORE_DOCUMENT_LINK_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as LoreDocumentLink[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getLoreDocumentsByProject(projectId: string): Promise<LoreDocument[]> {
  const all = await getAllLoreDocuments();
  return all
    .filter((document) => document.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getLoreDocumentLinksByProject(
  projectId: string
): Promise<LoreDocumentLink[]> {
  const all = await getAllLoreDocumentLinks();
  return all.filter((link) => link.projectId === projectId);
}

export async function saveLoreDocument(document: LoreDocument): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_DOCUMENT_STORE_NAME, 'readwrite');
    const request = tx.objectStore(LORE_DOCUMENT_STORE_NAME).put(document);
    request.onsuccess = () => {
      emitLoreRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveLoreDocumentLinks(links: LoreDocumentLink[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LORE_DOCUMENT_LINK_STORE_NAME, 'readwrite');
  for (const link of links) {
    await requestToPromise(tx.objectStore(LORE_DOCUMENT_LINK_STORE_NAME).put(link));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLoreRecordsChanged();
}

export async function replaceLoreDocumentLinks(params: {
  loreDocumentId: string;
  links: LoreDocumentLink[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LORE_DOCUMENT_LINK_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LORE_DOCUMENT_LINK_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as LoreDocumentLink[];
  for (const link of all) {
    if (link.loreDocumentId === params.loreDocumentId) {
      await requestToPromise(store.delete(link.id));
    }
  }
  for (const link of params.links) {
    await requestToPromise(store.put(link));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLoreRecordsChanged();
}

export async function deleteLoreDocument(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [LORE_DOCUMENT_STORE_NAME, LORE_DOCUMENT_LINK_STORE_NAME],
    'readwrite'
  );
  const documentStore = tx.objectStore(LORE_DOCUMENT_STORE_NAME);
  const linkStore = tx.objectStore(LORE_DOCUMENT_LINK_STORE_NAME);
  const allLinks = (await requestToPromise(linkStore.getAll())) as LoreDocumentLink[];
  for (const link of allLinks) {
    if (link.loreDocumentId === id) {
      await requestToPromise(linkStore.delete(link.id));
    }
  }
  await requestToPromise(documentStore.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLoreRecordsChanged();
}
