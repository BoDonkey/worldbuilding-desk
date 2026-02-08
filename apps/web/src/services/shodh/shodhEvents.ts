import type {MemoryEntry} from './ShodhMemoryService';

const EVENT_NAME = 'shodh-memories-updated';

export function emitShodhMemoriesUpdated(memories?: MemoryEntry[]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MemoryEntry[] | undefined>(EVENT_NAME, {detail: memories})
  );
}

export const SHODH_MEMORIES_EVENT = EVENT_NAME;
