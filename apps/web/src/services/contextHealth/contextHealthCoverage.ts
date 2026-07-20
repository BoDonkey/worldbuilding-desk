import type {DocumentChunk, RAGDiagnostics} from '../rag/types';

export interface ExpectedContextDocument {
  documentId: string;
  type: DocumentChunk['metadata']['type'];
}

export interface MissingContextDocumentSummary {
  scene: number;
  worldbible: number;
  lore: number;
  canon_fact: number;
  rule: number;
}

export function hasIndexableContextContent(content: string): boolean {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .length > 0;
}

export function summarizeMissingContextDocuments(params: {
  diagnostics: RAGDiagnostics | null;
  expectedDocuments: ExpectedContextDocument[];
}): MissingContextDocumentSummary {
  const summary: MissingContextDocumentSummary = {
    scene: 0,
    worldbible: 0,
    lore: 0,
    canon_fact: 0,
    rule: 0
  };

  if (!params.diagnostics) {
    params.expectedDocuments.forEach((document) => {
      summary[document.type] += 1;
    });
    return summary;
  }

  const indexedKeys = new Set(
    params.diagnostics.documents.map((document) => `${document.type}:${document.documentId}`)
  );
  params.expectedDocuments.forEach((document) => {
    if (!indexedKeys.has(`${document.type}:${document.documentId}`)) {
      summary[document.type] += 1;
    }
  });

  return summary;
}
