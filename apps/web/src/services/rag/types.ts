export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  embedding?: number[];
  metadata: {
    type: 'worldbible' | 'scene' | 'rule' | 'lore' | 'canon_fact';
    entityIds?: string[];
    tags?: string[];
  };
}

export interface RAGSearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface RAGDocumentDiagnostic {
  documentId: string;
  documentTitle: string;
  type: DocumentChunk['metadata']['type'];
  chunkCount: number;
  tags: string[];
  entityIds: string[];
}

export interface RAGDiagnostics {
  chunkCount: number;
  documentCount: number;
  countsByType: Record<DocumentChunk['metadata']['type'], number>;
  documents: RAGDocumentDiagnostic[];
}
