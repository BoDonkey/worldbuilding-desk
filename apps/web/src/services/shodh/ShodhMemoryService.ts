import {openDB} from 'idb';
import type {DBSchema, IDBPDatabase} from 'idb';

interface MemoryDB extends DBSchema {
  memories: {
    key: string;
    value: MemoryEntry;
    indexes: {
      'by-document': string;
    };
  };
}

export interface MemoryEntry {
  id: string;
  projectId: string;
  documentId: string;
  title: string;
  summary: string;
  tags?: string[];
  createdAt: number;
}

export interface ShodhMemoryProvider {
  init(projectId: string): Promise<void>;
  addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}): Promise<void>;
  listMemories(): Promise<MemoryEntry[]>;
  deleteMemory(memoryId: string): Promise<void>;
  deleteMemoriesForDocument(documentId: string): Promise<void>;
  captureAutoMemory(params: {
    projectId: string;
    documentId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<void>;
}

export class ShodhMemoryService implements ShodhMemoryProvider {
  private db: IDBPDatabase<MemoryDB> | null = null;

  async init(projectId: string): Promise<void> {
    this.db = await openDB<MemoryDB>(`shodh-memory-${projectId}`, 1, {
      upgrade(db) {
        const store = db.createObjectStore('memories', {keyPath: 'id'});
        store.createIndex('by-document', 'documentId');
      }
    });
  }

  async addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}): Promise<void> {
    const now = Date.now();
    const record: MemoryEntry = {
      id: entry.id ?? crypto.randomUUID(),
      createdAt: entry.createdAt ?? now,
      ...entry
    };

    await this.requireDb().put('memories', record);
  }

  async listMemories(): Promise<MemoryEntry[]> {
    return this.requireDb().getAll('memories');
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.requireDb().delete('memories', memoryId);
  }

  async deleteMemoriesForDocument(documentId: string): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction('memories', 'readwrite');
    const index = tx.store.index('by-document');
    let cursor = await index.openCursor(IDBKeyRange.only(documentId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async captureAutoMemory(params: {
    projectId: string;
    documentId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<void> {
    await this.deleteMemoriesForDocument(params.documentId);
    const summary = this.generateSummary(params.content);

    if (summary.length === 0) {
      return;
    }

    await this.addMemory({
      projectId: params.projectId,
      documentId: params.documentId,
      title: params.title,
      summary,
      tags: params.tags
    });
  }

  private generateSummary(content: string): string {
    const plain = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return plain.slice(0, 500);
  }

  private requireDb(): IDBPDatabase<MemoryDB> {
    if (!this.db) {
      throw new Error('Shodh memory database has not been initialized');
    }
    return this.db;
  }
}

export class CompositeShodhMemoryService implements ShodhMemoryProvider {
  constructor(
    private primary: ShodhMemoryProvider,
    private parents: ShodhMemoryProvider[] = []
  ) {}

  async init(projectId: string): Promise<void> {
    await this.primary.init(projectId);
  }

  async addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}) {
    await this.primary.addMemory(entry);
  }

  async listMemories(): Promise<MemoryEntry[]> {
    const [local, ...parentLists] = await Promise.all([
      this.primary.listMemories(),
      ...this.parents.map((parent) => parent.listMemories())
    ]);
    const merged = [...parentLists.flat(), ...local];
    return merged.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.primary.deleteMemory(memoryId);
  }

  async deleteMemoriesForDocument(documentId: string): Promise<void> {
    await this.primary.deleteMemoriesForDocument(documentId);
  }

  async captureAutoMemory(params: {
    projectId: string;
    documentId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<void> {
    await this.primary.captureAutoMemory(params);
  }
}
