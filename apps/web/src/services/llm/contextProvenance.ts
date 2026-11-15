import type {LoreDocumentLink} from '../../entityTypes';
import {AI_SESSION_CONTEXT_QUALIFIER, isAiSessionSourceNote} from '../lore/sourceNoteOrigin';
import {getLoreDocumentLinksByProject, getLoreDocumentsByProject} from '../storage';
import type {RAGSearchResult} from '../rag/types';
import type {ContextSourceRef, LLMContextChunk} from './types';

export const CONTEXT_TRUST_INSTRUCTIONS = `Context trust rules:
- Treat accepted canon and accepted canon facts as the strongest source of truth.
- Treat Source Notes as evidence and background material, not automatically canon.
- Prefer accepted canon when Source Notes conflict with it.
- A Source Note labelled "saved from an AI session" may hold text a model wrote. Do not present it as the author's own words or decision.
- Do not treat pending, rejected, or unconfirmed proposals as canon unless the author explicitly asks to discuss proposals.`;

export function appendContextTrustInstructions(basePrompt: string): string {
  return `${basePrompt.trim()}\n\n${CONTEXT_TRUST_INSTRUCTIONS}`;
}

export function getLoreDocumentIdFromRagDocumentId(documentId: string): string {
  return documentId.startsWith('lore:') ? documentId.slice('lore:'.length) : documentId;
}

/** `aiSessionNoteIds` holds the Source Notes saved from an AI session; their label says so. */
export function getRagContextSource(
  result: RAGSearchResult,
  loreLinks: LoreDocumentLink[] = [],
  aiSessionNoteIds: ReadonlySet<string> = new Set()
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
      // The label keeps its opening words: the context budget sorts notes by them.
      const origin = aiSessionNoteIds.has(loreDocumentId) ? ` (${AI_SESSION_CONTEXT_QUALIFIER})` : '';
      return isLinkedSourceNote
        ? `Linked Source Note${origin}: source material, not automatically canon - ${title}`
        : `General Source Note${origin}: project reference, not automatically canon - ${title}`;
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
  loreLinks: LoreDocumentLink[] = [],
  aiSessionNoteIds: ReadonlySet<string> = new Set()
): LLMContextChunk {
  const sourceRef = getRagContextSourceRef(result);
  return {
    content: result.chunk.content,
    source: getRagContextSource(result, loreLinks, aiSessionNoteIds),
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
  let aiSessionNoteIds: ReadonlySet<string> = new Set();

  if (hasLoreChunks) {
    try {
      loreLinks = await getLoreDocumentLinksByProject(projectId);
    } catch (error) {
      console.warn('Unable to load Source Note links for AI context labels.', error);
    }
    try {
      const notes = await getLoreDocumentsByProject(projectId);
      aiSessionNoteIds = new Set(notes.filter(isAiSessionSourceNote).map((note) => note.id));
    } catch (error) {
      console.warn('Unable to load Source Notes for AI context labels.', error);
    }
  }

  return results.map((result) => buildRagContextChunk(result, loreLinks, aiSessionNoteIds));
}
