import type {LoreDocumentLink} from '../../entityTypes';
import {getLoreDocumentLinksByProject} from '../storage';
import type {RAGSearchResult} from '../rag/types';
import type {ContextSourceRef, LLMContextChunk} from './types';

export const CONTEXT_TRUST_INSTRUCTIONS = `Context trust rules:
- Treat accepted canon and accepted canon facts as the strongest source of truth.
- Treat Source Notes as evidence and background material, not automatically canon.
- Prefer accepted canon when Source Notes conflict with it.
- Do not treat pending, rejected, or unconfirmed proposals as canon unless the author explicitly asks to discuss proposals.`;

export function appendContextTrustInstructions(basePrompt: string): string {
  return `${basePrompt.trim()}\n\n${CONTEXT_TRUST_INSTRUCTIONS}`;
}

export function getLoreDocumentIdFromRagDocumentId(documentId: string): string {
  return documentId.startsWith('lore:') ? documentId.slice('lore:'.length) : documentId;
}

export function getRagContextSource(
  result: RAGSearchResult,
  loreLinks: LoreDocumentLink[] = []
): string {
  const {chunk} = result;
  const title = chunk.documentTitle || 'Untitled source';

  switch (chunk.metadata.type) {
    case 'worldbible':
      return `Accepted canon: World Bible record - ${title}`;
    case 'canon_fact':
      return `Accepted canon fact - ${title}`;
    case 'lore': {
      const loreDocumentId = getLoreDocumentIdFromRagDocumentId(chunk.documentId);
      const isLinkedSourceNote = loreLinks.some(
        (link) => link.loreDocumentId === loreDocumentId
      );
      return isLinkedSourceNote
        ? `Linked Source Note: source material, not automatically canon - ${title}`
        : `General Source Note: project reference, not automatically canon - ${title}`;
    }
    case 'scene':
      return `Scene draft - ${title}`;
    case 'rule':
      return `Rules reference - ${title}`;
  }
}

/** Source Notes and World Bible records can be opened; other chunk types have no single record. */
export function getRagContextSourceRef(result: RAGSearchResult): ContextSourceRef | undefined {
  const {type} = result.chunk.metadata;
  const id = result.chunk.documentId;
  if (type === 'lore') return {kind: 'source-note', id: getLoreDocumentIdFromRagDocumentId(id)};
  if (type === 'worldbible') return {kind: 'world-bible', id};
  return undefined;
}

export function buildRagContextChunk(
  result: RAGSearchResult,
  loreLinks: LoreDocumentLink[] = []
): LLMContextChunk {
  const sourceRef = getRagContextSourceRef(result);
  return {
    content: result.chunk.content,
    source: getRagContextSource(result, loreLinks),
    relevance: result.score,
    ...(sourceRef ? {sourceRef} : {})
  };
}

export async function buildRagContextChunks(
  projectId: string,
  results: RAGSearchResult[]
): Promise<LLMContextChunk[]> {
  const hasLoreChunks = results.some((result) => result.chunk.metadata.type === 'lore');
  let loreLinks: LoreDocumentLink[] = [];

  if (hasLoreChunks) {
    try {
      loreLinks = await getLoreDocumentLinksByProject(projectId);
    } catch (error) {
      console.warn('Unable to load Source Note links for AI context labels.', error);
    }
  }

  return results.map((result) => buildRagContextChunk(result, loreLinks));
}
