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
import {htmlToPlainText} from '../../utils/textHelpers';
import type {MemoryEntry as ShodhMemoryEntry} from '../../services/shodh/ShodhMemoryService';
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
  onSelectionAddToReview?: (text: string) => void;
  onOpenLoreRecord?: (target: {id: string; type: 'character' | 'entity'}) => void;
  systemHistoryEntries?: SystemHistoryEntry[];
  slashMemoryEntries?: ShodhMemoryEntry[];
  preferredSlashEntityNames?: string[];
  preferredSlashMemoryTags?: string[];
  onOpenStatBlockBuilder?: () => void;
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

interface SlashMenuState {
  from: number;
  to: number;
  query: string;
  mode: 'root' | 'character' | 'item' | 'memory' | 'system';
  x: number;
  y: number;
  activeIndex: number;
}

interface SlashCommandEntry {
  id: string;
  label: string;
  keywords: string[];
  group: 'action' | 'character' | 'item' | 'memory' | 'system';
  preferredNames?: string[];
  memoryTags?: string[];
  sceneId?: string;
  run: () => void;
}

const ROOT_SLASH_COMMANDS = ['character', 'item', 'memory', 'system'] as const;

type RootSlashCommand = (typeof ROOT_SLASH_COMMANDS)[number];

const parseRootSlashCommand = (query: string): RootSlashCommand | null => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'character' || normalized === 'char') return 'character';
  if (normalized === 'item' || normalized === 'entity' || normalized === 'location') {
    return 'item';
  }
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'canon') {
    return 'memory';
  }
  if (normalized === 'system' || normalized === 'sys' || normalized === 'event') {
    return 'system';
  }
  return null;
};

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
  onSelectionAddToReview,
  onOpenLoreRecord,
  systemHistoryEntries = [],
  slashMemoryEntries = [],
  preferredSlashEntityNames = [],
  preferredSlashMemoryTags = [],
  onOpenStatBlockBuilder,
  onClearSystemHistory,
  onOpenSceneFromHistory,
  onRunConsistencyReviewFromHistory,
  selectionQuickSnippets
}) => {
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isSidePanelExpanded, setSidePanelExpanded] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'ai' | 'system' | 'lore'>('ai');
  const [aiContext, setAIContext] = useState<AIContextType | null>(null);
  const [textToInsertFromAI, setTextToInsertFromAI] = useState<string | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState | null>(
    null
  );
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [editorReadyToken, setEditorReadyToken] = useState(0);
  const [activeLoreRecord, setActiveLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [queuedPromptToolIds, setQueuedPromptToolIds] = useState<string[] | null>(null);
  const [aiBudgetUsed, setAIBudgetUsed] = useState(0);
  const [lorePopoverRecord, setLorePopoverRecord] = useState<LoreInspectorRecord | null>(null);
  const [lorePopoverAnchor, setLorePopoverAnchor] = useState<{left: number; top: number} | null>(
    null
  );
  const editorRef = useRef<TipTapEditorInstance | null>(null);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const selectionBubbleRef = useRef<HTMLDivElement | null>(null);
  const [selectionBubbleWidth, setSelectionBubbleWidth] = useState(360);

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
  const personaToolIdsByName = React.useMemo(() => {
    const map = new Map<string, string[]>();
    (aiSettings?.promptTools ?? [])
      .filter((tool) => tool.enabled && tool.kind === 'persona')
      .forEach((tool) => {
        const key = tool.name.trim().toLowerCase();
        const existing = map.get(key) ?? [];
        existing.push(tool.id);
        map.set(key, existing);
      });
    return map;
  }, [aiSettings?.promptTools]);

  const buildPersonaPrompt = useCallback(
    (action: 'critique' | 'line-edit', scope: 'selection' | 'scene', excerpt: string) => {
      const trimmedExcerpt = excerpt.trim();
      const subjectLabel =
        scope === 'selection' ? 'selected passage' : 'current scene draft';
      if (action === 'line-edit') {
        return [
          `Line edit this ${subjectLabel}.`,
          'Keep the response concise and structured as:',
          '1. Quick verdict',
          '2. Top line issues',
          '3. Edited example',
          '4. Notes on voice/preservation',
          '',
          'Focus on clarity, rhythm, concision, and sentence flow.',
          'Preserve intent, canon facts, and voice.',
          'Do not rewrite beyond the provided passage.',
          '',
          'Excerpt:',
          trimmedExcerpt
        ].join('\n');
      }
      return [
        `Critique this ${subjectLabel}.`,
        'Keep the response concise and structured as:',
        '1. Quick verdict',
        '2. Top issues',
        '3. Specific examples',
        '4. Revision priorities',
        '',
        'Focus on clarity, pacing, scene structure, emotional payoff, and voice consistency.',
        'Do not rewrite the full passage unless explicitly asked.',
        '',
        `Excerpt:`,
        trimmedExcerpt
      ].join('\n');
    },
    []
  );

  const queuePersonaPrompt = useCallback(
    (action: 'critique' | 'line-edit', scope: 'selection' | 'scene') => {
      const selectedText =
        selectionBubble?.selectedText.trim() ?? aiContext?.selectedText?.trim() ?? '';
      const sceneText = htmlToPlainText(content).slice(0, 12000);
      const excerpt = scope === 'selection' ? selectedText : sceneText;

      if (!excerpt) {
        return false;
      }

      if (scope === 'selection' && selectionBubble) {
        setAIContext({
          type: 'document',
          id: documentId,
          selectedText: selectionBubble.selectedText,
          from: selectionBubble.from,
          to: selectionBubble.to
        });
      } else if (scope === 'scene') {
        setAIContext(null);
      }

      const personaName = action === 'line-edit' ? 'line editor' : 'writing critic';
      const personaToolIds = personaToolIdsByName.get(personaName) ?? [];

      setQueuedPrompt(buildPersonaPrompt(action, scope, excerpt));
      setQueuedPromptToolIds(personaToolIds.length > 0 ? personaToolIds : null);
      setActivePanelTab('ai');
      setShowSidePanel(true);
      return true;
    },
    [
      aiContext?.selectedText,
      buildPersonaPrompt,
      content,
      documentId,
      personaToolIdsByName,
      selectionBubble
    ]
  );

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
      if (detail?.id === 'critique-selected-passage') {
        queuePersonaPrompt('critique', 'selection');
      }
      if (detail?.id === 'critique-current-scene') {
        queuePersonaPrompt('critique', 'scene');
      }
      if (detail?.id === 'line-edit-selected-passage') {
        queuePersonaPrompt('line-edit', 'selection');
      }
    };

    window.addEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    };
  }, [queuePersonaPrompt]);

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
    if (!selectionBubble || !selectionBubbleRef.current) return;
    const element = selectionBubbleRef.current;
    const updateWidth = () => {
      setSelectionBubbleWidth(element.offsetWidth || 360);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
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

  const handleSlashInsert = useCallback((from: number, to: number, contentToInsert: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.commands.setTextSelection({from, to});
    editor.commands.deleteSelection();
    editor.commands.insertContent(contentToInsert);
    setSlashMenu(null);
  }, []);

  const uniqueCharacterSlashEntries = React.useMemo(() => {
    const seen = new Set<string>();
    return Object.values(selectionQuickSnippets?.characters ?? {})
      .filter((entry) => {
        const key = entry.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [selectionQuickSnippets]);

  const uniqueEntitySlashEntries = React.useMemo(() => {
    const seen = new Set<string>();
    return Object.values(selectionQuickSnippets?.entities ?? {})
      .filter((entry) => {
        const key = entry.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [selectionQuickSnippets]);

  const rootSlashEntries = React.useMemo<SlashCommandEntry[]>(() => [
    {
      id: 'root-character',
      label: '/character',
      keywords: ['character', 'char', 'snapshot', 'person'],
      group: 'action',
      run: () =>
        setSlashMenu((prev) =>
          prev ? {...prev, mode: 'character', query: '', activeIndex: 0} : prev
        )
    },
    {
      id: 'root-item',
      label: '/item',
      keywords: ['item', 'entity', 'world', 'location', 'lore'],
      group: 'action',
      run: () =>
        setSlashMenu((prev) =>
          prev ? {...prev, mode: 'item', query: '', activeIndex: 0} : prev
        )
    },
    {
      id: 'root-memory',
      label: '/memory',
      keywords: ['memory', 'canon', 'shodh'],
      group: 'action',
      run: () =>
        setSlashMenu((prev) =>
          prev ? {...prev, mode: 'memory', query: '', activeIndex: 0} : prev
        )
    },
    {
      id: 'root-system',
      label: '/system',
      keywords: ['system', 'event', 'history', 'resource', 'quest'],
      group: 'action',
      run: () =>
        setSlashMenu((prev) =>
          prev ? {...prev, mode: 'system', query: '', activeIndex: 0} : prev
        )
    },
    {
      id: 'root-stat-block',
      label: '/stat-block',
      keywords: ['stat', 'block', 'status', 'builder'],
      group: 'action',
      run: () => {
        onOpenStatBlockBuilder?.();
        const editor = editorRef.current;
        const activeSlash = slashMenu;
        if (!editor || !activeSlash) return;
        editor.commands.setTextSelection({from: activeSlash.from, to: activeSlash.to});
        editor.commands.deleteSelection();
        setSlashMenu(null);
      }
    }
  ], [onOpenStatBlockBuilder, slashMenu]);

  const slashEntries = React.useMemo<SlashCommandEntry[]>(() => {
    const slashFrom = slashMenu?.from ?? 0;
    const slashTo = slashMenu?.to ?? 0;
    if (slashMenu?.mode === 'character') {
      return uniqueCharacterSlashEntries.map((entry) => ({
        id: `character:${entry.lore.id}`,
        label: `Character: ${entry.name}`,
        keywords: ['character', 'snapshot', 'stat', entry.name],
        group: 'character' as const,
        preferredNames: [entry.name],
        run: () => handleSlashInsert(slashFrom, slashTo, entry.html)
      }));
    }
    if (slashMenu?.mode === 'item') {
      return uniqueEntitySlashEntries.map((entry) => ({
        id: `entity:${entry.lore.id}`,
        label: `Item/World: ${entry.name}`,
        keywords: ['item', 'entity', 'lore', 'location', entry.name],
        group: 'item' as const,
        preferredNames: [entry.name],
        run: () => handleSlashInsert(slashFrom, slashTo, entry.html)
      }));
    }
    if (slashMenu?.mode === 'memory') {
      return slashMemoryEntries.slice(0, 12).map((memory) => ({
        id: `memory:${memory.id}`,
        label: `Memory: ${memory.title || 'Untitled memory'}`,
        keywords: ['memory', 'canon', 'shodh', ...(memory.tags ?? [])],
        group: 'memory' as const,
        memoryTags: memory.tags ?? [],
        run: () => handleSlashInsert(slashFrom, slashTo, memory.summary)
      }));
    }
    if (slashMenu?.mode === 'system') {
      return systemHistoryEntries
        .filter((entry) => {
          if (entry.category === 'consistency') {
            return false;
          }
          if (entry.category === 'quest' || entry.category === 'resource') {
            return true;
          }
          if (entry.category === 'system') {
            return (
              entry.insertText.startsWith('System Update:') ||
              entry.insertText.startsWith('System Status:')
            );
          }
          return false;
        })
        .slice(0, 12)
        .map((entry) => ({
        id: `system:${entry.id}`,
        label: `System: ${entry.message}`,
        keywords: ['system', 'history', entry.category, 'event'],
        group: 'system' as const,
        sceneId: entry.sceneId,
        run: () => handleSlashInsert(slashFrom, slashTo, entry.insertText)
      }));
    }
    return rootSlashEntries;
  }, [
    handleSlashInsert,
    rootSlashEntries,
    slashMenu?.from,
    slashMenu?.mode,
    slashMenu?.to,
    slashMemoryEntries,
    systemHistoryEntries,
    uniqueCharacterSlashEntries,
    uniqueEntitySlashEntries
  ]);

  const filteredSlashEntries = React.useMemo(() => {
    const query = slashMenu?.query.trim().toLowerCase() ?? '';
    const entries = query
      ? slashEntries.filter((entry) =>
          [entry.label, ...entry.keywords].join(' ').toLowerCase().includes(query)
        )
      : slashEntries;
    if (slashMenu?.mode === 'root') {
      return entries.slice(0, 5);
    }
    const groupRank = {action: 0, character: 1, item: 2, memory: 3, system: 4};
    const preferredNameSet = new Set(
      preferredSlashEntityNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
    );
    const preferredMemoryTagSet = new Set(preferredSlashMemoryTags);
    const preferenceScore = (entry: SlashCommandEntry) => {
      let score = 0;
      if (
        entry.preferredNames?.some((name) =>
          preferredNameSet.has(name.trim().toLowerCase())
        )
      ) {
        score += 20;
      }
      if (entry.memoryTags?.some((tag) => preferredMemoryTagSet.has(tag))) {
        score += 20;
      }
      if (entry.sceneId && entry.sceneId === documentId) {
        score += 10;
      }
      return score;
    };
    return entries
      .sort((left, right) => {
        const preferenceDelta = preferenceScore(right) - preferenceScore(left);
        if (preferenceDelta !== 0) return preferenceDelta;
        const groupDelta = groupRank[left.group] - groupRank[right.group];
        if (groupDelta !== 0) return groupDelta;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 10);
  }, [
    documentId,
    preferredSlashEntityNames,
    preferredSlashMemoryTags,
    slashEntries,
    slashMenu?.mode,
    slashMenu?.query
  ]);

  const updateSlashMenu = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const {from, to, $from} = editor.state.selection;
    if (from !== to) {
      setSlashMenu(null);
      return;
    }
    const parentStart = $from.start();
    const textBefore = editor.state.doc.textBetween(parentStart, from, '\n', ' ');
    const committedMatch = textBefore.match(/(?:^|\s)\/([a-z-]+)\s+([^/\n]*)$/i);
    if (committedMatch) {
      const command = parseRootSlashCommand(committedMatch[1] ?? '');
      if (!command) {
        setSlashMenu(null);
        return;
      }
      const query = committedMatch[2] ?? '';
      const slashStart = from - query.length - committedMatch[1].length - 2;
      const coords = editor.view.coordsAtPos(from);
      setSlashMenu((prev) => ({
        from: slashStart,
        to: from,
        query,
        mode: command,
        x: coords.left,
        y: coords.bottom + 8,
        activeIndex:
          prev && prev.from === slashStart && prev.query === query && prev.mode === command
            ? Math.min(prev.activeIndex, Math.max(0, filteredSlashEntries.length - 1))
            : 0
      }));
      return;
    }
    const rootMatch = textBefore.match(/(?:^|\s)\/([a-z-]*)$/i);
    if (!rootMatch) {
      setSlashMenu(null);
      return;
    }
    const query = rootMatch[1] ?? '';
    const slashStart = from - query.length - 1;
    const coords = editor.view.coordsAtPos(from);
    setSlashMenu((prev) => ({
      from: slashStart,
      to: from,
      query,
      mode: 'root',
      x: coords.left,
      y: coords.bottom + 8,
      activeIndex:
        prev && prev.from === slashStart && prev.query === query && prev.mode === 'root'
          ? Math.min(prev.activeIndex, Math.max(0, filteredSlashEntries.length - 1))
          : 0
      }));
  }, [filteredSlashEntries.length]);

  const openSlashMenuAtSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const {from, to} = editor.state.selection;
    if (from !== to || from < 1) {
      return;
    }
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from, '\n', ' ');
    if (textBefore !== '/') {
      updateSlashMenu();
      return;
    }
    const coords = editor.view.coordsAtPos(from);
    setSlashMenu({
      from: from - 1,
      to: from,
      query: '',
      mode: 'root',
      x: coords.left,
      y: coords.bottom + 8,
      activeIndex: 0
    });
  }, [updateSlashMenu]);

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
    editor.on('selectionUpdate', updateSlashMenu);
    editor.on('transaction', updateSlashMenu);
    return () => {
      editor.off('selectionUpdate', updateSelectionBubble);
      editor.off('transaction', updateSelectionBubble);
      editor.off('selectionUpdate', updateSlashMenu);
      editor.off('transaction', updateSlashMenu);
    };
  }, [editorReadyToken, updateSelectionBubble, updateSlashMenu]);

  const handleEditorKeyDown = useCallback((event: KeyboardEvent) => {
    const isPlainSlash =
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;
    if (isPlainSlash && !slashMenu) {
      window.setTimeout(() => {
        openSlashMenuAtSelection();
      }, 0);
      return false;
    }
    if (!slashMenu) {
      return false;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashMenu(null);
      return true;
    }
    if (filteredSlashEntries.length === 0) {
      return false;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSlashMenu((prev) =>
        prev
          ? {...prev, activeIndex: (prev.activeIndex + 1) % filteredSlashEntries.length}
          : prev
      );
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSlashMenu((prev) =>
        prev
          ? {
              ...prev,
              activeIndex:
                (prev.activeIndex - 1 + filteredSlashEntries.length) %
                filteredSlashEntries.length
            }
          : prev
      );
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      filteredSlashEntries[slashMenu.activeIndex]?.run();
      return true;
    }
    return false;
  }, [filteredSlashEntries, openSlashMenuAtSelection, slashMenu]);

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

  const editorPaneRect = editorPaneRef.current?.getBoundingClientRect() ?? null;
  const clampedSelectionBubbleLeft = selectionBubble
    ? Math.max(
        selectionBubbleWidth / 2 + 16,
        Math.min(
          editorPaneRect
            ? editorPaneRect.left + editorPaneRect.width / 2
            : window.innerWidth / 2,
          window.innerWidth - selectionBubbleWidth / 2 - 16
        )
      )
    : 0;
  const clampedSelectionBubbleTop = selectionBubble
    ? Math.max(64, selectionBubble.y)
    : 0;

  return (
    <div className={styles.container}>
      <div ref={editorPaneRef} className={styles.editor}>
        <TipTapEditor
          content={content}
          onChange={onChange}
          onEditorKeyDown={handleEditorKeyDown}
          onEditorTextInput={(text) => {
            if (text === '/') {
              openSlashMenuAtSelection();
            }
          }}
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
        {slashMenu && (
          <div
            className={styles.slashMenu}
            style={{left: `${slashMenu.x}px`, top: `${slashMenu.y}px`}}
          >
            {filteredSlashEntries.length === 0 ? (
              <div className={styles.slashMenuEmpty}>No slash actions match.</div>
            ) : (
              filteredSlashEntries.map((entry, index) => (
                <button
                  key={entry.id}
                  type='button'
                  className={`${styles.slashMenuItem} ${
                    index === slashMenu.activeIndex ? styles.slashMenuItemActive : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => entry.run()}
                >
                  <span>{entry.label}</span>
                  <span className={styles.slashMenuMeta}>
                    {slashMenu.mode === 'root' ? 'command' : entry.group}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        {selectionBubble && (
          <div
            ref={selectionBubbleRef}
            className={styles.selectionBubble}
            style={{
              left: `${clampedSelectionBubbleLeft}px`,
              top: `${clampedSelectionBubbleTop}px`
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
            <button
              type='button'
              onClick={() => {
                queuePersonaPrompt('critique', 'selection');
              }}
            >
              Critique Selected Passage
            </button>
            <button
              type='button'
              onClick={() => {
                queuePersonaPrompt('line-edit', 'selection');
              }}
            >
              Line Edit Selected Passage
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
            {!selectionBubble.matchRecord && onSelectionAddToReview && (
              <button
                type='button'
                onClick={() => {
                  onSelectionAddToReview(selectionBubble.selectedText);
                  setSelectionBubble(null);
                }}
              >
                Add to Review
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
            eyebrow={
              lorePopoverRecord.type === 'character' ? 'Character Lore' : 'World Lore'
            }
            message='Quick canon snapshot for the selected reference.'
            tone='info'
            left={lorePopoverAnchor.left}
            top={lorePopoverAnchor.top}
            onClose={() => {
              setLorePopoverAnchor(null);
              setLorePopoverRecord(null);
            }}
          >
            <div className={styles.popoverSectionLabel}>Vital signs</div>
            {lorePopoverRecord.type === 'entity' &&
            lorePopoverRecord.completionStatus === 'draft' ? (
              <div className={styles.loreDraftWarning}>
                Needs completion in World Bible.
              </div>
            ) : null}
            <div className={styles.lorePeekVitals}>
              {lorePopoverRecord.vitalSigns.map((item) => (
                <span key={item} className={styles.loreVitalChip}>
                  {item}
                </span>
              ))}
            </div>
            <div className={styles.popoverSectionLabel}>Synopsis</div>
            <div className={styles.lorePeekSummary}>
              <div className={styles.lorePeekRow}>
                <div className={styles.lorePeekLabel}>Goal</div>
                <div className={styles.lorePeekValue}>{lorePopoverRecord.synopsis.goal}</div>
              </div>
              <div className={styles.lorePeekRow}>
                <div className={styles.lorePeekLabel}>Recent event</div>
                <div className={styles.lorePeekValue}>
                  {lorePopoverRecord.synopsis.recentEvent}
                </div>
              </div>
              <div className={styles.lorePeekRow}>
                <div className={styles.lorePeekLabel}>Motivation</div>
                <div className={styles.lorePeekValue}>
                  {lorePopoverRecord.synopsis.motivation}
                </div>
              </div>
            </div>
            <div className={styles.systemActions}>
              {onOpenLoreRecord && (
                <button
                  type='button'
                  onClick={() => {
                    onOpenLoreRecord({
                      id: lorePopoverRecord.id,
                      type: lorePopoverRecord.type
                    });
                    setLorePopoverAnchor(null);
                    setLorePopoverRecord(null);
                  }}
                >
                  {lorePopoverRecord.type === 'entity'
                    ? 'Open in World Bible'
                    : 'Open in Characters'}
                </button>
              )}
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
        <div
          className={`${styles.aiPanel} ${
            isSidePanelExpanded ? styles.aiPanelWide : ''
          }`}
        >
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
            type='button'
            className={styles.panelResizeButton}
            onClick={() => setSidePanelExpanded((prev) => !prev)}
          >
            {isSidePanelExpanded ? 'Narrow' : 'Expand'}
          </button>
          <button
            className={styles.closeButton}
            onClick={() => setShowSidePanel(false)}
          >
            ×
          </button>
          {activePanelTab === 'ai' ? (
            <>
              <div className={styles.systemActions}>
                <button
                  type='button'
                  onClick={() => {
                    queuePersonaPrompt('critique', 'scene');
                  }}
                >
                  Critique Current Scene
                </button>
                <button
                  type='button'
                  onClick={() => {
                    queuePersonaPrompt('critique', 'selection');
                  }}
                  disabled={!selectionBubble?.selectedText.trim()}
                >
                  Critique Selected Passage
                </button>
                <button
                  type='button'
                  onClick={() => {
                    queuePersonaPrompt('line-edit', 'selection');
                  }}
                  disabled={!selectionBubble?.selectedText.trim()}
                >
                  Line Edit Selected Passage
                </button>
              </div>
              <AIAssistant
                projectId={projectId}
                aiConfig={aiSettings ?? undefined}
                projectMode={projectMode}
                context={aiContext ?? undefined}
                onInsert={handleInsert}
                queuedPrompt={queuedPrompt}
                queuedToolIds={queuedPromptToolIds}
                onQueuedPromptConsumed={() => {
                  setQueuedPrompt(null);
                  setQueuedPromptToolIds(null);
                }}
                consultationModel={aiSettings?.inspectorSettings?.lowCostModel}
                consultationMaxTokens={aiSettings?.inspectorSettings?.maxResponseTokens}
              />
            </>
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
