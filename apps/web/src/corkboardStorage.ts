import type {ChapterCard} from './entityTypes';
import {CORKBOARD_CHAPTER_CARD_STORE_NAME, openDb} from './db';

const compareChapterCards = (a: ChapterCard, b: ChapterCard) =>
  a.order - b.order || a.createdAt - b.createdAt || a.title.localeCompare(b.title);

export async function getChapterCardsByProjectId(
  projectId: string
): Promise<ChapterCard[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORKBOARD_CHAPTER_CARD_STORE_NAME, 'readonly');
    const store = tx.objectStore(CORKBOARD_CHAPTER_CARD_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as ChapterCard[]).filter(
        (card) => card.projectId === projectId
      );
      resolve(records.sort(compareChapterCards));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveChapterCard(chapterCard: ChapterCard): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORKBOARD_CHAPTER_CARD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CORKBOARD_CHAPTER_CARD_STORE_NAME);
    const request = store.put(chapterCard);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteChapterCard(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORKBOARD_CHAPTER_CARD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CORKBOARD_CHAPTER_CARD_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
