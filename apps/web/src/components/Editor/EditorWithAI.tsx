import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {LoreInspectorPanel, type LoreInspectorRecord} from './LoreInspectorPanel';
import {SystemHistoryPanel} from './SystemHistoryPanel';
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
import type {
  ProjectAISettings,
  ProjectMode,
  SystemHistoryEntry
} from '../../entityTypes';
import {
  WORKSPACE_COMMAND_EVENT,
  type WorkspaceCommandId
} from '../../commands/workspaceCommands';
import {
  getInspectorConsultationUsage,
  incrementInspectorConsultationUsage
} from '../../services/inspectorBudgetService';
import styles from '../../assets/components/AISettings.module.css';

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
  onChange: (content: string) => void;
  onWordCountChange?: (count: number) => void;
  consistencyHighlights?: ConsistencyHighlightIssue[];
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: Array<{id: string; label: string; markName: string}>;
  aiSettings?: ProjectAISettings | null;
  projectMode?: ProjectMode;
  textToInsert?: string | null;
  onTextInserted?: () => void;
  systemHistoryEntries?: SystemHistoryEntry[];
  onClearSystemHistory?: () => void;
  onOpenSceneFromHistory?: (sceneId: string) => void;
  onRunConsistencyReviewFromHistory?: () => void;
  selectionQuickSnippets?: {
    characters: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
    entities: Record<string, {name: string; html: string; lore: LoreInspectorRecord}>;
  };
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
  projectId,
  documentId,
  content,
  onChange,
  onWordCountChange,
  consistencyHighlights = [],
  onConsistencyHighlightClick,
  config,
  toolbarButtons = [],
  aiSettings,
  projectMode = 'litrpg',
  textToInsert: externalTextToInsert = null,
  onTextInserted,
  systemHistoryEntries = [],
  onClearSystemHistory,
  onOpenSceneFromHistory,
  onRunConsistencyReviewFromHistory,
  selectionQuickSnippets
}) => {
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'ai' | 'system' | 'lore'>('ai');
  const [aiContext, setAIContext] = useState<AIContextType | null>(null);
  const [textToInsertFromAI, setTextToInsertFromAI] = useState<string | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState | null>(
    null
  );
  const [editorReadyToken, setEditorReadyToken] = useState(0);
  const [activeLoreRecord, setActiveLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [aiBudgetUsed, setAIBudgetUsed] = useState(0);
  const [lorePopoverRecord, setLorePopoverRecord] = useState<LoreInspectorRecord | null>(null);
  const [lorePopoverAnchor, setLorePopoverAnchor] = useState<{left: number; top: number} | null>(
    null
  );
  const editorRef = useRef<TipTapEditorInstance | null>(null);

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
        createConsistencyHighlightsExtension(consistencyHighlights),
        createLoreHighlightsExtension(loreHighlights)
      ]
    };
  }, [config, consistencyHighlights, loreHighlights]);
  const insertContext = externalTextToInsert ? null : aiContext;

  useEffect(() => {
    const handleAIRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selectedText: string;
        from: number;
        to: number;
      }>;

      setAIContext({
        type: 'document',
        id: documentId,
        selectedText: customEvent.detail.selectedText,
        from: customEvent.detail.from,
        to: customEvent.detail.to
      });
      setActivePanelTab('ai');
      setShowSidePanel(true);
    };

    window.addEventListener('ai-expand-request', handleAIRequest);
    return () => {
      window.removeEventListener('ai-expand-request', handleAIRequest);
    };
  }, [documentId]);

  useEffect(() => {
    const onWorkspaceCommand = (event: Event) => {
      const detail = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail;
      if (detail?.id === 'toggle-ai-panel') {
        setActivePanelTab('ai');
        setShowSidePanel(true);
      }
      if (detail?.id === 'toggle-system-history-panel') {
        setActivePanelTab('system');
        setShowSidePanel(true);
      }
    };

    window.addEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    };
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    setAIBudgetUsed(getInspectorConsultationUsage(projectId));
  }, [projectId]);

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
    if (!lorePopoverAnchor) return;
    const close = () => {
      setLorePopoverAnchor(null);
      setLorePopoverRecord(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [lorePopoverAnchor]);

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

  const handleInsert = (text: string) => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    if (aiContext) {
      editor.commands.setTextSelection({
        from: aiContext.from,
        to: aiContext.to
      });
      editor.commands.insertContent(text);
    } else {
      setTextToInsertFromAI(text);
    }
  };

  const handleConsultation = (mode: 'consistency' | 'reaction' | 'outcome') => {
    if (!activeLoreRecord) return;
    const inspector = aiSettings?.inspectorSettings;
    if (inspector?.enableAIConsultation === false) {
      return;
    }
    const maxConsultations = inspector?.maxConsultationsPerDay ?? 20;
    const used = getInspectorConsultationUsage(projectId);
    if (used >= maxConsultations) {
      return;
    }

    const nextUsed = incrementInspectorConsultationUsage(projectId);
    setAIBudgetUsed(nextUsed);

    const maxContextChars = inspector?.maxContextChars ?? 1800;
    const selectedContext =
      selectionBubble?.selectedText || aiContext?.selectedText || activeLoreRecord.name;
    const compactContext = selectedContext.slice(0, maxContextChars);
    const header =
      mode === 'consistency'
        ? 'Check consistency for this subject against the selected scene context.'
        : mode === 'reaction'
          ? 'Suggest an in-character reaction aligned with this subject profile.'
          : 'Calculate a plausible outcome grounded in current stats/resources.';
    const prompt =
      `${header}\n\n` +
      `Subject: ${activeLoreRecord.name} (${activeLoreRecord.type})\n` +
      `Vital Signs: ${activeLoreRecord.vitalSigns.join(' | ')}\n` +
      `Goal: ${activeLoreRecord.synopsis.goal}\n` +
      `Recent Event: ${activeLoreRecord.synopsis.recentEvent}\n` +
      `Motivation: ${activeLoreRecord.synopsis.motivation}\n` +
      `Scene Context: ${compactContext}`;

    setQueuedPrompt(prompt);
    setActivePanelTab('ai');
    setShowSidePanel(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.editor}>
        <TipTapEditor
          content={content}
          onChange={onChange}
          onWordCountChange={onWordCountChange}
          onConsistencyHighlightClick={onConsistencyHighlightClick}
          onLoreHighlightClick={handleLoreHighlightClick}
          onEditorReady={handleEditorReady}
          config={mergedConfig}
          toolbarButtons={toolbarButtons}
          textToInsert={externalTextToInsert ?? textToInsertFromAI}
          onTextInserted={() => {
            if (externalTextToInsert) {
              onTextInserted?.();
              return;
            }
            setTextToInsertFromAI(null);
          }}
          insertContext={insertContext}
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
                setAIContext({
                  type: 'document',
                  id: documentId,
                  selectedText: selectionBubble.selectedText,
                  from: selectionBubble.from,
                  to: selectionBubble.to
                });
                setActivePanelTab('ai');
                setShowSidePanel(true);
              }}
            >
              AI Expand
            </button>
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
                  setActiveLoreRecord(selectionBubble.matchRecord?.lore ?? null);
                  setActivePanelTab('lore');
                  setShowSidePanel(true);
                }}
              >
                Open Lore
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
                  setActiveLoreRecord(lorePopoverRecord);
                  setActivePanelTab('lore');
                  setShowSidePanel(true);
                  setLorePopoverAnchor(null);
                  setLorePopoverRecord(null);
                }}
              >
                Open Lore Inspector
              </button>
            </div>
          </ContextPopover>
        )}
      </div>

      {showSidePanel && (
        <div className={styles.aiPanel}>
          <div className={styles.panelTabs}>
            <button
              type='button'
              className={`${styles.panelTab} ${
                activePanelTab === 'ai' ? styles.panelTabActive : ''
              }`}
              onClick={() => setActivePanelTab('ai')}
            >
              AI Assistant
            </button>
            <button
              type='button'
              className={`${styles.panelTab} ${
                activePanelTab === 'system' ? styles.panelTabActive : ''
              }`}
              onClick={() => setActivePanelTab('system')}
            >
              System History
            </button>
            <button
              type='button'
              className={`${styles.panelTab} ${
                activePanelTab === 'lore' ? styles.panelTabActive : ''
              }`}
              onClick={() => setActivePanelTab('lore')}
            >
              Lore Inspector
            </button>
          </div>
          <button
            className={styles.closeButton}
            onClick={() => setShowSidePanel(false)}
          >
            ×
          </button>
          {activePanelTab === 'ai' ? (
            <AIAssistant
              projectId={projectId}
              aiConfig={aiSettings ?? undefined}
              projectMode={projectMode}
              context={aiContext ?? undefined}
              onInsert={handleInsert}
              queuedPrompt={queuedPrompt}
              onQueuedPromptConsumed={() => setQueuedPrompt(null)}
              consultationModel={aiSettings?.inspectorSettings?.lowCostModel}
              consultationMaxTokens={aiSettings?.inspectorSettings?.maxResponseTokens}
            />
          ) : activePanelTab === 'system' ? (
            <SystemHistoryPanel
              entries={systemHistoryEntries}
              onInsertEntry={(entry) => handleInsert(entry.insertText)}
              onClear={() => onClearSystemHistory?.()}
              onOpenScene={onOpenSceneFromHistory}
              onRunConsistencyReview={onRunConsistencyReviewFromHistory}
            />
          ) : (
            <LoreInspectorPanel
              record={activeLoreRecord}
              aiEnabled={aiSettings?.inspectorSettings?.enableAIConsultation !== false}
              aiBudgetUsed={aiBudgetUsed}
              aiBudgetMax={aiSettings?.inspectorSettings?.maxConsultationsPerDay ?? 20}
              onConsult={handleConsultation}
            />
          )}
        </div>
      )}

      {!showSidePanel && (
        <button className={styles.aiToggle} onClick={() => setShowSidePanel(true)}>
          AI Assistant
        </button>
      )}
    </div>
  );
};
