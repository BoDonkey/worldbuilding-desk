import type {DBSchema, IDBPDatabase} from 'idb';
import {openDerivedRecordStore, type DerivedRecordStore} from '../storage';

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
  close?(): void;
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
  private db: DerivedRecordStore<MemoryEntry> | null = null;

  async init(projectId: string): Promise<void> {
    this.db = await openDerivedRecordStore<MemoryEntry>({
      projectId,
      databaseName: `shodh-memory-${projectId}`,
      version: 1,
      storeName: 'memories',
      upgrade(db) {
        const store = (db as unknown as IDBPDatabase<MemoryDB>).createObjectStore('memories', {keyPath: 'id'});
        store.createIndex('by-document', 'documentId');
      },
      onBlocking: () => this.close()
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}): Promise<void> {
    const now = Date.now();
    const record: MemoryEntry = {
      id: entry.id ?? crypto.randomUUID(),
      createdAt: entry.createdAt ?? now,
      ...entry
    };

    await this.requireDb().put(record);
  }

  async listMemories(): Promise<MemoryEntry[]> {
    return this.requireDb().getAll();
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.requireDb().delete(memoryId);
  }

  async deleteMemoriesForDocument(documentId: string): Promise<void> {
    await this.requireDb().deleteByDocument(documentId);
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

  private requireDb(): DerivedRecordStore<MemoryEntry> {
    if (!this.db) {
      throw new Error('Project memory database has not been initialized');
    }
    return this.db;
  }
}

export class CompositeShodhMemoryService implements ShodhMemoryProvider {
  private primary: ShodhMemoryProvider;
  private parents: ShodhMemoryProvider[];

  constructor(primary: ShodhMemoryProvider, parents: ShodhMemoryProvider[] = []) {
    this.primary = primary;
    this.parents = parents;
  }

  async init(projectId: string): Promise<void> {
    await this.primary.init(projectId);
  }

  close(): void {
    this.primary.close?.();
    this.parents.forEach((parent) => parent.close?.());
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
