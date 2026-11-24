import type {WritingDocument} from '../../entityTypes';
import {getNextWritingDocumentOrder} from '../storage';

/** A new scene at the end of the manuscript, not yet saved. Empty unless `content` is given. */
export function buildNewSceneDocument(params: {
  projectId: string;
  documents: WritingDocument[];
  title?: string;
  id?: string;
  content?: string;
}): WritingDocument {
  const now = Date.now();
  return {
    id: params.id ?? crypto.randomUUID(),
    projectId: params.projectId,
    title: params.title?.trim() || 'Untitled scene',
    content: params.content ?? '<p></p>',
    order: getNextWritingDocumentOrder(params.documents),
    createdAt: now,
    updatedAt: now
  };
}
