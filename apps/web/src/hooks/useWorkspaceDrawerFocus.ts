import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import {useLocation, useNavigate} from 'react-router';
import type {WritingDocument} from '../entityTypes';
import type {WorkspaceContextDrawerView} from './useWorkspaceDrawers';

export interface WorkspaceReviewFocusItem {
  id: string;
  sceneId: string;
  issue: {surface?: string};
}

interface WorkspaceScrollSnapshot {
  windowY: number;
  elements: Array<{key: string; top: number; left: number}>;
}

const workspaceWindowScrollPositions = new Map<string, number>();
const workspaceScrollSnapshots = new Map<string, WorkspaceScrollSnapshot>();

export function useWorkspaceDrawerFocus(params: {
  activeProjectId: string | null;
  selectedId: string | null;
  documents: WritingDocument[];
  content: string;
  editorScrollResetToken: number;
  isContextDrawerOpen: boolean;
  handleSelectDocument: (document: WritingDocument) => void;
  setActiveContextView: (view: WorkspaceContextDrawerView) => void;
  setContextDrawerOpen: (open: boolean) => void;
}) {
  const {
    activeProjectId,
    selectedId,
    documents,
    content,
    editorScrollResetToken,
    isContextDrawerOpen,
    handleSelectDocument,
    setActiveContextView,
    setContextDrawerOpen
  } = params;
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceRootRef = useRef<HTMLElement | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    query: string;
    token: number;
  } | null>(null);
  const [activeReviewItemId, setActiveReviewItemId] = useState<string | null>(null);
  const focusQuery = focusRequest?.query ?? null;
  const workspaceWindowScrollKey =
    activeProjectId && selectedId
      ? `wbd:workspace-window-scroll:${activeProjectId}:${selectedId}`
      : null;
  const workspaceScrollSnapshotKey =
    activeProjectId && selectedId
      ? `workspace-scroll:${activeProjectId}:${selectedId}`
      : null;

  useEffect(() => {
    const state = location.state as {focusDocumentId?: string; focusQuery?: string} | null;
    const focusDocumentId = state?.focusDocumentId;
    if (!focusDocumentId) return;
    const target = documents.find((document) => document.id === focusDocumentId);
    if (!target) return;
    const query = state?.focusQuery?.trim();
    setFocusRequest(query ? {query, token: Date.now()} : null);
    if (selectedId !== target.id) {
      handleSelectDocument(target);
    }
    navigate(location.pathname, {replace: true, state: {}});
  }, [
    documents,
    handleSelectDocument,
    location.pathname,
    location.state,
    navigate,
    selectedId
  ]);

  const focusReviewItemInScene = useCallback((item: WorkspaceReviewFocusItem) => {
    const target = documents.find((document) => document.id === item.sceneId);
    if (target && selectedId !== target.id) {
      handleSelectDocument(target);
    }
    const query = item.issue.surface?.trim();
    if (query) {
      setFocusRequest({query, token: Date.now()});
    }
    setActiveReviewItemId(item.id);
    setActiveContextView('review');
    if (!isContextDrawerOpen) {
      setContextDrawerOpen(true);
    }
  }, [
    documents,
    handleSelectDocument,
    isContextDrawerOpen,
    selectedId,
    setActiveContextView,
    setContextDrawerOpen
  ]);

  useEffect(() => {
    if (editorScrollResetToken > 0) {
      setActiveReviewItemId(null);
    }
  }, [editorScrollResetToken]);

  useEffect(() => {
    if (!workspaceWindowScrollKey) return;

    let animationFrame: number | null = null;
    const saveScrollPosition = () => {
      workspaceWindowScrollPositions.set(workspaceWindowScrollKey, window.scrollY);
    };
    const handleScroll = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        saveScrollPosition();
      });
    };

    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      saveScrollPosition();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [workspaceWindowScrollKey]);

  useEffect(() => {
    if (!workspaceWindowScrollKey || focusQuery?.trim()) return;

    const storedScrollY = workspaceWindowScrollPositions.get(workspaceWindowScrollKey) ?? 0;
    if (!Number.isFinite(storedScrollY) || storedScrollY <= 0) return;

    const frameIds: number[] = [];
    const timeoutIds: number[] = [];
    const restoreScrollPosition = () => {
      frameIds.push(
        window.requestAnimationFrame(() => {
          window.scrollTo({top: storedScrollY, left: 0, behavior: 'auto'});
        })
      );
    };

    frameIds.push(window.requestAnimationFrame(restoreScrollPosition));
    [50, 150, 300].forEach((delay) => {
      timeoutIds.push(window.setTimeout(restoreScrollPosition, delay));
    });

    return () => {
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [focusQuery, workspaceWindowScrollKey]);

  const captureWorkspaceScroll = useCallback(() => {
    if (!workspaceScrollSnapshotKey) return;
    const root = workspaceRootRef.current;
    const elements = root
      ? Array.from(root.querySelectorAll<HTMLElement>('[data-wbd-scroll-key]'))
          .map((element) => ({
            key: element.dataset.wbdScrollKey ?? '',
            top: element.scrollTop,
            left: element.scrollLeft
          }))
          .filter((entry) => entry.key)
      : [];

    workspaceScrollSnapshots.set(workspaceScrollSnapshotKey, {
      windowY: window.scrollY,
      elements
    });
  }, [workspaceScrollSnapshotKey]);

  useEffect(() => {
    window.addEventListener('wbd:capture-workspace-scroll', captureWorkspaceScroll);
    return () => {
      captureWorkspaceScroll();
      window.removeEventListener('wbd:capture-workspace-scroll', captureWorkspaceScroll);
    };
  }, [captureWorkspaceScroll]);

  useLayoutEffect(() => {
    if (!workspaceScrollSnapshotKey || focusQuery?.trim()) return;
    const snapshot = workspaceScrollSnapshots.get(workspaceScrollSnapshotKey);
    if (!snapshot) return;

    const frameIds: number[] = [];
    const timeoutIds: number[] = [];
    const restore = () => {
      window.scrollTo({top: snapshot.windowY, left: 0, behavior: 'auto'});
      const root = workspaceRootRef.current;
      if (!root) return;
      snapshot.elements.forEach((entry) => {
        const element = root.querySelector<HTMLElement>(
          `[data-wbd-scroll-key="${entry.key}"]`
        );
        if (element) {
          element.scrollTop = entry.top;
          element.scrollLeft = entry.left;
          element.dataset.wbdRestoreTarget = String(entry.top);
          element.dataset.wbdRestoredScrollTop = String(element.scrollTop);
        }
      });
    };

    frameIds.push(window.requestAnimationFrame(restore));
    [50, 150, 300, 600].forEach((delay) => {
      timeoutIds.push(window.setTimeout(restore, delay));
    });

    return () => {
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [content, focusQuery, workspaceScrollSnapshotKey]);

  return {
    workspaceRootRef,
    focusRequest,
    focusQuery,
    activeReviewItemId,
    focusReviewItemInScene
  };
}
