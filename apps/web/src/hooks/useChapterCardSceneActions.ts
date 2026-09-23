import {useCallback} from 'react';
import type {ChapterCard, WritingDocument} from '../entityTypes';
import {addSceneLink, deriveLinkedSceneTitle} from '../services/workspace/chapterCardSceneLinks';

export interface CreateLinkedSceneResult {
  document: WritingDocument | null;
  linked: boolean;
}

interface ChapterCardSceneActionsParams {
  createDocument: (options: {title?: string; select?: boolean}) => Promise<WritingDocument | null>;
  updateCard: (cardId: string, sceneIds: string[]) => Promise<void> | void;
}

export function useChapterCardSceneActions({
  createDocument,
  updateCard
}: ChapterCardSceneActionsParams) {
  const retryLink = useCallback(async (card: ChapterCard, document: WritingDocument) => {
    try {
      await updateCard(card.id, addSceneLink(card, document.id));
      return true;
    } catch {
      return false;
    }
  }, [updateCard]);

  const createLinkedScene = useCallback(async (
    card: ChapterCard
  ): Promise<CreateLinkedSceneResult> => {
    const linkedCount = new Set(card.sceneIds ?? []).size;
    const document = await createDocument({
      title: deriveLinkedSceneTitle(card, linkedCount)
    });
    if (!document) return {document: null, linked: false};
    return {document, linked: await retryLink(card, document)};
  }, [createDocument, retryLink]);

  return {createLinkedScene, retryLink};
}
