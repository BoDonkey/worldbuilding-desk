import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import type {LoreInspectorRecord} from './LoreInspectorPanel';
import {ContextPopover} from './ContextPopover';
import {AIExpandMenu} from './extensions/AIExpandMenu';
import {
  createConsistencyHighlightsExtension,
  type ConsistencyHighlightIssue
} from './extensions/ConsistencyHighlightsExtension';
import {
  createLoreHighlightsExtension,
  type LoreHighlightEntry
} from './extensions/LoreHighlightsExtension';
import type {EditorConfig} from '../../config/editorConfig';
import type {StatBlockTokenPresentation} from '../../utils/statBlockTemplates';
import type {StatBlockPreviewData} from '../../hooks/useWorkspaceStatBlocks';
import type {InlineHighlightsMode} from '../../entityTypes';
import styles from '../../assets/components/AISettings.module.css';

interface AIContextType {
  type: 'document';
  id: string;
  selectedText: string;
  from: number;
  to: number;
}

interface EditorWithAIProps {
  documentId: string;
  content: string;
  focusQuery?: string | null;
  onChange: (content: string) => void;
  onWordCountChange?: (count: number) => void;
  consistencyHighlights?: ConsistencyHighlightIssue[];
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: Array<{id: string; label: string; markName: string}>;
  toolbarActions?: Array<{id: string; label: string; onClick: () => void}>;
  textToInsert?: string | null;
  insertContext?: {from: number; to: number} | null;
  onTextInserted?: () => void;
  selectionQuickSnippets?: {
    characters: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
    entities: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
  };
  characterStateHoverCardsByLoreId?: Record<
    string,
    {
      title: string;
      sceneLabel: string;
      resources: string[];
      stats: string[];
      statuses: string[];
      location?: string;
    }
  >;
  presentStatBlockToken?: (rawToken: string) => StatBlockTokenPresentation;
  getStatBlockPreviewData?: (rawToken: string) => StatBlockPreviewData;
  onRebindStatBlockToken?: (rawToken: string) => void;
  onOpenAIContext?: (context: AIContextType) => void;
  onOpenLoreInspector?: (record: LoreInspectorRecord) => void;
  onOpenWorldCapture?: (
    draftText: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  inlineHighlightsMode?: InlineHighlightsMode;
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

export const EditorWithAI: React.FC<EditorWithAIProps> = ({
  documentId,
  content,
  focusQuery = null,
  onChange,
  onWordCountChange,
  consistencyHighlights = [],
  onConsistencyHighlightClick,
  config,
  toolbarButtons = [],
  toolbarActions = [],
  textToInsert: externalTextToInsert = null,
  insertContext = null,
  onTextInserted,
  selectionQuickSnippets,
  presentStatBlockToken,
  getStatBlockPreviewData,
  onRebindStatBlockToken,
  onOpenAIContext,
  onOpenLoreInspector,
  onOpenWorldCapture,
  characterStateHoverCardsByLoreId = {},
  inlineHighlightsMode = 'visible'
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
  const [characterStateHoverCard, setCharacterStateHoverCard] = useState<{
    card: {
      title: string;
      sceneLabel: string;
      resources: string[];
      stats: string[];
      statuses: string[];
      location?: string;
    };
    left: number;
    top: number;
  } | null>(null);
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const editorRef = useRef<TipTapEditorInstance | null>(null);
  const consistencyHighlightsRef = useRef(consistencyHighlights);
  const loreHighlightsRef = useRef<LoreHighlightEntry[]>([]);
  const typingIdleTimeoutRef = useRef<number | null>(null);

  const effectiveInlineHighlightsMode =
    inlineHighlightsMode === 'hidden-while-typing' && isActivelyTyping
      ? 'hidden'
      : inlineHighlightsMode;

  const loreHighlights = React.useMemo<LoreHighlightEntry[]>(() => {
    const characterEntries = Object.values(selectionQuickSnippets?.characters ?? {}).map(
      (entry) => ({
        id: entry.lore.id,
        surface: entry.name,
        type: 'character' as const
      })
    );
    const entityEntries = Object.values(selectionQuickSnippets?.entities ?? {}).map(
      (entry) => ({
        id: entry.lore.id,
        surface: entry.name,
        type: 'entity' as const
      })
    );
    return [...characterEntries, ...entityEntries];
  }, [selectionQuickSnippets]);

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
      createConsistencyHighlightsExtension(() => consistencyHighlightsRef.current),
        createLoreHighlightsExtension(
          () => loreHighlightsRef.current,
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
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (typingIdleTimeoutRef.current !== null) {
        window.clearTimeout(typingIdleTimeoutRef.current);
      }
      editorRef.current = null;
    };
  }, []);

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
    if (!lorePopoverAnchor && !statBlockPopover && !characterStateHoverCard) return;
    const close = () => {
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
      setStatBlockPopover(null);
      setCharacterStateHoverCard(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [characterStateHoverCard, lorePopoverAnchor, statBlockPopover]);

  useEffect(() => {
    const reposition = () => {
      const editor = editorRef.current;
      if (!editor || !selectionBubble) return;
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
  }, [normalizeSelectionSurface, selectionQuickSnippets]);

  const handleEditorReady = useCallback((editorInstance: TipTapEditorInstance) => {
    editorRef.current = editorInstance;
    setEditorReadyToken((prev) => prev + 1);
    updateSelectionBubble();
  }, [updateSelectionBubble]);

  const handleLoreHighlightClick = useCallback(
    (loreId: string, anchorRect: {left: number; top: number; bottom: number}) => {
      setCharacterStateHoverCard(null);
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
    (loreId: string, anchorRect: {left: number; top: number; bottom: number}) => {
      const card = characterStateHoverCardsByLoreId[loreId];
      if (!card) {
        setCharacterStateHoverCard(null);
        return;
      }
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
      setStatBlockPopover(null);
      setCharacterStateHoverCard({
        card,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    [characterStateHoverCardsByLoreId]
  );

  const handleLoreHighlightLeave = useCallback(() => {
    setCharacterStateHoverCard(null);
  }, []);

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
    let match: {from: number; to: number} | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (match || !node.isText || !node.text) {
        return;
      }
      const index = node.text.toLowerCase().indexOf(loweredQuery);
      if (index < 0) {
        return;
      }
      match = {
        from: pos + index,
        to: pos + index + query.length
      };
    });

    if (!match) return;

    editor.commands.focus();
    editor.commands.setTextSelection(match);
    editor.view.dispatch(editor.state.tr.scrollIntoView());
  }, [documentId, editorReadyToken, focusQuery]);

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
      <div className={styles.editor}>
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
          toolbarActions={toolbarActions}
          textToInsert={externalTextToInsert ?? textToInsertFromAI}
          onTextInserted={() => {
            if (externalTextToInsert) {
              onTextInserted?.();
              return;
            }
            setTextToInsertFromAI(null);
          }}
          insertContext={insertContext}
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
        {characterStateHoverCard && (
          <ContextPopover
            title={characterStateHoverCard.card.title}
            message={`State at ${characterStateHoverCard.card.sceneLabel}`}
            left={characterStateHoverCard.left}
            top={characterStateHoverCard.top}
            onClose={() => setCharacterStateHoverCard(null)}
          >
            {characterStateHoverCard.card.resources.length > 0 && (
              <div className={styles.lorePeekList}>
                <div>
                  <strong>Resources:</strong> {characterStateHoverCard.card.resources.join(' · ')}
                </div>
              </div>
            )}
            {characterStateHoverCard.card.stats.length > 0 && (
              <div className={styles.lorePeekList}>
                <div>
                  <strong>Stats:</strong> {characterStateHoverCard.card.stats.join(' · ')}
                </div>
              </div>
            )}
            <div className={styles.lorePeekList}>
              <div>
                <strong>Statuses:</strong>{' '}
                {characterStateHoverCard.card.statuses.length > 0
                  ? characterStateHoverCard.card.statuses.join(', ')
                  : 'none'}
              </div>
              {characterStateHoverCard.card.location && (
                <div>
                  <strong>Location:</strong> {characterStateHoverCard.card.location}
                </div>
              )}
            </div>
          </ContextPopover>
        )}
      </div>
    </div>
  );
};
