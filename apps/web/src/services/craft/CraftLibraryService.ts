import {getLexicalSearchScore} from '../retrieval/lexicalSearch';
import type {
  CraftEmbeddingContract,
  CraftLibraryManifest,
  CraftLibraryProvider,
  CraftQueryEmbedder,
  CraftSearchResult
} from './types';

export class CraftLibraryService implements CraftLibraryProvider {
  private readonly manifest: CraftLibraryManifest;
  private readonly queryEmbedder?: CraftQueryEmbedder;

  constructor(manifest: CraftLibraryManifest, queryEmbedder?: CraftQueryEmbedder) {
    validateCraftLibraryManifest(manifest);
    this.manifest = manifest;
    this.queryEmbedder = queryEmbedder;
  }

  getMetadata() {
    const {schemaVersion, contentVersion, sourceDigest, embedding} = this.manifest;
    return {schemaVersion, contentVersion, sourceDigest, embedding: {...embedding}};
  }

  async search(query: string, limit = 5): Promise<CraftSearchResult[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;
    if (!query.trim() || normalizedLimit === 0 || this.manifest.chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.getCompatibleQueryEmbedding(query);
    const scored = this.manifest.chunks.map((chunk) => {
      const searchable = [
        chunk.title,
        chunk.section,
        chunk.content,
        ...chunk.metadata.aliases,
        ...chunk.metadata.tags
      ].join('\n');
      const lexicalScore = getLexicalSearchScore(query, searchable);
      const vectorScore = queryEmbedding
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      return {chunk, lexicalScore, vectorScore};
    });

    const hasMeaningfulVectorRanking = queryEmbedding !== null && scored.some(
      (result) => Math.abs(result.vectorScore - scored[0]!.vectorScore) > 0.000001
    );
    const candidates = scored.filter((result) =>
      result.lexicalScore > 0 || (hasMeaningfulVectorRanking && Number.isFinite(result.vectorScore))
    );

    return candidates
      .map((result) => ({
        ...result,
        score: result.lexicalScore + result.vectorScore
      }))
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, normalizedLimit)
      .map(({chunk, score}) => ({
        chunk,
        score,
        retrievalMode: queryEmbedding ? 'hybrid' : 'lexical',
        provenance: {
          role: 'craft-reference',
          label: 'Vetted craft reference',
          contentVersion: this.manifest.contentVersion,
          citations: chunk.metadata.citations
        }
      }));
  }

  private async getCompatibleQueryEmbedding(query: string): Promise<number[] | null> {
    if (!this.queryEmbedder || !embeddingContractsMatch(
      this.manifest.embedding,
      this.queryEmbedder.contract
    )) {
      return null;
    }

    try {
      const embedding = await this.queryEmbedder.embed(query);
      if (
        embedding.length !== this.manifest.embedding.dimensions ||
        embedding.some((value) => !Number.isFinite(value))
      ) {
        return null;
      }
      return embedding;
    } catch {
      return null;
    }
  }
}

export function embeddingContractsMatch(
  left: CraftEmbeddingContract,
  right: CraftEmbeddingContract
): boolean {
  return left.model === right.model &&
    left.version === right.version &&
    left.dimensions === right.dimensions &&
    left.normalization === right.normalization;
}

export function validateCraftLibraryManifest(manifest: CraftLibraryManifest): void {
  if (manifest.schemaVersion !== 1 || !manifest.contentVersion || !manifest.sourceDigest) {
    throw new Error('Invalid craft library manifest metadata');
  }
  if (
    !manifest.embedding.model ||
    !manifest.embedding.version ||
    !Number.isInteger(manifest.embedding.dimensions) ||
    manifest.embedding.dimensions <= 0
  ) {
    throw new Error('Invalid craft library embedding contract');
  }

  const ids = new Set<string>();
  for (const chunk of manifest.chunks) {
    if (chunk.metadata.type !== 'craft' || chunk.metadata.authorVetted !== true) {
      throw new Error(`Craft chunk ${chunk.id || '(unknown)'} is not vetted craft reference material`);
    }
    if (!chunk.id || ids.has(chunk.id) || !chunk.recordId || chunk.recordVersion < 1) {
      throw new Error(`Invalid or duplicate craft chunk id: ${chunk.id || '(empty)'}`);
    }
    if (
      chunk.embedding.length !== manifest.embedding.dimensions ||
      chunk.embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(`Craft chunk ${chunk.id} has an incompatible embedding`);
    }
    ids.add(chunk.id);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! * left[index]!;
    rightNorm += right[index]! * right[index]!;
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}
