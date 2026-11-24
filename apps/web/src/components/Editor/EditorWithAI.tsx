import type {SceneRevision} from '../../services/assistant/sceneRevision';
import type {SceneContentReplacement} from '../../services/editor/sceneSnapshots';
import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import type {LoreInspectorRecord} from '../../services/workspace/workspaceConsultation';
import {
  type ConsistencyHighlightIssue
} from './extensions/ConsistencyHighlightsExtension';
import {
  type LoreHighlightEntry
} from './extensions/LoreHighlightsExtension';
import {createWorkspaceAnnotationsExtension} from './extensions/WorkspaceAnnotationsExtension';
import {createCurrentSceneFindExtension} from './extensions/CurrentSceneFindExtension';
import {createReviewFocusFlashExtension} from './extensions/ReviewFocusFlashExtension';
import {
  createAIContextPassageExtension,
  setAIContextPassage,
  type AIContextPassageRange
} from './extensions/AIContextPassageExtension';
import {useEditorSelectionMenu} from '../../hooks/useEditorSelectionMenu';
import type {EditorConfig} from '../../config/editorConfig';
import type {StatBlockTokenPresentation} from '../../utils/statBlockTemplates';
import type {StatBlockPreviewData} from '../../hooks/useWorkspaceStatBlocks';
import type {InlineHighlightsMode} from '../../entityTypes';
import {useAccessibility} from '../../contexts/AccessibilityContext';
import {useTypewriterScrolling} from '../../hooks/useTypewriterScrolling';
import styles from '../../assets/components/Editor.module.css';
import type {EditorSelectionActions} from './SelectionMenuAIEntries';
import {
  captureStateMutationAnchor,
  normalizeStateMutationPosition,
  type EditorTextSnapshot,
  type StateMutationTextAnchor
} from '../../services/state/stateMutationAnchor';
import {getWorkspaceSceneScrollKey} from '../../services/workspace/workspaceScroll';
import {useEditorStatPeek, type EditorCharacterStatPeek} from '../../hooks/useEditorStatPeek';
import {EditorStatPeekLayer} from './EditorStatPeekLayer';
import type {AITextProvenance} from '../../services/editor/aiTextProvenance';
import {useAITextControls} from '../../hooks/useAITextControls';
import {useEditorScrollMemory} from '../../hooks/useEditorScrollMemory';
import {useCurrentSceneFind} from '../../hooks/useCurrentSceneFind';
import {useEditorReviewFocus} from '../../hooks/useEditorReviewFocus';
import {useEditorContextPopovers} from '../../hooks/useEditorContextPopovers';
import {CurrentSceneFindBar} from './CurrentSceneFindBar';
import {EditorSelectionMenu, type EditorAIContext} from './EditorSelectionMenu';
import {EditorContextPopovers} from './EditorContextPopovers';

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
  /** Restore of a scene snapshot (slice 4.95). */
  contentReplacement?: SceneContentReplacement | null;
  insertContext?: {from: number; to: number} | null;
  /** Present when a model wrote `textToInsert`; the insert is then marked as AI text. */
  insertProvenance?: AITextProvenance;
  onTextInserted?: () => void;
  selectionQuickSnippets?: {
    characters: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
    entities: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
  };
  knownLoreHighlights?: LoreHighlightEntry[];
  /** Stat peek (hover, shortcut, context menu); omitted when game systems are off. */
  characterStatPeek?: EditorCharacterStatPeek;
  /** Opens the peek for a character at the cursor, e.g. from the command palette. */
  statPeekRequest?: {sheetId: string; token: number} | null;
  presentStatBlockToken?: (rawToken: string) => StatBlockTokenPresentation;
  getStatBlockPreviewData?: (rawToken: string) => StatBlockPreviewData;
  onRebindStatBlockToken?: (rawToken: string) => void;
  onOpenAIContext?: (context: EditorAIContext, prompt?: string | null) => void;
  /** Custom AI actions listed after Ask AI about this (5.19); unset when none are on. */
  selectionActions?: EditorSelectionActions;
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
  /** The passage the assistant is using as context; marked until cleared. */
  aiContextPassage?: AIContextPassageRange | null;
}

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
  insertProvenance,
  sceneRevision,
  contentReplacement = null,
  onTextInserted,
  selectionQuickSnippets,
  knownLoreHighlights = [],
  presentStatBlockToken,
  getStatBlockPreviewData,
  onRebindStatBlockToken,
  onOpenAIContext,
  selectionActions,
  onOpenLoreInspector,
  onOpenWorldCapture,
  onAddSelectionToInventory,
  characterStatPeek,
  statPeekRequest = null,
  inlineHighlightsMode = 'visible',
  suppressSelectionBubble = false,
  aiContextPassage = null
}) => {
  const [editorReadyToken, setEditorReadyToken] = useState(0);
  const [readyEditor, setReadyEditor] = useState<TipTapEditorInstance | null>(null);
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const editorRef = useRef<TipTapEditorInstance | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const consistencyHighlightsRef = useRef(consistencyHighlights);
  const loreHighlightsRef = useRef<LoreHighlightEntry[]>([]);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const editorScrollKey = getWorkspaceSceneScrollKey(
    'workspace-editor-scroll',
    projectId,
    documentId
  );

  const {
    selectionMenu: selectionBubble,
    selectionMenuRef,
    setSelectionMenu: setSelectionBubble,
    closeSelectionMenu: closeSelectionBubble,
    syncSelectionMenu
  } = useEditorSelectionMenu({
    editorRef,
    editorReadyToken,
    suppressed: suppressSelectionBubble,
    quickSnippets: selectionQuickSnippets
  });
  const popovers = useEditorContextPopovers({
    quickSnippets: selectionQuickSnippets,
    getStatBlockPreviewData,
    onRebindStatBlockToken
  });
  const {
    closeContextPopovers,
    loreAnchor: lorePopoverAnchor,
    statBlockPopover,
    openLoreHighlight,
    handleStatBlockTokenClick
  } = popovers;
  const statPeekControls = useEditorStatPeek({
    editorRef,
    editorScrollRef,
    editorReadyToken,
    characterStatPeek,
    statPeekRequest,
    closeSelectionBubble,
    closeOtherPopovers: closeContextPopovers
  });
  const {statPeek, setStatPeek, statPeekMenu, setStatPeekMenu, handleLoreHighlightHover, handleLoreHighlightLeave} =
    statPeekControls;

  const aiTextControls = useAITextControls(readyEditor);
  const {editorTypewriter} = useAccessibility();
  useTypewriterScrolling({enabled: editorTypewriter === 'on', editorRef, editorScrollRef, editorReadyToken});

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

  // Add the workspace editor extensions to the config.
  const mergedConfig = React.useMemo(() => {
    if (!config) {
      return undefined;
    }
    return {
      ...config,
      extensions: [
        ...config.extensions,
        createCurrentSceneFindExtension(),
        createReviewFocusFlashExtension(),
        createAIContextPassageExtension(),
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

  const aiContextFrom = aiContextPassage?.from ?? null;
  const aiContextTo = aiContextPassage?.to ?? null;
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const range =
      aiContextFrom !== null && aiContextTo !== null && aiContextFrom < aiContextTo
        ? {from: aiContextFrom, to: aiContextTo}
        : null;
    editor.view.dispatch(setAIContextPassage(editor.state.tr, range));
  }, [aiContextFrom, aiContextTo, documentId, editorReadyToken]);

  useEffect(() => {
    return () => {
      if (typingIdleTimeoutRef.current !== null) {
        window.clearTimeout(typingIdleTimeoutRef.current);
      }
      editorRef.current = null;
    };
  }, []);

  useEditorScrollMemory({
    editorScrollRef,
    editorScrollKey,
    editorReadyToken,
    documentId,
    focusQuery,
    // Restore once a scene's text has loaded, never on edits (5.17).
    hasContent: content.length > 0,
    resetScrollToken
  });

  // Scrolling or resizing closes every floating layer: both popovers and the stat peek.
  useEffect(() => {
    if (!lorePopoverAnchor && !statBlockPopover && !statPeek && !statPeekMenu) return;
    const close = () => {
      closeContextPopovers();
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
  }, [closeContextPopovers, lorePopoverAnchor, setStatPeek, setStatPeekMenu, statBlockPopover, statPeek, statPeekMenu]);

  const handleSelectionChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const {from} = editor.state.selection;
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
    syncSelectionMenu();
  }, [onCursorContextChange, syncSelectionMenu]);

  const handleEditorReady = useCallback((editorInstance: TipTapEditorInstance) => {
    editorRef.current = editorInstance;
    setReadyEditor(editorInstance);
    setEditorReadyToken((prev) => prev + 1);
    handleSelectionChange();
  }, [handleSelectionChange]);

  const {find, findInputRef} = useCurrentSceneFind({
    editorRef,
    editorScrollRef,
    editorReadyToken,
    editorScrollKey,
    documentId,
    content,
    resetSignal: onOpenAIContext
  });
  const effectiveToolbarActions = React.useMemo(
    () => [
      ...toolbarActions,
      {
        id: 'find-current-scene',
        label: 'Find in scene',
        onClick: find.open
      },
      ...aiTextControls.actions
    ],
    [find.open, toolbarActions, aiTextControls.actions]
  );

  const handleLoreHighlightClick = useCallback(
    (loreId: string, anchorRect: {left: number; top: number; bottom: number}) => {
      handleLoreHighlightLeave();
      openLoreHighlight(loreId, anchorRect);
    },
    [handleLoreHighlightLeave, openLoreHighlight]
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.on('selectionUpdate', handleSelectionChange);
    editor.on('transaction', handleSelectionChange);
    return () => {
      editor.off('selectionUpdate', handleSelectionChange);
      editor.off('transaction', handleSelectionChange);
    };
  }, [editorReadyToken, handleSelectionChange]);

  useEditorReviewFocus({
    editorRef,
    editorScrollRef,
    editorReadyToken,
    editorScrollKey,
    documentId,
    focusQuery,
    focusToken
  });

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
    <div className={styles.container} data-ai-text-highlight={aiTextControls.highlight ? 'on' : 'off'}>
      <CurrentSceneFindBar find={find} inputRef={findInputRef} />
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
          textToInsert={externalTextToInsert}
          onTextInserted={() => {
            if (externalTextToInsert) onTextInserted?.();
          }}
          insertContext={insertContext}
          insertProvenance={externalTextToInsert ? insertProvenance : undefined}
          sceneRevision={sceneRevision}
          revisionProjectId={projectId}
          revisionDocumentId={documentId}
          contentReplacement={contentReplacement}
          rewriteExtensions={config?.extensions}
          presentStatBlockToken={presentStatBlockToken}
        />
        {selectionBubble && (
          <EditorSelectionMenu
            selection={selectionBubble}
            menuRef={selectionMenuRef}
            setSelection={setSelectionBubble}
            closeMenu={closeSelectionBubble}
            editorRef={editorRef}
            documentId={documentId}
            quickSnippets={selectionQuickSnippets}
            selectionActions={selectionActions}
            popovers={popovers}
            onOpenAIContext={onOpenAIContext}
            onOpenLoreInspector={onOpenLoreInspector}
            onOpenWorldCapture={onOpenWorldCapture}
            onAddSelectionToInventory={onAddSelectionToInventory}
          />
        )}
        <EditorContextPopovers
          popovers={popovers}
          onOpenLoreInspector={onOpenLoreInspector}
          onRebindStatBlockToken={onRebindStatBlockToken}
        />
        <EditorStatPeekLayer
          peek={statPeekControls}
          characterStatPeek={characterStatPeek}
          onExpandSelection={onOpenAIContext && ((selection) => onOpenAIContext({type: 'document', id: documentId, ...selection}))}
        />
      </div>
    </div>
  );
};
