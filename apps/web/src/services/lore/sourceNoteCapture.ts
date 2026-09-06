import type {LoreDocument} from '../../entityTypes';
import {saveLoreDocument} from '../../loreStorage';
import type {RAGProvider} from '../rag/RAGService';

/** Shared with LoreRoute so a manually authored note and an assistant-captured
 * one summarize identically. */
export const summarizeContent = (content: string, limit = 220): string => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}...`;
};

const FALLBACK_TITLE = 'Assistant note';
const MAX_TITLE_LENGTH = 80;

/** The first non-empty line stands in for a title; assistant prose rarely opens with one. */
export function deriveSourceNoteTitle(content: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return FALLBACK_TITLE;
  return firstLine.length <= MAX_TITLE_LENGTH
    ? firstLine
    : `${firstLine.slice(0, MAX_TITLE_LENGTH)}...`;
}

/** Deterministic construction only — no persistence or indexing side effects. */
export function buildDraftSourceNoteFromAssistantOutput(params: {
  projectId: string;
  sessionId: string;
  content: string;
}): LoreDocument {
  const {projectId, sessionId, content} = params;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: deriveSourceNoteTitle(content),
    kind: 'general_lore',
    format: 'plain_text',
    content: content.trim(),
    summary: summarizeContent(content),
    source: {type: 'ai-session', sessionId},
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Captures assistant chat output as a draft Source Note — never canon. It
 * enters the same extraction/review pipeline as any manually authored note;
 * this only performs the save and RAG indexing a manual save would also do.
 */
export async function saveDraftSourceNoteFromAssistantOutput(params: {
  projectId: string;
  sessionId: string;
  content: string;
  ragService: RAGProvider | null;
}): Promise<LoreDocument> {
  const {ragService, ...draftParams} = params;
  const document = buildDraftSourceNoteFromAssistantOutput(draftParams);
  await saveLoreDocument(document);
  if (ragService) {
    await ragService.indexDocument(`lore:${document.id}`, document.title, document.content, 'lore', {
      tags: [document.kind, 'lore'],
      entityIds: []
    });
  }
  return document;
}
