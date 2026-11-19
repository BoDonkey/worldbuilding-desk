import {useEffect, useRef, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import {
  clearSavedEditorScrollTop,
  readSavedEditorScrollTop,
  writeSavedEditorScrollTop
} from '../services/editor/editorScrollStore';

/** How far below the top of the editor a revealed position should sit. */
const REVEAL_TOP_OFFSET = 120;

/**
 * Scrolls `position` to at least `REVEAL_TOP_OFFSET` below the top of the
 * editor's scroll area, so it is not hidden under the toolbar, and saves the
 * new scroll top for the scene. Used by find in scene and review focus.
 */
export function revealEditorPosition(
  editor: TipTapEditorInstance,
  scrollElement: HTMLElement,
  position: number,
  scrollKey: string
): void {
  const editorRect = scrollElement.getBoundingClientRect();
  const positionRect = editor.view.coordsAtPos(position);
  const desiredTop = editorRect.top + REVEAL_TOP_OFFSET;
  if (positionRect.top < desiredTop) {
    const nextScrollTop = Math.max(0, scrollElement.scrollTop - (desiredTop - positionRect.top));
    scrollElement.scrollTop = nextScrollTop;
    writeSavedEditorScrollTop(scrollKey, nextScrollTop);
  }
}

/**
 * Remembers each scene's scroll position: saves it as the author scrolls,
 * restores it once the scene's text has loaded, and resets it to the top when
 * `resetScrollToken` changes. The `data-wbd-*` attributes on the scroll
 * element record what happened, for tests.
 */
export function useEditorScrollMemory(params: {
  editorScrollRef: RefObject<HTMLDivElement | null>;
  editorScrollKey: string;
  editorReadyToken: number;
  documentId: string;
  /** A review focus target; while set, it decides the scroll position instead. */
  focusQuery: string | null;
  hasContent: boolean;
  resetScrollToken: number;
}): void {
  const {
    editorScrollRef,
    editorScrollKey,
    editorReadyToken,
    documentId,
    focusQuery,
    hasContent,
    resetScrollToken
  } = params;
  const isRestoringEditorScrollRef = useRef(false);
  const editorMountedAtRef = useRef(Date.now());
  const appliedScrollResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const scrollElement = editorScrollRef.current;
    if (!scrollElement) return;

    let animationFrame: number | null = null;
    let lastObservedScrollTop = readSavedEditorScrollTop(editorScrollKey);
    const saveScrollPosition = () => {
      if (isRestoringEditorScrollRef.current) {
        return;
      }
      const nextScrollTop = lastObservedScrollTop;
      const savedScrollTop = readSavedEditorScrollTop(editorScrollKey);
      const isEarlyZeroAfterRemount =
        nextScrollTop === 0 &&
        savedScrollTop > 0 &&
        Date.now() - editorMountedAtRef.current < 1500;

      if (isEarlyZeroAfterRemount) {
        scrollElement.dataset.wbdSavedScrollTop = String(savedScrollTop);
        scrollElement.dataset.wbdSkippedZeroScrollSave = 'true';
        return;
      }

      writeSavedEditorScrollTop(editorScrollKey, nextScrollTop);
      scrollElement.dataset.wbdSavedScrollTop = String(nextScrollTop);
      delete scrollElement.dataset.wbdSkippedZeroScrollSave;
    };
    const handleScroll = () => {
      if (isRestoringEditorScrollRef.current) return;
      lastObservedScrollTop = scrollElement.scrollTop;
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        saveScrollPosition();
      });
    };
    const captureScrollPosition = () => {
      lastObservedScrollTop = scrollElement.scrollTop;
      writeSavedEditorScrollTop(editorScrollKey, lastObservedScrollTop);
    };

    scrollElement.addEventListener('scroll', handleScroll, {passive: true});
    window.addEventListener('wbd:capture-workspace-scroll', captureScrollPosition);
    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      isRestoringEditorScrollRef.current = false;
      if (scrollElement.scrollTop > 0) {
        lastObservedScrollTop = scrollElement.scrollTop;
      }
      saveScrollPosition();
      scrollElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wbd:capture-workspace-scroll', captureScrollPosition);
    };
  }, [editorScrollKey, editorScrollRef]);

  // Restore once a scene's text has loaded, never on edits: re-running per
  // keystroke snapped the scene to its stale saved position (5.17).
  useEffect(() => {
    const scrollElement = editorScrollRef.current;
    if (!scrollElement || focusQuery?.trim()) return;
    const resetKey = resetScrollToken ? `${documentId}:${resetScrollToken}` : null;
    if (resetKey && appliedScrollResetKeyRef.current !== resetKey) return;

    const storedScrollTop = readSavedEditorScrollTop(editorScrollKey);
    if (storedScrollTop <= 0) {
      if (scrollElement.scrollTop !== 0) {
        scrollElement.scrollTop = 0;
      }
      scrollElement.dataset.wbdRestoreTarget = '0';
      scrollElement.dataset.wbdRestoredScrollTop = '0';
      return;
    }

    let cancelled = false;
    let userInterrupted = false;
    const startedAt = Date.now();
    const frameIds: number[] = [];
    isRestoringEditorScrollRef.current = true;
    scrollElement.dataset.wbdRestoreTarget = String(storedScrollTop);

    const restoreScrollPosition = () => {
      if (cancelled || userInterrupted) {
        isRestoringEditorScrollRef.current = false;
        return;
      }

      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      const nextScrollTop = Math.min(storedScrollTop, maxScrollTop);
      scrollElement.scrollTop = nextScrollTop;
      scrollElement.dataset.wbdRestoredScrollTop = String(nextScrollTop);

      if (Date.now() - startedAt < 2500) {
        frameIds.push(window.requestAnimationFrame(restoreScrollPosition));
        return;
      }

      isRestoringEditorScrollRef.current = false;
    };
    const markUserInterrupted = () => {
      userInterrupted = true;
      isRestoringEditorScrollRef.current = false;
      writeSavedEditorScrollTop(editorScrollKey, scrollElement.scrollTop);
      scrollElement.dataset.wbdSavedScrollTop = String(scrollElement.scrollTop);
    };

    scrollElement.addEventListener('wheel', markUserInterrupted, {passive: true});
    scrollElement.addEventListener('touchstart', markUserInterrupted, {passive: true});
    scrollElement.addEventListener('pointerdown', markUserInterrupted);
    scrollElement.addEventListener('keydown', markUserInterrupted);
    frameIds.push(
      window.requestAnimationFrame(() =>
        frameIds.push(window.requestAnimationFrame(restoreScrollPosition))
      )
    );

    return () => {
      cancelled = true;
      isRestoringEditorScrollRef.current = false;
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      scrollElement.removeEventListener('wheel', markUserInterrupted);
      scrollElement.removeEventListener('touchstart', markUserInterrupted);
      scrollElement.removeEventListener('pointerdown', markUserInterrupted);
      scrollElement.removeEventListener('keydown', markUserInterrupted);
    };
  }, [
    documentId,
    editorReadyToken,
    editorScrollKey,
    editorScrollRef,
    focusQuery,
    hasContent,
    resetScrollToken
  ]);

  useEffect(() => {
    if (!resetScrollToken) return;
    const resetKey = `${documentId}:${resetScrollToken}`;
    if (appliedScrollResetKeyRef.current === resetKey) return;
    const scrollElement = editorScrollRef.current;
    if (!scrollElement) return;
    appliedScrollResetKeyRef.current = resetKey;
    let cancelled = false;
    const frameIds: number[] = [];
    const timeoutIds: number[] = [];
    const resetToTop = () => {
      if (cancelled) return;
      isRestoringEditorScrollRef.current = false;
      scrollElement.scrollTop = 0;
      scrollElement.dataset.wbdSavedScrollTop = '0';
      scrollElement.dataset.wbdRestoredScrollTop = '0';
      clearSavedEditorScrollTop(editorScrollKey);
    };
    resetToTop();
    frameIds.push(window.requestAnimationFrame(resetToTop));
    frameIds.push(
      window.requestAnimationFrame(() =>
        frameIds.push(window.requestAnimationFrame(resetToTop))
      )
    );
    [50, 150, 300].forEach((delay) => {
      timeoutIds.push(window.setTimeout(resetToTop, delay));
    });
    return () => {
      cancelled = true;
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [documentId, editorReadyToken, editorScrollKey, editorScrollRef, resetScrollToken]);
}
