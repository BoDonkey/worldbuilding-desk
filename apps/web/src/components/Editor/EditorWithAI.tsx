import type {SceneRevision} from '../../services/assistant/sceneRevision';
import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import type {LoreInspectorRecord} from './LoreInspectorPanel';
import {ContextPopover} from './ContextPopover';
import {AIExpandMenu} from './extensions/AIExpandMenu';
import {
  type ConsistencyHighlightIssue
} from './extensions/ConsistencyHighlightsExtension';
import {
  type LoreHighlightEntry
} from './extensions/LoreHighlightsExtension';
import {createWorkspaceAnnotationsExtension} from './extensions/WorkspaceAnnotationsExtension';
import {
  createCurrentSceneFindExtension,
  setCurrentSceneFind
} from './extensions/CurrentSceneFindExtension';
import {
  createReviewFocusFlashExtension,
  reviewFocusFlashKey,
  setReviewFocusFlash
} from './extensions/ReviewFocusFlashExtension';
import {TextSelection, type EditorState} from 'prosemirror-state';
import type {EditorConfig} from '../../config/editorConfig';
import type {StatBlockTokenPresentation} from '../../utils/statBlockTemplates';
import type {StatBlockPreviewData} from '../../hooks/useWorkspaceStatBlocks';
import type {InlineHighlightsMode} from '../../entityTypes';
import styles from '../../assets/components/AISettings.module.css';
import {
  captureStateMutationAnchor,
  normalizeStateMutationPosition,
  type EditorTextSnapshot,
  type StateMutationTextAnchor
} from '../../services/state/stateMutationAnchor';
import {getWorkspaceSceneScrollKey} from '../../services/workspace/workspaceScroll';
import type {CharacterSnapshot} from '../../services/state/characterSnapshot';
import {
  findCharacterPeekTargetForLore,
  findCharacterPeekTargetsAt,
  type CharacterPeekTarget,
  type CharacterStatCardTemplate
} from '../../services/state/characterPeek';
import {CharacterStatCard} from '../CharacterSheets/CharacterStatCard';
import {
  findCurrentSceneMatches,
  resolveCurrentSceneFindIndex,
  type CurrentSceneFindMatch
} from '../../services/workspace/currentSceneFind';

interface AIContextType {
  type: 'document';
  id: string;
  selectedText: string;
  from: number;
  to: number;
}

interface EditorWithAIProps {
  projectId: string;
  documentId: string;
  content: string;
  focusQuery?: string | null;
  focusToken?: number;
  resetScrollToken?: number;
  onChange: (content: string) => void;
  onWordCountChange?: (count: number) => void;
  onCursorContextChange?: (context: {
    position: number;
    snapshot: EditorTextSnapshot;
    anchor: StateMutationTextAnchor;
  }) => void;
  consistencyHighlights?: ConsistencyHighlightIssue[];
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: Array<{id: string; label: string; markName: string}>;
  toolbarActions?: Array<{id: string; label: string; onClick: () => void}>;
  textToInsert?: string | null;
  sceneRevision?: SceneRevision;
  insertContext?: {from: number; to: number} | null;
  onTextInserted?: () => void;
  selectionQuickSnippets?: {
    characters: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
    entities: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
  };
  knownLoreHighlights?: LoreHighlightEntry[];
  /** Stat peek (hover, shortcut, context menu); omitted when game systems are off. */
  characterStatPeek?: {
    targets: CharacterPeekTarget[];
    getSnapshot: (sheetId: string, editorPosition: number) => CharacterSnapshot | null;
    template?: CharacterStatCardTemplate;
    sceneTitle: string;
  };
  /** Opens the peek for a character at the cursor, e.g. from the command palette. */
  statPeekRequest?: {sheetId: string; token: number} | null;
  presentStatBlockToken?: (rawToken: string) => StatBlockTokenPresentation;
  getStatBlockPreviewData?: (rawToken: string) => StatBlockPreviewData;
  onRebindStatBlockToken?: (rawToken: string) => void;
  onOpenAIContext?: (context: AIContextType, prompt?: string | null) => void;
  onOpenLoreInspector?: (record: LoreInspectorRecord) => void;
  onOpenWorldCapture?: (
    draftText: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onAddSelectionToInventory?: (input: {
    itemName: string;
    from: number;
    to: number;
  }) => void;
  inlineHighlightsMode?: InlineHighlightsMode;
  suppressSelectionBubble?: boolean;
}

export const STAT_PEEK_SHORTCUT_LABEL = 'Cmd/Ctrl+Alt+S';

const isStatPeekShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) &&
  event.altKey &&
  !event.shiftKey &&
  event.code === 'KeyS' &&
  !event.getModifierState?.('AltGraph');

/** Characters named at an editor range, within the block that holds its start. */
const findStatPeekCandidates = (
  state: EditorState,
  targets: CharacterPeekTarget[],
  from: number,
  to: number
): CharacterPeekTarget[] => {
  const $from = state.doc.resolve(from);
  if (!$from.parent.isTextblock) return [];
  const start = $from.start();
  const size = $from.parent.content.size;
  // One placeholder character per inline leaf keeps text offsets equal to positions.
  const text = $from.parent.textBetween(0, size, undefined, '\ufffc');
  return findCharacterPeekTargetsAt({
    text,
    from: from - start,
    to: Math.min(to, start + size) - start,
    targets
  });
};

interface StatPeekState {
  source: 'hover' | 'keyboard';
  candidates: CharacterPeekTarget[];
  sheetId: string | null;
  editorPosition: number;
  left: number;
  top: number;
  anchorTop: number;
  anchorBottom: number;
}

interface StatPeekMenuState {
  x: number;
  y: number;
  candidates: CharacterPeekTarget[];
  editorPosition: number;
  anchorTop: number;
  anchorBottom: number;
  selection: {selectedText: string; from: number; to: number} | null;
}

interface SelectionBubbleState {
  selectedText: string;
  from: number;
  to: number;
  x: number;
  y: number;
  matchType: 'character' | 'entity' | null;
  matchName?: string;
  matchRecord?: {name: string; html: string; lore: LoreInspectorRecord};
}

declare global {
  interface Window {
    __wbdEditorScrollPositions?: Record<string, number>;
  }
}

const editorScrollPositions = new Map<string, number>();
const REVIEW_FOCUS_TOP_OFFSET = 120;

const getWindowEditorScrollStore = () => {
  if (typeof window === 'undefined') return null;
  window.__wbdEditorScrollPositions ??= {};
  return window.__wbdEditorScrollPositions;
};

const readSavedEditorScrollTop = (scrollKey: string) => {
  const store = getWindowEditorScrollStore();
  const candidates = [
    editorScrollPositions.get(scrollKey),
    store?.[scrollKey]
  ];

  return candidates.find(
    (candidate): candidate is number =>
      typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
  ) ?? 0;
};

const writeSavedEditorScrollTop = (scrollKey: string, scrollTop: number) => {
  if (!Number.isFinite(scrollTop)) return;
  editorScrollPositions.set(scrollKey, scrollTop);
  const store = getWindowEditorScrollStore();
  if (!store) return;
  store[scrollKey] = scrollTop;
};

const clearSavedEditorScrollTop = (scrollKey: string) => {
  editorScrollPositions.set(scrollKey, 0);
  const store = getWindowEditorScrollStore();
  if (store) {
    store[scrollKey] = 0;
  }
};

export const EditorWithAI: React.FC<EditorWithAIProps> = ({
  projectId,
  documentId,
  content,
  focusQuery = null,
  focusToken = 0,
  resetScrollToken = 0,
  onChange,
  onWordCountChange,
  onCursorContextChange,
  consistencyHighlights = [],
  onConsistencyHighlightClick,
  config,
  toolbarButtons = [],
  toolbarActions = [],
  textToInsert: externalTextToInsert = null,
  insertContext = null,
  sceneRevision,
  onTextInserted,
  selectionQuickSnippets,
  knownLoreHighlights = [],
  presentStatBlockToken,
  getStatBlockPreviewData,
  onRebindStatBlockToken,
  onOpenAIContext,
  onOpenLoreInspector,
  onOpenWorldCapture,
  onAddSelectionToInventory,
  characterStatPeek,
  statPeekRequest = null,
  inlineHighlightsMode = 'visible',
  suppressSelectionBubble = false
}) => {
  const [textToInsertFromAI, setTextToInsertFromAI] = useState<string | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState | null>(
    null
  );
  const [editorReadyToken, setEditorReadyToken] = useState(0);
  const [lorePopoverRecord, setLorePopoverRecord] = useState<LoreInspectorRecord | null>(null);
  const [lorePopoverAnchor, setLorePopoverAnchor] = useState<{left: number; top: number} | null>(
    null
  );
  const [statBlockPopover, setStatBlockPopover] = useState<{
    preview: StatBlockPreviewData;
    left: number;
    top: number;
  } | null>(null);
  const [statPeek, setStatPeek] = useState<StatPeekState | null>(null);
  const [statPeekMenu, setStatPeekMenu] = useState<StatPeekMenuState | null>(null);
  const statPeekMenuRef = useRef<HTMLDivElement | null>(null);
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const [isCurrentSceneFindOpen, setCurrentSceneFindOpen] = useState(false);
  const [currentSceneFindQuery, setCurrentSceneFindQuery] = useState('');
  const [currentSceneFindMatches, setCurrentSceneFindMatches] = useState<
    CurrentSceneFindMatch[]
  >([]);
  const [currentSceneFindIndex, setCurrentSceneFindIndex] = useState(-1);
  const editorRef = useRef<TipTapEditorInstance | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const currentSceneFindInputRef = useRef<HTMLInputElement | null>(null);
  const isRestoringEditorScrollRef = useRef(false);
  const editorMountedAtRef = useRef(Date.now());
  const consistencyHighlightsRef = useRef(consistencyHighlights);
  const loreHighlightsRef = useRef<LoreHighlightEntry[]>([]);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const editorScrollKey = getWorkspaceSceneScrollKey(
    'workspace-editor-scroll',
    projectId,
    documentId
  );
  const appliedScrollResetKeyRef = useRef<string | null>(null);

  const openCurrentSceneFind = useCallback(() => {
    setCurrentSceneFindOpen(true);
    window.requestAnimationFrame(() => {
      currentSceneFindInputRef.current?.focus();
      currentSceneFindInputRef.current?.select();
    });
  }, []);

  const closeCurrentSceneFind = useCallback(() => {
    setCurrentSceneFindOpen(false);
    setCurrentSceneFindQuery('');
    setCurrentSceneFindMatches([]);
    setCurrentSceneFindIndex(-1);
    window.requestAnimationFrame(() => {
      editorRef.current?.view.dom.focus({preventScroll: true});
    });
  }, []);

  const navigateCurrentSceneFind = useCallback(
    (direction: 'next' | 'previous') => {
      setCurrentSceneFindIndex((currentIndex) =>
        resolveCurrentSceneFindIndex(
          currentIndex,
          currentSceneFindMatches.length,
          direction
        )
      );
    },
    [currentSceneFindMatches.length]
  );

  const effectiveToolbarActions = React.useMemo(
    () => [
      ...toolbarActions,
      {
        id: 'find-current-scene',
        label: 'Find in scene',
        onClick: openCurrentSceneFind
      }
    ],
    [openCurrentSceneFind, toolbarActions]
  );

  const effectiveInlineHighlightsMode =
    inlineHighlightsMode === 'hidden-while-typing' && isActivelyTyping
      ? 'hidden'
      : inlineHighlightsMode;

  const loreHighlights = React.useMemo<LoreHighlightEntry[]>(() => {
    const deduped = new Map<string, LoreHighlightEntry>();
    // Selection snippets may come from legacy character capability records. Only
    // records confirmed by the World Bible belong in automatic lore markup.
    knownLoreHighlights.forEach((entry) => {
      const key = `${entry.type}:${entry.id}:${entry.surface.trim().toLowerCase()}`;
      if (entry.surface.trim()) {
        deduped.set(key, entry);
      }
    });
    return Array.from(deduped.values());
  }, [knownLoreHighlights]);

  useEffect(() => {
    consistencyHighlightsRef.current = consistencyHighlights;
    loreHighlightsRef.current = loreHighlights;
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta('highlight-refresh', Date.now()));
  }, [consistencyHighlights, loreHighlights]);

  const loreRecordById = React.useMemo(() => {
    const records = [
      ...Object.values(selectionQuickSnippets?.characters ?? {}),
      ...Object.values(selectionQuickSnippets?.entities ?? {})
    ];
    return new Map(records.map((entry) => [entry.lore.id, entry.lore]));
  }, [selectionQuickSnippets]);

  // Merge AIExpandMenu with config extensions
  const mergedConfig = React.useMemo(() => {
    if (!config) {
      return undefined;
    }
    return {
      ...config,
      extensions: [
        ...config.extensions,
        AIExpandMenu,
        createCurrentSceneFindExtension(),
        createReviewFocusFlashExtension(),
        createWorkspaceAnnotationsExtension(
          // ProseMirror invokes these getters after render when it evaluates
          // decorations; passing them here does not read either ref during render.
          // eslint-disable-next-line react-hooks/refs
          () => loreHighlightsRef.current,
          // eslint-disable-next-line react-hooks/refs
          () => consistencyHighlightsRef.current
        )
      ]
    };
  }, [config]);

  useEffect(() => {
    const handleAIRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selectedText: string;
        from: number;
        to: number;
      }>;

      onOpenAIContext?.({
        type: 'document',
        id: documentId,
        selectedText: customEvent.detail.selectedText,
        from: customEvent.detail.from,
        to: customEvent.detail.to
      });
    };

    window.addEventListener('ai-expand-request', handleAIRequest);
    return () => {
      window.removeEventListener('ai-expand-request', handleAIRequest);
    };
  }, [documentId, onOpenAIContext]);

  useEffect(() => {
    return () => {
      if (typingIdleTimeoutRef.current !== null) {
        window.clearTimeout(typingIdleTimeoutRef.current);
      }
      editorRef.current = null;
    };
  }, []);

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
  }, [editorScrollKey]);

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
    focusQuery,
    content,
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
  }, [documentId, editorReadyToken, editorScrollKey, resetScrollToken]);

  useEffect(() => {
    if (!selectionBubble) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectionBubble(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectionBubble]);

  useEffect(() => {
    if (!lorePopoverAnchor && !statBlockPopover && !statPeek && !statPeekMenu) return;
    const close = () => {
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
      setStatBlockPopover(null);
      setStatPeek(null);
      setStatPeekMenu(null);
    };
    const frameId = window.requestAnimationFrame(() => {
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [lorePopoverAnchor, statBlockPopover, statPeek, statPeekMenu]);

  useEffect(() => {
    const reposition = () => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed || !selectionBubble) return;
      const {from, to} = editor.state.selection;
      if (from === to) {
        setSelectionBubble(null);
        return;
      }
      const startCoords = editor.view.coordsAtPos(from);
      const endCoords = editor.view.coordsAtPos(to);
      setSelectionBubble((prev) =>
        prev
          ? {
              ...prev,
              x: (startCoords.left + endCoords.right) / 2,
              y: Math.max(16, Math.min(startCoords.top, endCoords.top) - 10)
            }
          : prev
      );
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [selectionBubble]);

  const normalizeSelectionSurface = useCallback(
    (input: string): string =>
      input
        .trim()
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    []
  );

  const updateSelectionBubble = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const {from, to} = editor.state.selection;
    const snapshot: EditorTextSnapshot = {text: '', spans: []};
    editor.state.doc.descendants((node, position) => {
      if (!node.isText || !node.text) return;
      const textStart = snapshot.text.length;
      snapshot.text += node.text;
      snapshot.spans.push({
        textStart,
        textEnd: snapshot.text.length,
        editorStart: position
      });
    });
    const position = normalizeStateMutationPosition(snapshot, from);
    onCursorContextChange?.({
      position,
      snapshot,
      anchor: captureStateMutationAnchor(snapshot, position)
    });
    if (suppressSelectionBubble) {
      setSelectionBubble(null);
      return;
    }
    if (from === to) {
      setSelectionBubble(null);
      return;
    }
    const selectedText = editor.state.doc.textBetween(from, to).trim();
    if (!selectedText) {
      setSelectionBubble(null);
      return;
    }
    const normalized = normalizeSelectionSurface(selectedText);
    const characterMatch = normalized
      ? selectionQuickSnippets?.characters[normalized]
      : undefined;
    const entityMatch = normalized ? selectionQuickSnippets?.entities[normalized] : undefined;
    const matchRecord = characterMatch ?? entityMatch;
    const startCoords = editor.view.coordsAtPos(from);
    const endCoords = editor.view.coordsAtPos(to);
    setSelectionBubble({
      selectedText,
      from,
      to,
      x: (startCoords.left + endCoords.right) / 2,
      y: Math.max(16, Math.min(startCoords.top, endCoords.top) - 10),
      matchType: characterMatch ? 'character' : entityMatch ? 'entity' : null,
      matchName: matchRecord?.name,
      matchRecord
    });
  }, [
    normalizeSelectionSurface,
    onCursorContextChange,
    selectionQuickSnippets,
    suppressSelectionBubble
  ]);

  useEffect(() => {
    if (suppressSelectionBubble) {
      setSelectionBubble(null);
    }
  }, [suppressSelectionBubble]);

  const handleEditorReady = useCallback((editorInstance: TipTapEditorInstance) => {
    editorRef.current = editorInstance;
    setEditorReadyToken((prev) => prev + 1);
    updateSelectionBubble();
  }, [updateSelectionBubble]);

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        openCurrentSceneFind();
        return;
      }
      if (event.key === 'Escape' && isCurrentSceneFindOpen) {
        event.preventDefault();
        closeCurrentSceneFind();
      }
    };
    window.addEventListener('keydown', handleFindShortcut);
    return () => window.removeEventListener('keydown', handleFindShortcut);
  }, [closeCurrentSceneFind, isCurrentSceneFindOpen, openCurrentSceneFind]);

  useEffect(() => {
    setCurrentSceneFindOpen(false);
    setCurrentSceneFindQuery('');
    setCurrentSceneFindMatches([]);
    setCurrentSceneFindIndex(-1);
  }, [documentId, onOpenAIContext]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isCurrentSceneFindOpen || !currentSceneFindQuery.trim()) {
      setCurrentSceneFindMatches([]);
      setCurrentSceneFindIndex(-1);
      return;
    }

    const segments: Array<{text: string; position: number}> = [];
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text) {
        segments.push({text: node.text, position});
      }
    });
    const matches = findCurrentSceneMatches(segments, currentSceneFindQuery);
    setCurrentSceneFindMatches(matches);
    setCurrentSceneFindIndex((currentIndex) => {
      if (!matches.length) return -1;
      return currentIndex >= 0 && currentIndex < matches.length ? currentIndex : 0;
    });
  }, [content, currentSceneFindQuery, editorReadyToken, isCurrentSceneFindOpen]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    if (!isCurrentSceneFindOpen || !currentSceneFindMatches.length) {
      editor.view.dispatch(setCurrentSceneFind(editor.state.tr, null));
      return;
    }

    const activeMatch = currentSceneFindMatches[currentSceneFindIndex];
    let transaction = setCurrentSceneFind(editor.state.tr, {
      matches: currentSceneFindMatches,
      activeIndex: currentSceneFindIndex
    });
    if (activeMatch) {
      transaction = transaction
        .setSelection(
          TextSelection.create(editor.state.doc, activeMatch.from, activeMatch.to)
        )
        .scrollIntoView();
    }
    editor.view.dispatch(transaction);

    if (!activeMatch) return;
    window.requestAnimationFrame(() => {
      const scrollElement = editorScrollRef.current;
      if (scrollElement) {
        const editorRect = scrollElement.getBoundingClientRect();
        const matchRect = editor.view.coordsAtPos(activeMatch.from);
        const desiredTop = editorRect.top + REVIEW_FOCUS_TOP_OFFSET;
        if (matchRect.top < desiredTop) {
          const nextScrollTop = Math.max(
            0,
            scrollElement.scrollTop - (desiredTop - matchRect.top)
          );
          scrollElement.scrollTop = nextScrollTop;
          writeSavedEditorScrollTop(editorScrollKey, nextScrollTop);
        }
      }
      currentSceneFindInputRef.current?.focus();
    });
  }, [
    currentSceneFindIndex,
    currentSceneFindMatches,
    editorReadyToken,
    editorScrollKey,
    isCurrentSceneFindOpen
  ]);

  const handleLoreHighlightClick = useCallback(
    (loreId: string, anchorRect: {left: number; top: number; bottom: number}) => {
      setStatPeek((current) => (current?.source === 'hover' ? null : current));
      const record = loreRecordById.get(loreId);
      if (!record) {
        return;
      }
      setLorePopoverRecord(record);
      setLorePopoverAnchor({
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    [loreRecordById]
  );

  const handleLoreHighlightHover = useCallback(
    (
      loreId: string,
      editorPosition: number,
      anchorRect: {left: number; top: number; bottom: number}
    ) => {
      const target = characterStatPeek
        ? findCharacterPeekTargetForLore(characterStatPeek.targets, loreId)
        : null;
      const hasSnapshot = Boolean(
        target && characterStatPeek?.getSnapshot(target.sheetId, editorPosition)
      );
      setStatPeek((current) => {
        // A peek opened on purpose stays until the author closes it.
        if (current?.source === 'keyboard') return current;
        if (!target || !hasSnapshot) return null;
        return {
          source: 'hover',
          candidates: [target],
          sheetId: target.sheetId,
          editorPosition,
          left: anchorRect.left,
          top: anchorRect.bottom + 8,
          anchorTop: anchorRect.top,
          anchorBottom: anchorRect.bottom
        };
      });
      if (!target || !hasSnapshot) return;
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
      setStatBlockPopover(null);
    },
    [characterStatPeek]
  );

  const handleLoreHighlightLeave = useCallback(() => {
    setStatPeek((current) => (current?.source === 'hover' ? null : current));
  }, []);

  const openStatPeek = useCallback(
    (params: {
      candidates: CharacterPeekTarget[];
      editorPosition: number;
      anchorTop?: number;
      anchorBottom?: number;
      left?: number;
    }) => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) return;
      const coords = editor.view.coordsAtPos(params.editorPosition);
      const anchorTop = params.anchorTop ?? coords.top;
      const anchorBottom = params.anchorBottom ?? coords.bottom;
      setSelectionBubble(null);
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
      setStatBlockPopover(null);
      setStatPeekMenu(null);
      setStatPeek({
        source: 'keyboard',
        candidates: params.candidates,
        sheetId: params.candidates.length === 1 ? params.candidates[0].sheetId : null,
        editorPosition: params.editorPosition,
        left: params.left ?? coords.left,
        top: anchorBottom + 8,
        anchorTop,
        anchorBottom
      });
    },
    []
  );

  const openStatPeekAtSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed || !characterStatPeek) return;
    const {from, to} = editor.state.selection;
    openStatPeek({
      candidates: findStatPeekCandidates(editor.state, characterStatPeek.targets, from, to),
      editorPosition: from
    });
  }, [characterStatPeek, openStatPeek]);

  const closeStatPeek = useCallback(() => {
    setStatPeek((current) => {
      if (current?.source === 'keyboard') {
        window.requestAnimationFrame(() => {
          const editor = editorRef.current;
          if (editor && !editor.isDestroyed) editor.view.focus();
        });
      }
      return null;
    });
  }, []);

  const statPeekSnapshot = React.useMemo(
    () =>
      statPeek?.sheetId && characterStatPeek
        ? characterStatPeek.getSnapshot(statPeek.sheetId, statPeek.editorPosition)
        : null,
    [characterStatPeek, statPeek]
  );

  useEffect(() => {
    if (!characterStatPeek) {
      setStatPeek(null);
      setStatPeekMenu(null);
    }
  }, [characterStatPeek]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !characterStatPeek) return;
    const dom = editor.view.dom;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStatPeekShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      openStatPeekAtSelection();
    };
    dom.addEventListener('keydown', onKeyDown, true);
    return () => dom.removeEventListener('keydown', onKeyDown, true);
  }, [characterStatPeek, editorReadyToken, openStatPeekAtSelection]);

  useEffect(() => {
    const container = editorScrollRef.current;
    const editor = editorRef.current;
    if (!container || !editor || !characterStatPeek) return;
    // Capture phase, so a character name gets this menu before the editor's own
    // right-click handling (AI Expand on a selection), which the menu keeps.
    const onContextMenu = (event: MouseEvent) => {
      if (editor.isDestroyed || !(event.target instanceof Node)) return;
      if (!editor.view.dom.contains(event.target)) return;
      const hit = editor.view.posAtCoords({left: event.clientX, top: event.clientY});
      if (!hit) return;
      const {from, to} = editor.state.selection;
      const inSelection = from !== to && hit.pos >= from && hit.pos <= to;
      const range = inSelection ? {from, to} : {from: hit.pos, to: hit.pos};
      const candidates = findStatPeekCandidates(
        editor.state,
        characterStatPeek.targets,
        range.from,
        range.to
      );
      if (candidates.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const selectedText = from !== to ? editor.state.doc.textBetween(from, to) : '';
      setSelectionBubble(null);
      setStatPeek(null);
      setStatPeekMenu({
        x: event.clientX,
        y: event.clientY,
        candidates,
        editorPosition: range.from,
        anchorTop: event.clientY - 8,
        anchorBottom: event.clientY + 8,
        selection: selectedText.trim() ? {selectedText, from, to} : null
      });
    };
    container.addEventListener('contextmenu', onContextMenu, true);
    return () => container.removeEventListener('contextmenu', onContextMenu, true);
  }, [characterStatPeek, editorReadyToken]);

  useEffect(() => {
    if (!statPeekMenu) return;
    statPeekMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({
      preventScroll: true
    });
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && statPeekMenuRef.current?.contains(event.target)) {
        return;
      }
      setStatPeekMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setStatPeekMenu(null);
      editorRef.current?.view.focus();
    };
    window.addEventListener('pointerdown', closeOnOutside, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [statPeekMenu]);

  const lastStatPeekRequestTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!statPeekRequest || !characterStatPeek) return;
    if (lastStatPeekRequestTokenRef.current === statPeekRequest.token) return;
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const target = characterStatPeek.targets.find(
      (candidate) => candidate.sheetId === statPeekRequest.sheetId
    );
    if (!target) return;
    lastStatPeekRequestTokenRef.current = statPeekRequest.token;
    openStatPeek({candidates: [target], editorPosition: editor.state.selection.from});
  }, [characterStatPeek, editorReadyToken, openStatPeek, statPeekRequest]);

  const handleStatBlockTokenClick = useCallback(
    (rawToken: string, anchorRect: {left: number; top: number; bottom: number}) => {
      const preview = getStatBlockPreviewData?.(rawToken);
      if (!preview) {
        onRebindStatBlockToken?.(rawToken);
        return;
      }
      setStatBlockPopover({
        preview,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    [getStatBlockPreviewData, onRebindStatBlockToken]
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.on('selectionUpdate', updateSelectionBubble);
    editor.on('transaction', updateSelectionBubble);
    return () => {
      editor.off('selectionUpdate', updateSelectionBubble);
      editor.off('transaction', updateSelectionBubble);
    };
  }, [editorReadyToken, updateSelectionBubble]);

  useEffect(() => {
    const query = focusQuery?.trim();
    const editor = editorRef.current;
    if (!editor || !query) return;

    const loweredQuery = query.toLowerCase();
    let matchFrom = -1;
    let matchTo = -1;

    editor.state.doc.descendants((node, pos) => {
      if (matchFrom >= 0 || !node.isText || !node.text) {
        return;
      }
      const index = node.text.toLowerCase().indexOf(loweredQuery);
      if (index < 0) {
        return;
      }
      matchFrom = pos + index;
      matchTo = pos + index + query.length;
    });

    if (matchFrom < 0 || matchTo <= matchFrom) return;

    editor.commands.focus();
    const flashToken = focusToken || Date.now();
    editor.view.dispatch(
      setReviewFocusFlash(editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, matchFrom, matchTo)
      ), {
        from: matchFrom,
        to: matchTo,
        token: flashToken
      }).scrollIntoView()
    );
    window.requestAnimationFrame(() => {
      const scrollElement = editorScrollRef.current;
      if (!scrollElement) return;
      const editorRect = scrollElement.getBoundingClientRect();
      const focusRect = editor.view.coordsAtPos(matchFrom);
      const desiredTop = editorRect.top + REVIEW_FOCUS_TOP_OFFSET;
      if (focusRect.top < desiredTop) {
        const nextScrollTop = Math.max(0, scrollElement.scrollTop - (desiredTop - focusRect.top));
        scrollElement.scrollTop = nextScrollTop;
        writeSavedEditorScrollTop(editorScrollKey, nextScrollTop);
      }

      const flashSelector = `[data-review-focus-token="${flashToken}"]`;
      if (!editor.view.dom.querySelector(flashSelector)) {
        const domAtMatch = editor.view.domAtPos(matchFrom);
        const fallbackElement =
          domAtMatch.node.nodeType === Node.TEXT_NODE
            ? domAtMatch.node.parentElement
            : domAtMatch.node instanceof HTMLElement
              ? domAtMatch.node
              : null;
        fallbackElement?.classList.add('review-focus-flash');
        fallbackElement?.setAttribute(
          'data-review-focus-fallback-token',
          String(flashToken)
        );
      }
    });
    const clearFallbackFlash = () => {
      editor.view.dom
        .querySelectorAll(`[data-review-focus-fallback-token="${flashToken}"]`)
        .forEach((element) => {
          element.classList.remove('review-focus-flash');
          element.removeAttribute('data-review-focus-fallback-token');
        });
    };
    const clearToken = window.setTimeout(() => {
      const current = reviewFocusFlashKey.getState(editor.state);
      if (current?.token === flashToken) {
        editor.view.dispatch(setReviewFocusFlash(editor.state.tr, null));
      }
      clearFallbackFlash();
    }, 1800);
    return () => {
      window.clearTimeout(clearToken);
      clearFallbackFlash();
    };
  }, [documentId, editorReadyToken, editorScrollKey, focusQuery, focusToken]);

  const handleTypingActivity = useCallback(() => {
    if (inlineHighlightsMode !== 'hidden-while-typing') {
      return;
    }
    setIsActivelyTyping(true);
    if (typingIdleTimeoutRef.current !== null) {
      window.clearTimeout(typingIdleTimeoutRef.current);
    }
    typingIdleTimeoutRef.current = window.setTimeout(() => {
      setIsActivelyTyping(false);
      typingIdleTimeoutRef.current = null;
    }, 3000);
  }, [inlineHighlightsMode]);

  useEffect(() => {
    if (inlineHighlightsMode === 'hidden-while-typing') {
      return;
    }
    setIsActivelyTyping(false);
    if (typingIdleTimeoutRef.current !== null) {
      window.clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }
  }, [inlineHighlightsMode]);

  return (
    <div className={styles.container}>
      {isCurrentSceneFindOpen && (
        <div className={styles.currentSceneFindBar} role='search' aria-label='Find in current scene'>
          <label className={styles.currentSceneFindField}>
            <span>Find in scene</span>
            <input
              ref={currentSceneFindInputRef}
              type='search'
              value={currentSceneFindQuery}
              onChange={(event) => {
                setCurrentSceneFindQuery(event.target.value);
                setCurrentSceneFindIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                navigateCurrentSceneFind(event.shiftKey ? 'previous' : 'next');
              }}
              aria-describedby='current-scene-find-status'
            />
          </label>
          <span
            id='current-scene-find-status'
            className={styles.currentSceneFindStatus}
            role='status'
            aria-live='polite'
          >
            {!currentSceneFindQuery.trim()
              ? 'Type to find'
              : currentSceneFindMatches.length === 0
                ? 'No matches'
                : `${currentSceneFindIndex + 1} of ${currentSceneFindMatches.length}`}
          </span>
          <div className={styles.currentSceneFindActions}>
            <button
              type='button'
              onClick={() => navigateCurrentSceneFind('previous')}
              disabled={!currentSceneFindMatches.length}
              aria-label='Previous match in scene'
            >
              Previous
            </button>
            <button
              type='button'
              onClick={() => navigateCurrentSceneFind('next')}
              disabled={!currentSceneFindMatches.length}
              aria-label='Next match in scene'
            >
              Next
            </button>
            <button
              type='button'
              onClick={closeCurrentSceneFind}
              aria-label='Close find in scene'
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div
        className={styles.editor}
        ref={editorScrollRef}
        data-wbd-scroll-key='workspace-editor'
      >
        <TipTapEditor
          key={documentId}
          content={content}
          onChange={onChange}
          onWordCountChange={onWordCountChange}
          onConsistencyHighlightClick={onConsistencyHighlightClick}
          onLoreHighlightClick={handleLoreHighlightClick}
          onLoreHighlightHover={handleLoreHighlightHover}
          onLoreHighlightLeave={handleLoreHighlightLeave}
          onStatBlockTokenClick={handleStatBlockTokenClick}
          onEditorReady={handleEditorReady}
          onTypingActivity={handleTypingActivity}
          inlineHighlightsMode={effectiveInlineHighlightsMode}
          config={mergedConfig}
          toolbarButtons={toolbarButtons}
          toolbarActions={effectiveToolbarActions}
          textToInsert={externalTextToInsert ?? textToInsertFromAI}
          onTextInserted={() => {
            if (externalTextToInsert) {
              onTextInserted?.();
              return;
            }
            setTextToInsertFromAI(null);
          }}
          insertContext={insertContext}
          sceneRevision={sceneRevision}
          revisionProjectId={projectId}
          revisionDocumentId={documentId}
          presentStatBlockToken={presentStatBlockToken}
        />
        {selectionBubble && (
          <div
            className={styles.selectionBubble}
            style={{
              left: `${selectionBubble.x}px`,
              top: `${selectionBubble.y}px`
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <button
              type='button'
              onClick={() => {
                onOpenAIContext?.({
                  type: 'document',
                  id: documentId,
                  selectedText: selectionBubble.selectedText,
                  from: selectionBubble.from,
                  to: selectionBubble.to
                });
              }}
            >
              AI Expand
            </button>
            {selectionBubble.matchType === 'character' && (
              <button
                type='button'
                onClick={() => {
                  if (!selectionBubble.matchRecord) return;
                  setStatBlockPopover({
                    preview: {
                      rawToken: selectionBubble.matchName ?? selectionBubble.selectedText,
                      title: `${selectionBubble.matchRecord.name} · Quick Preview`,
                      sourceType: 'character',
                      style: 'compact',
                      status: 'resolved',
                      message: 'Quick character snapshot from the current workspace state.',
                      html: selectionBubble.matchRecord.html,
                      requiresRebind: false
                    },
                    left: selectionBubble.x,
                    top: selectionBubble.y + 12
                  });
                }}
              >
                Preview Stats
              </button>
            )}
            {selectionBubble.matchType === 'character' && (
              <button
                type='button'
                onClick={() => {
                  const key = normalizeSelectionSurface(selectionBubble.selectedText);
                  const snippet = key ? selectionQuickSnippets?.characters[key]?.html : null;
                  if (!snippet || !editorRef.current) return;
                  editorRef.current.commands.setTextSelection({
                    from: selectionBubble.from,
                    to: selectionBubble.to
                  });
                  editorRef.current.commands.insertContent(snippet);
                  setSelectionBubble(null);
                }}
              >
                Insert Stat Snapshot
              </button>
            )}
            {selectionBubble.matchType === 'entity' && (
              <button
                type='button'
                onClick={() => {
                  const key = normalizeSelectionSurface(selectionBubble.selectedText);
                  const snippet = key ? selectionQuickSnippets?.entities[key]?.html : null;
                  if (!snippet || !editorRef.current) return;
                  editorRef.current.commands.setTextSelection({
                    from: selectionBubble.from,
                    to: selectionBubble.to
                  });
                  editorRef.current.commands.insertContent(snippet);
                  setSelectionBubble(null);
                }}
              >
                Insert Lore Snippet
              </button>
            )}
            {selectionBubble.matchRecord && (
              <button
                type='button'
                onClick={() => {
                  setLorePopoverRecord(selectionBubble.matchRecord?.lore ?? null);
                  setLorePopoverAnchor({
                    left: selectionBubble.x,
                    top: selectionBubble.y + 12
                  });
                }}
              >
                Quick Lore
              </button>
            )}
            {selectionBubble.matchRecord && (
              <button
                type='button'
                onClick={() => {
                  if (!selectionBubble.matchRecord?.lore) return;
                  onOpenLoreInspector?.(selectionBubble.matchRecord.lore);
                }}
              >
                Open Lore
              </button>
            )}
            {!selectionBubble.matchRecord && (
              <button
                type='button'
                onClick={() => {
                  onOpenWorldCapture?.(selectionBubble.selectedText, {
                    left: selectionBubble.x,
                    top: selectionBubble.y,
                    bottom: selectionBubble.y + 12
                  });
                  setSelectionBubble(null);
                }}
              >
                Add to World
              </button>
            )}
            {onAddSelectionToInventory && (
              <button
                type='button'
                onClick={() => {
                  onAddSelectionToInventory({
                    itemName: selectionBubble.selectedText,
                    from: selectionBubble.from,
                    to: selectionBubble.to
                  });
                  setSelectionBubble(null);
                }}
              >
                Record item/state
              </button>
            )}
            {selectionBubble.matchName && (
              <span className={styles.selectionHint}>{selectionBubble.matchName}</span>
            )}
          </div>
        )}
        {lorePopoverRecord && lorePopoverAnchor && (
          <ContextPopover
            title={lorePopoverRecord.name}
            message={lorePopoverRecord.type === 'character' ? 'Character lore peek' : 'World lore peek'}
            left={lorePopoverAnchor.left}
            top={lorePopoverAnchor.top}
            onClose={() => {
              setLorePopoverAnchor(null);
              setLorePopoverRecord(null);
            }}
          >
            <div className={styles.lorePeekVitals}>
              {lorePopoverRecord.vitalSigns.map((item) => (
                <span key={item} className={styles.loreVitalChip}>
                  {item}
                </span>
              ))}
            </div>
            <div className={styles.lorePeekList}>
              <div>
                <strong>Goal:</strong> {lorePopoverRecord.synopsis.goal}
              </div>
              <div>
                <strong>Recent Event:</strong> {lorePopoverRecord.synopsis.recentEvent}
              </div>
              <div>
                <strong>Motivation:</strong> {lorePopoverRecord.synopsis.motivation}
              </div>
            </div>
            <div className={styles.systemActions}>
              <button
                type='button'
                onClick={() => {
                  onOpenLoreInspector?.(lorePopoverRecord);
                  setLorePopoverAnchor(null);
                  setLorePopoverRecord(null);
                }}
              >
                Open Lore Inspector
              </button>
            </div>
          </ContextPopover>
        )}
        {statBlockPopover && (
          <ContextPopover
            title={statBlockPopover.preview.title}
            message={statBlockPopover.preview.message}
            left={statBlockPopover.left}
            top={statBlockPopover.top}
            onClose={() => setStatBlockPopover(null)}
          >
            <div className={styles.statBlockPopoverMeta}>
              <span
                className={`${styles.statBlockStatusChip} ${
                  statBlockPopover.preview.status === 'resolved'
                    ? styles.statBlockStatusResolved
                    : statBlockPopover.preview.status === 'ambiguous'
                      ? styles.statBlockStatusAmbiguous
                      : styles.statBlockStatusMissing
                }`}
              >
                {statBlockPopover.preview.status === 'resolved'
                  ? 'Linked'
                  : statBlockPopover.preview.status === 'ambiguous'
                    ? 'Needs rebind'
                    : 'Missing source'}
              </span>
              <span className={styles.statBlockKindLabel}>
                {statBlockPopover.preview.sourceType === 'character'
                  ? 'Character'
                  : 'Entity'}
              </span>
            </div>
            {statBlockPopover.preview.html && (
              <div
                className={styles.statBlockPreviewCard}
                dangerouslySetInnerHTML={{__html: statBlockPopover.preview.html}}
              />
            )}
            {statBlockPopover.preview.requiresRebind && (
              <div className={styles.systemActions}>
                <button
                  type='button'
                  onClick={() => {
                    onRebindStatBlockToken?.(statBlockPopover.preview.rawToken);
                    setStatBlockPopover(null);
                  }}
                >
                  Rebind Token
                </button>
              </div>
            )}
          </ContextPopover>
        )}
        {statPeekMenu && (
          <div
            ref={statPeekMenuRef}
            className={styles.selectionBubble}
            style={{left: `${statPeekMenu.x}px`, top: `${statPeekMenu.y}px`}}
            role='menu'
            aria-label='Character actions'
            onMouseDown={(event) => event.preventDefault()}
          >
            <button
              type='button'
              role='menuitem'
              onClick={() =>
                openStatPeek({
                  candidates: statPeekMenu.candidates,
                  editorPosition: statPeekMenu.editorPosition,
                  left: statPeekMenu.x,
                  anchorTop: statPeekMenu.anchorTop,
                  anchorBottom: statPeekMenu.anchorBottom
                })
              }
            >
              Show stats
            </button>
            {statPeekMenu.selection && (
              <button
                type='button'
                role='menuitem'
                onClick={() => {
                  const selection = statPeekMenu.selection;
                  setStatPeekMenu(null);
                  if (!selection) return;
                  onOpenAIContext?.({type: 'document', id: documentId, ...selection});
                }}
              >
                AI Expand
              </button>
            )}
            <span className={styles.selectionHint}>{STAT_PEEK_SHORTCUT_LABEL}</span>
          </div>
        )}
        {statPeek && (
          <ContextPopover
            title={
              statPeek.sheetId
                ? 'Character stats'
                : statPeek.candidates.length > 1
                  ? 'Which character?'
                  : 'Character stats'
            }
            left={statPeek.left}
            top={statPeek.top}
            anchorTop={statPeek.anchorTop}
            anchorBottom={statPeek.anchorBottom}
            tone='neutral'
            focusOnOpen={statPeek.source === 'keyboard'}
            onClose={closeStatPeek}
          >
            {statPeek.sheetId && statPeekSnapshot ? (
              <CharacterStatCard
                snapshot={statPeekSnapshot}
                asOfLabel={
                  statPeek.source === 'hover'
                    ? 'At this mention'
                    : `At the cursor in ${characterStatPeek?.sceneTitle ?? 'this scene'}`
                }
                template={characterStatPeek?.template}
              />
            ) : statPeek.candidates.length > 1 ? (
              <div className={styles.systemActions} role='group' aria-label='Matching characters'>
                {statPeek.candidates.map((candidate) => (
                  <button
                    key={candidate.sheetId}
                    type='button'
                    onClick={() =>
                      setStatPeek((current) =>
                        current ? {...current, sheetId: candidate.sheetId} : current
                      )
                    }
                  >
                    {candidate.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.lorePeekList}>
                {statPeek.sheetId
                  ? 'Stats are not available for this scene.'
                  : 'No character name at the cursor. Use Show stats for… in the command palette to pick one.'}
              </div>
            )}
          </ContextPopover>
        )}
      </div>
    </div>
  );
};
