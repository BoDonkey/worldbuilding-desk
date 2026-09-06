export type CraftDetectability = 'deterministic' | 'model-assisted' | 'practice';
export type CraftScope = 'selection' | 'scene' | 'chapter' | 'manuscript' | 'series' | 'practice';
export type CraftSourceConfidence = 'high' | 'medium' | 'limited';

export interface CraftEmbeddingContract {
  model: string;
  version: string;
  dimensions: number;
  normalization: 'l2' | 'none';
}

export interface CraftCitation {
  id: string;
  label: string;
  url?: string;
}

export interface CraftChunk {
  id: string;
  recordId: string;
  recordVersion: number;
  title: string;
  section: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'craft';
    authorVetted: true;
    documentType: 'pattern' | 'comparison' | 'profile';
    family: string;
    detectability: CraftDetectability;
    scopes: CraftScope[];
    genres: string[];
    subgenres: string[];
    exclusions: string[];
    modifiers: string[];
    tags: string[];
    aliases: string[];
    sourceConfidence: CraftSourceConfidence;
    citations: CraftCitation[];
  };
}

export interface CraftLibraryManifest {
  schemaVersion: 1;
  contentVersion: string;
  sourceDigest: string;
  embedding: CraftEmbeddingContract;
  chunks: CraftChunk[];
}

export interface CraftQueryEmbedder {
  contract: CraftEmbeddingContract;
  embed(text: string): Promise<number[]>;
}

export interface CraftSearchResult {
  chunk: CraftChunk;
  score: number;
  retrievalMode: 'hybrid' | 'lexical';
  provenance: {
    role: 'craft-reference';
    label: 'Vetted craft reference';
    contentVersion: string;
    citations: CraftCitation[];
  };
}

export interface CraftLibraryProvider {
  search(query: string, limit?: number): Promise<CraftSearchResult[]>;
  getMetadata(): Readonly<Pick<CraftLibraryManifest, 'schemaVersion' | 'contentVersion' | 'sourceDigest' | 'embedding'>>;
}
