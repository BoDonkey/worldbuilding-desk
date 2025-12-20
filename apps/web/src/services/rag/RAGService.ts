import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { DocumentChunk, RAGSearchResult } from './types';

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

export class RAGService {
  private db: IDBPDatabase<RAGDatabase> | null = null;
  private embeddingApiKey: string;

  constructor(embeddingApiKey: string) {
    this.embeddingApiKey = embeddingApiKey;
  }

  async init(projectId: string): Promise<void> {
    this.db = await openDB<RAGDatabase>(`rag-${projectId}`, 1, {
      upgrade(db) {
        const chunkStore = db.createObjectStore('chunks', {keyPath: 'id'});
        chunkStore.createIndex('by-document', 'documentId');
        chunkStore.createIndex('by-type', 'metadata.type');
      }
    });
  }

  async indexDocument(
    documentId: string,
    title: string,
    content: string,
    type: 'worldbible' | 'scene' | 'rule'
  ): Promise<void> {
    const chunks = this.chunkDocument(content);

    for (const [index, chunkText] of chunks.entries()) {
      const embedding = await this.getEmbedding(chunkText);

      const chunk: DocumentChunk = {
        id: `${documentId}-${index}`,
        documentId,
        documentTitle: title,
        content: chunkText,
        embedding,
        metadata: {type}
      };

      await this.db!.put('chunks', chunk);
    }
  }

  async search(query: string, limit: number = 5): Promise<RAGSearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query);
    const allChunks = await this.db!.getAll('chunks');

    const results = allChunks
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  private chunkDocument(
    content: string,
    maxChunkSize: number = 1000
  ): string[] {
    // Simple chunking by paragraphs, respecting max size
    const paragraphs = content.split('\n\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + para).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Use Anthropic's embeddings or OpenAI's
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.embeddingApiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
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
}
