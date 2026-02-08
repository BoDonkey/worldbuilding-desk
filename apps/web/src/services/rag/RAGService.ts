import {openDB} from 'idb';
import type {DBSchema, IDBPDatabase} from 'idb';
import type {DocumentChunk, RAGSearchResult} from './types';

interface RAGDatabase extends DBSchema {
  chunks: {
    key: string;
    value: DocumentChunk;
    indexes: {
      'by-document': string;
      'by-type': string;
    };
  };
}

type EntityVocabulary = Array<{
  id: string;
  terms: string[];
}>;

type EmbeddingPipeline = (text: string, options?: Record<string, unknown>) => Promise<any>;

export interface RAGProvider {
  init(projectId: string): Promise<void>;
  setEntityVocabulary(vocabulary: EntityVocabulary): void;
  deleteDocument(documentId: string): Promise<void>;
  indexDocument(
    documentId: string,
    title: string,
    content: string,
    type: DocumentChunk['metadata']['type'],
    options?: {tags?: string[]; entityIds?: string[]}
  ): Promise<void>;
  search(query: string, limit?: number): Promise<RAGSearchResult[]>;
}

export class RAGService implements RAGProvider {
  private db: IDBPDatabase<RAGDatabase> | null = null;
  private entityVocabulary: EntityVocabulary = [];
  private embeddingPipelinePromise: Promise<EmbeddingPipeline> | null = null;

  async init(projectId: string): Promise<void> {
    this.db = await openDB<RAGDatabase>(`rag-${projectId}`, 2, {
      upgrade(db, oldVersion) {
        const chunkStore = db.createObjectStore('chunks', {keyPath: 'id'});
        chunkStore.createIndex('by-document', 'documentId');
        chunkStore.createIndex('by-type', 'metadata.type');

        if (oldVersion < 2) {
          // no-op placeholder for future migrations
        }
      }
    });
  }

  setEntityVocabulary(vocabulary: EntityVocabulary) {
    this.entityVocabulary = vocabulary;
  }

  async deleteDocument(documentId: string): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    const index = store.index('by-document');
    let cursor = await index.openCursor(IDBKeyRange.only(documentId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async indexDocument(
    documentId: string,
    title: string,
    content: string,
    type: DocumentChunk['metadata']['type'],
    options?: {tags?: string[]; entityIds?: string[]}
  ): Promise<void> {
    const normalized = this.normalizeContent(content);
    await this.deleteDocument(documentId);
    const chunks = this.chunkDocument(normalized);

    for (const [index, chunkText] of chunks.entries()) {
      const embedding = await this.getEmbedding(chunkText);
      const entityIds = this.extractEntityIds(chunkText, options?.entityIds);

      const chunk: DocumentChunk = {
        id: `${documentId}-${index}`,
        documentId,
        documentTitle: title,
        content: chunkText,
        embedding,
        metadata: {
          type,
          entityIds: entityIds.length > 0 ? entityIds : undefined,
          tags: options?.tags
        }
      };

      await this.requireDb().put('chunks', chunk);
    }
  }

  async search(query: string, limit: number = 5): Promise<RAGSearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query);
    const allChunks = await this.requireDb().getAll('chunks');

    return allChunks
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private chunkDocument(content: string, maxChunkSize: number = 1000, overlap = 120): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + maxChunkSize, content.length);

      if (end < content.length) {
        const boundary = content.lastIndexOf('\n\n', end);
        if (boundary > start + 200) {
          end = boundary;
        } else {
          const sentenceBoundary = content.lastIndexOf('.', end);
          if (sentenceBoundary > start + 200) {
            end = sentenceBoundary + 1;
          }
        }
      }

      const chunk = content.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      const nextStart = Math.max(end - overlap, 0);
      if (nextStart <= start) {
        start = end;
      } else {
        start = nextStart;
      }
    }

    return chunks;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const pipeline = await this.loadEmbeddingPipeline();
    const output = await pipeline(text, {pooling: 'mean', normalize: true});
    const data =
      output?.data instanceof Float32Array
        ? output.data
        : Array.isArray(output?.data)
          ? Float32Array.from(output.data)
          : new Float32Array(output?.data?.data ?? []);
    return Array.from(data);
  }

  private async loadEmbeddingPipeline(): Promise<EmbeddingPipeline> {
    if (!this.embeddingPipelinePromise) {
      this.embeddingPipelinePromise = (async () => {
        const transformers = await import('@xenova/transformers');
        return transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      })();
    }

    return this.embeddingPipelinePromise!;
  }

  private normalizeContent(content: string): string {
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractEntityIds(text: string, seedIds?: string[]): string[] {
    const hits = new Set<string>(seedIds ?? []);
    const lower = text.toLowerCase();

    for (const entity of this.entityVocabulary) {
      if (entity.terms.some((term) => term && lower.includes(term.toLowerCase()))) {
        hits.add(entity.id);
      }
    }

    return Array.from(hits);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private requireDb(): IDBPDatabase<RAGDatabase> {
    if (!this.db) {
      throw new Error('RAG database has not been initialized');
    }
    return this.db;
  }
}

export class CompositeRAGService implements RAGProvider {
  constructor(
    private primary: RAGProvider,
    private parents: RAGProvider[] = []
  ) {}

  async init(projectId: string): Promise<void> {
    await this.primary.init(projectId);
  }

  setEntityVocabulary(vocabulary: EntityVocabulary) {
    this.primary.setEntityVocabulary(vocabulary);
    for (const parent of this.parents) {
      parent.setEntityVocabulary(vocabulary);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.primary.deleteDocument(documentId);
  }

  async indexDocument(
    documentId: string,
    title: string,
    content: string,
    type: DocumentChunk['metadata']['type'],
    options?: {tags?: string[]; entityIds?: string[]}
  ): Promise<void> {
    await this.primary.indexDocument(documentId, title, content, type, options);
  }

  async search(query: string, limit = 5): Promise<RAGSearchResult[]> {
    const [local, ...parentResults] = await Promise.all([
      this.primary.search(query, limit),
      ...this.parents.map((parent) => parent.search(query, limit))
    ]);
    return [...parentResults.flat(), ...local]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
