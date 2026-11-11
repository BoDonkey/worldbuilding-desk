import {useCallback, useEffect, useMemo, useState} from 'react';
import type {RefObject} from 'react';
import type {Location, NavigateFunction} from 'react-router';
import type {ChapterCard, WritingDocument} from '../entityTypes';
import {findCardsForScene} from '../services/workspace/chapterCardSceneLinks';
import {useNotificationStore} from '../store/notificationStore';
import {useChapterCardSceneActions} from './useChapterCardSceneActions';
import type {useWorkspaceCorkboard} from './useWorkspaceCorkboard';

interface UseWorkspaceChapterCardLinksParams {
  corkboard: ReturnType<typeof useWorkspaceCorkboard>;
  setCorkboardModalOpen: (open: boolean) => void;
  createDocument: Parameters<typeof useChapterCardSceneActions>[0]['createDocument'];
  selectedDocument: WritingDocument | null | undefined;
  sceneTitleInputRef: RefObject<HTMLInputElement | null>;
  navigate: NavigateFunction;
  location: Location;
}

/**
 * Chapter cards and scenes in the Workspace: the cards the open scene belongs
 * to, the quick Corkboard dialog (opened on a card when asked), and creating a
 * new scene linked to a card, including the request handed over from the
 * Corkboard route. A scene that is created but not linked gets a toast with
 * a retry.
 */
export function useWorkspaceChapterCardLinks({
  corkboard,
  setCorkboardModalOpen,
  createDocument,
  selectedDocument,
  sceneTitleInputRef,
  navigate,
  location
}: UseWorkspaceChapterCardLinksParams) {
  const [creatingLinkedSceneCardId, setCreatingLinkedSceneCardId] = useState<string | null>(null);
  const [focusCorkboardCardId, setFocusCorkboardCardId] = useState<string | null>(null);
  const pushToast = useNotificationStore((state) => state.pushToast);

  const openCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(true);
  }, [setCorkboardModalOpen]);
  const closeCorkboardModal = useCallback(() => {
    setCorkboardModalOpen(false);
    setFocusCorkboardCardId(null);
  }, [setCorkboardModalOpen]);

  const updateCorkboardCard = corkboard.updateCorkboardCard;
  const updateLinkedSceneIds = useCallback(
    (cardId: string, sceneIds: string[]) => updateCorkboardCard(
      cardId,
      {sceneIds},
      {persistImmediately: true}
    ),
    [updateCorkboardCard]
  );
  const {createLinkedScene, retryLink} = useChapterCardSceneActions({
    createDocument,
    updateCard: updateLinkedSceneIds
  });
  const focusSceneTitle = useCallback(() => {
    window.requestAnimationFrame(() => sceneTitleInputRef.current?.focus());
    window.setTimeout(() => sceneTitleInputRef.current?.focus(), 50);
    window.setTimeout(() => sceneTitleInputRef.current?.focus(), 150);
  }, [sceneTitleInputRef]);
  const showLinkedSceneResult = useCallback(async (
    card: ChapterCard,
    result: Awaited<ReturnType<typeof createLinkedScene>>
  ) => {
    if (!result.document) return;
    closeCorkboardModal();
    focusSceneTitle();
    const cardName = card.title.trim() || 'Untitled chapter';
    if (result.linked) {
      pushToast({message: `Scene created and linked to ${cardName}.`});
      return;
    }
    const document = result.document;
    pushToast({
      tone: 'error',
      message: `Scene created but not linked to ${cardName}.`,
      durationMs: null,
      action: {
        label: 'Link now',
        onSelect: () => {
          void retryLink(card, document).then((linked) => {
            pushToast(linked
              ? {message: `Linked ${document.title} to ${cardName}.`}
              : {tone: 'error', message: `Could not link ${document.title} to ${cardName}.`});
          });
        }
      }
    });
  }, [closeCorkboardModal, focusSceneTitle, pushToast, retryLink]);
  const handleCreateLinkedScene = useCallback(async (card: ChapterCard) => {
    if (creatingLinkedSceneCardId) return;
    setCreatingLinkedSceneCardId(card.id);
    try {
      await showLinkedSceneResult(card, await createLinkedScene(card));
    } finally {
      setCreatingLinkedSceneCardId(null);
    }
  }, [createLinkedScene, creatingLinkedSceneCardId, showLinkedSceneResult]);

  const linkedChapterCards = useMemo(
    () => selectedDocument
      ? findCardsForScene(corkboard.corkboardCards, selectedDocument.id)
      : [],
    [corkboard.corkboardCards, selectedDocument]
  );
  const handleOpenChapterCard = useCallback((cardId: string) => {
    setFocusCorkboardCardId(cardId);
    setCorkboardModalOpen(true);
  }, [setCorkboardModalOpen]);
  const handleOpenChapterCardRoute = useCallback((cardId: string) => {
    navigate('/corkboard', {state: {focusCardId: cardId}});
  }, [navigate]);

  const clearFocusCorkboardCard = useCallback(() => setFocusCorkboardCardId(null), []);

  useEffect(() => {
    const state = location.state as {createLinkedSceneCardId?: string} | null;
    const cardId = state?.createLinkedSceneCardId;
    if (!cardId || corkboard.corkboardStatus !== 'saved') return;
    navigate(location.pathname, {replace: true, state: {}});
    const card = corkboard.corkboardCards.find((entry) => entry.id === cardId);
    if (card) void handleCreateLinkedScene(card);
  }, [
    corkboard.corkboardCards,
    corkboard.corkboardStatus,
    handleCreateLinkedScene,
    location.pathname,
    location.state,
    navigate
  ]);

  return {
    creatingLinkedSceneCardId,
    focusCorkboardCardId,
    clearFocusCorkboardCard,
    openCorkboardModal,
    closeCorkboardModal,
    handleCreateLinkedScene,
    linkedChapterCards,
    handleOpenChapterCard,
    handleOpenChapterCardRoute
  };
}
