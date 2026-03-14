import type {SystemHistoryCategory, SystemHistoryEntry} from '../entityTypes';

const MAX_ENTRIES = 200;

const getStorageKey = (projectId: string) => `systemHistory:${projectId}`;

export const getSystemHistoryEntries = (projectId: string): SystemHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is SystemHistoryEntry => {
        return (
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.projectId === 'string' &&
          typeof entry.category === 'string' &&
          typeof entry.message === 'string' &&
          typeof entry.insertText === 'string' &&
          typeof entry.createdAt === 'number'
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

export const appendSystemHistoryEntry = (
  projectId: string,
  input: {
    category: SystemHistoryCategory;
    message: string;
    insertText?: string;
    sourceKey?: string;
    sceneId?: string;
    createdAt?: number;
  }
): SystemHistoryEntry => {
  const existing = getSystemHistoryEntries(projectId);
  if (input.sourceKey) {
    const matched = existing.find((entry) => entry.sourceKey === input.sourceKey);
    if (matched) {
      return matched;
    }
  }

  const entry: SystemHistoryEntry = {
    id: crypto.randomUUID(),
    projectId,
    category: input.category,
    message: input.message.trim(),
    insertText: (input.insertText ?? input.message).trim(),
    sourceKey: input.sourceKey,
    sceneId: input.sceneId,
    createdAt: input.createdAt ?? Date.now()
  };

  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(next));
  return entry;
};

export const clearSystemHistoryEntries = (projectId: string): void => {
  localStorage.removeItem(getStorageKey(projectId));
};
