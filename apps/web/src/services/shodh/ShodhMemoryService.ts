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

export interface MemoryEntityHint {
  id: string;
  name: string;
  type: 'character' | 'entity';
}

export interface MemoryEntry {
  id: string;
  projectId: string;
  documentId: string;
  title: string;
  summary: string;
  kind?: 'manual' | 'scene-recall' | 'open-loop' | 'canon-fact';
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
    knownEntities?: MemoryEntityHint[];
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
    knownEntities?: MemoryEntityHint[];
  }): Promise<void> {
    await this.deleteAutoMemoriesForDocument(params.documentId);
    const memories = this.generateAutoMemories(params);

    if (memories.length === 0) {
      return;
    }

    for (const memory of memories) {
      await this.addMemory(memory);
    }
  }

  private async deleteAutoMemoriesForDocument(documentId: string): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction('memories', 'readwrite');
    const index = tx.store.index('by-document');
    let cursor = await index.openCursor(IDBKeyRange.only(documentId));
    while (cursor) {
      const value = cursor.value;
      if ((value.tags ?? []).includes('auto-memory')) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  private generateAutoMemories(params: {
    projectId: string;
    documentId: string;
    title: string;
    content: string;
    tags?: string[];
    knownEntities?: MemoryEntityHint[];
  }): Array<Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}> {
    const plain = params.content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) {
      return [];
    }

    const baseTags = Array.from(new Set([...(params.tags ?? []), 'auto-memory']));
    const sentences = plain
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const entityHints = this.prepareEntityHints(params.knownEntities ?? []);
    const summary = this.generateSummary(sentences, entityHints);
    const openLoop = this.extractOpenLoop(sentences, entityHints);
    const canonFact = this.extractCanonFact(sentences, entityHints);
    const records: Array<
      Omit<MemoryEntry, 'id' | 'createdAt'> & {id?: string; createdAt?: number}
    > = [];

    if (summary) {
      const summaryEntityTags = this.buildEntityTags(summary, entityHints);
      records.push({
        projectId: params.projectId,
        documentId: params.documentId,
        title: `${params.title} · Scene snapshot`,
        summary,
        kind: (params.tags ?? []).includes('ruleset') ? 'canon-fact' : 'scene-recall',
        tags: [...baseTags, 'scene-recall', ...summaryEntityTags]
      });
    }

    if (openLoop) {
      const openLoopEntityTags = this.buildEntityTags(openLoop, entityHints);
      records.push({
        projectId: params.projectId,
        documentId: params.documentId,
        title: `${params.title} · Open loop`,
        summary: openLoop,
        kind: 'open-loop',
        tags: [...baseTags, 'open-loop', ...openLoopEntityTags]
      });
    }

    if (canonFact && !(params.tags ?? []).includes('ruleset')) {
      const canonFactEntityTags = this.buildEntityTags(canonFact, entityHints);
      records.push({
        projectId: params.projectId,
        documentId: params.documentId,
        title: `${params.title} · Canon fact`,
        summary: canonFact,
        kind: 'canon-fact',
        tags: [...baseTags, 'canon-fact', ...canonFactEntityTags]
      });
    }

    return records;
  }

  private prepareEntityHints(hints: MemoryEntityHint[]): Array<
    MemoryEntityHint & {normalizedName: string}
  > {
    const seen = new Set<string>();
    return hints
      .map((hint) => ({
        ...hint,
        normalizedName: this.normalizeText(hint.name)
      }))
      .filter((hint) => {
        if (!hint.normalizedName) return false;
        const key = `${hint.type}:${hint.id}:${hint.normalizedName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private normalizeText(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private countEntityMatches(
    sentence: string,
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>
  ): number {
    const normalizedSentence = this.normalizeText(sentence);
    if (!normalizedSentence) return 0;
    return entityHints.reduce((count, hint) => {
      const pattern = new RegExp(
        `(?:^|\\s)${hint.normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|\\s)`,
        'g'
      );
      return count + Array.from(normalizedSentence.matchAll(pattern)).length;
    }, 0);
  }

  private buildEntityTags(
    sentence: string,
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>
  ): string[] {
    const normalizedSentence = this.normalizeText(sentence);
    if (!normalizedSentence) return [];
    return entityHints
      .filter((hint) => {
        const pattern = new RegExp(
          `(?:^|\\s)${hint.normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|\\s)`
        );
        return pattern.test(normalizedSentence);
      })
      .slice(0, 2)
      .map((hint) => `entity:${hint.id}`);
  }

  private sentenceScore(
    sentence: string,
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>,
    signalPattern?: RegExp,
    penaltyPattern?: RegExp
  ): number {
    let score = this.countEntityMatches(sentence, entityHints) * 4;
    if (signalPattern?.test(sentence)) score += 3;
    if (penaltyPattern?.test(sentence)) score -= 2;
    return score;
  }

  private generateSummary(
    sentences: string[],
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>
  ): string {
    const ranked = [...sentences]
      .map((sentence, index) => ({
        sentence,
        index,
        score: this.sentenceScore(
          sentence,
          entityHints,
          /\b(is|are|was|were|has|have|holds|carries|stands|waits|moves|arrives|leaves|fights|speaks)\b/i
        )
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.index - right.index;
      })
      .slice(0, 2)
      .sort((left, right) => left.index - right.index);
    const summary = ranked.map((entry) => entry.sentence).join(' ').trim();
    return summary.slice(0, 320);
  }

  private extractOpenLoop(
    sentences: string[],
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>
  ): string {
    const candidate = [...sentences]
      .map((sentence) => ({
        sentence,
        score: this.sentenceScore(
          sentence,
          entityHints,
          /\b(must|need|needs|plan|plans|planned|promise|promised|will|later|tomorrow|before|after|if|when|until|quest|goal)\b/i
        )
      }))
      .filter((entry) =>
        /\b(must|need|needs|plan|plans|planned|promise|promised|will|later|tomorrow|before|after|if|when|until|quest|goal)\b/i.test(
          entry.sentence
        )
      )
      .sort((left, right) => right.score - left.score)[0];
    return candidate ? candidate.sentence.slice(0, 280) : '';
  }

  private extractCanonFact(
    sentences: string[],
    entityHints: Array<MemoryEntityHint & {normalizedName: string}>
  ): string {
    const candidate = [...sentences]
      .map((sentence) => ({
        sentence,
        score: this.sentenceScore(
          sentence,
          entityHints,
          /\b(is|are|was|were|has|have|holds|carries|belongs|serves|rules|lives|located|called|known as)\b/i,
          /\b(must|need|will|later|tomorrow|if|when|until)\b/i
        )
      }))
      .filter((entry) =>
        /\b(is|are|was|were|has|have|holds|carries|belongs|serves|rules|lives|located|called|known as)\b/i.test(
          entry.sentence
        ) &&
        !/\b(must|need|will|later|tomorrow|if|when|until)\b/i.test(entry.sentence)
      )
      .sort((left, right) => right.score - left.score)[0];
    return candidate ? candidate.sentence.slice(0, 280) : '';
  }

  private requireDb(): IDBPDatabase<MemoryDB> {
    if (!this.db) {
      throw new Error('Shodh memory database has not been initialized');
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
