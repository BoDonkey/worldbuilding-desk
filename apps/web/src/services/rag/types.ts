export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  embedding?: number[];
  metadata: {
    type: 'worldbible' | 'scene' | 'rule';
    entityIds?: string[];
    tags?: string[];
  };
}

export interface RAGSearchResult {
  chunk: DocumentChunk;
  score: number;
}