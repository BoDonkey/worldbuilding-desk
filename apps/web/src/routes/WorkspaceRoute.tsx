import {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {ChangeEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  StatBlockGroup,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  StoredRuleset,
  SystemHistoryEntry,
  WorkspaceImportMode,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {
  getDocumentsByProject,
  saveWritingDocument,
  deleteWritingDocument
} from '../writingStorage';
import {getEntitiesByProject, saveEntity} from '../entityStorage';
import {
  getCategoriesByProject,
  initializeDefaultCategories
} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import {getCharacterSheetsByProject} from '../services/characterSheetService';
import {
  getOrCreateSettings,
  getResolvedConsistencyActionCues,
  saveProjectSettings
} from '../settingsStorage';
import {createEditorConfigWithStyles} from '../config/editorConfig';
import type {EditorConfig} from '../config/editorConfig';
import {countWords, htmlToPlainText} from '../utils/textHelpers';
import {
  exportScenesAsDocx,
  exportScenesAsEpub,
  exportScenesAsMarkdown
} from '../utils/sceneExport';
import {EditorWithAI} from '../components/Editor/EditorWithAI';
import {ContextPopover} from '../components/Editor/ContextPopover';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {getRulesetByProjectId} from '../services/rulesetService';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumProgress,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getOrCreateSettlementState,
  getPartySynergySuggestions,
  getSettlementModulesByProject
} from '../services/compendiumService';
import {
  buildCharacterStatBlockHtml,
  buildItemStatBlockHtml,
  createStatBlockToken,
  formatEntityFieldValue,
  replaceStatBlockTokensInHtml
} from '../utils/statBlockTemplates';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent,
  getCanonSyncState,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';
import {getConsistencyEngineService} from '../services/consistencyEngine/getConsistencyEngineService';
import type {GuardrailIssue} from '../services/consistencyEngine/types';
import {
  getAliasesByProject,
  saveAlias,
  type ConsistencyAlias
} from '../services/consistencyEngine/aliasStorage';
import {findCanonContradictions} from '../services/consistencyEngine/contradictionReview';
import {
  appendSystemHistoryEntry,
  clearSystemHistoryEntries,
  getSystemHistoryEntries
} from '../services/systemHistoryService';
import {
  getCachedSynopsis,
  setCachedSynopsis
} from '../services/loreInspectorCacheService';
import {
  WORKSPACE_COMMAND_EVENT,
  type WorkspaceCommandId
} from '../commands/workspaceCommands';
import styles from '../styles/WorkspaceRoute.module.css';

const summarizeContent = (html: string, limit = 500): string => {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, limit);
};

interface WorkspaceRouteProps {
  activeProject: Project | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved';
type FeedbackTone = 'success' | 'error';
type ExportFormat = 'markdown' | 'docx' | 'epub';
type ContextDrawerView = 'world-bible' | 'ruleset' | 'characters' | 'compendium';
type ImportMode = WorkspaceImportMode;

interface SceneExportItem {
  id: string;
  title: string;
  included: boolean;
}

interface ResolverNotice {
  message: string;
}

interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
}

interface WorkspaceDrawerPreferences {
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  activeContextView: ContextDrawerView;
}

interface ImportFailureItem {
  fileName: string;
  reason: 'legacy-doc' | 'apple-pages' | 'parse-failed';
  detail?: string;
}

interface ImportSummary {
  importedCount: number;
  failedCount: number;
  unresolvedCount: number;
  mode: ImportMode;
  suggestionsSkipped: boolean;
  openedTitle?: string;
  failures: ImportFailureItem[];
  createdAt: number;
}

interface ConsistencyPopoverState {
  issueId: string;
  surface: string;
  left: number;
  top: number;
}

const downgradeUnknownIssuesToWarnings = (
  issues: GuardrailIssue[]
): GuardrailIssue[] =>
  issues.map((issue) =>
    issue.code === 'UNKNOWN_ENTITY'
      ? {
          ...issue,
          severity: 'warning',
          message: issue.surface
            ? `Review "${issue.surface}" before canonizing this scene.`
            : 'Review this unknown entity before canonizing this scene.'
        }
      : issue
  );

function WorkspaceRoute({activeProject}: WorkspaceRouteProps) {
  const navigate = useNavigate();
  const consistencyEngine = useMemo(() => getConsistencyEngineService(), []);
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [toolbarButtons, setToolbarButtons] = useState<
    Array<{id: string; label: string; markName: string}>
  >([]);
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [resolvedActionCues, setResolvedActionCues] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [statBlockSourceType, setStatBlockSourceType] =
    useState<StatBlockSourceType>('character');
  const [statBlockStyle, setStatBlockStyle] = useState<StatBlockStyle>('full');
  const [statBlockInsertMode, setStatBlockInsertMode] =
    useState<StatBlockInsertMode>('block');
  const [statBlockScopePreset, setStatBlockScopePreset] =
    useState<StatBlockScopePreset>('all');
  const [selectedStatGroupId, setSelectedStatGroupId] = useState('');
  const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [statBlockGroups, setStatBlockGroups] = useState<StatBlockGroup[]>([]);
  const [newStatGroupName, setNewStatGroupName] = useState('');
  const [selectedStatCharacterId, setSelectedStatCharacterId] = useState('');
  const [selectedStatEntityId, setSelectedStatEntityId] = useState('');
  const [statBlockInsertContent, setStatBlockInsertContent] = useState<string | null>(null);
  const [isStatPreferencesHydrated, setStatPreferencesHydrated] = useState(false);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [isMemoryModalOpen, setMemoryModalOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryScope, setMemoryScope] = useState<'document' | 'project'>(
    'document'
  );
  const [memoryFilter, setMemoryFilter] = useState('');
  const MEMORIES_PER_PAGE = 5;
  const seriesBibleConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const [guardrailIssues, setGuardrailIssues] = useState<GuardrailIssue[]>([]);
  const [resolvingUnknown, setResolvingUnknown] = useState<string | null>(null);
  const [linkingUnknown, setLinkingUnknown] = useState<string | null>(null);
  const [resolverNotice, setResolverNotice] = useState<ResolverNotice | null>(null);
  const [unknownLinkSelection, setUnknownLinkSelection] = useState<
    Record<string, string>
  >({});
  const [isRunningConsistencyReview, setIsRunningConsistencyReview] = useState(false);
  const [consistencyReviewItems, setConsistencyReviewItems] = useState<
    ConsistencyReviewItem[]
  >([]);
  const [lastConsistencyReviewAt, setLastConsistencyReviewAt] = useState<number | null>(
    null
  );
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isImportingDocuments, setIsImportingDocuments] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('balanced');
  const [skipImportSuggestions, setSkipImportSuggestions] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [retryImportFiles, setRetryImportFiles] = useState<File[]>([]);
  const [consistencyPopover, setConsistencyPopover] =
    useState<ConsistencyPopoverState | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isPromotingDocument, setIsPromotingDocument] = useState(false);
  const [isPromotingMemoryId, setIsPromotingMemoryId] = useState<string | null>(null);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isStatBlockModalOpen, setStatBlockModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportSelection, setExportSelection] = useState<SceneExportItem[]>([]);
  const [systemHistoryEntries, setSystemHistoryEntries] = useState<SystemHistoryEntry[]>([]);
  const [isSceneDrawerOpen, setSceneDrawerOpen] = useState(() =>
    typeof window !== 'undefined'
      ? !window.matchMedia('(max-width: 1200px)').matches
      : true
  );
  const [isContextDrawerOpen, setContextDrawerOpen] = useState(() =>
    typeof window !== 'undefined'
      ? !window.matchMedia('(max-width: 1200px)').matches
      : true
  );
  const [activeContextView, setActiveContextView] =
    useState<ContextDrawerView>('world-bible');
  const [isNarrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1200px)').matches
      : false
  );
  const [isDrawerPrefsHydrated, setDrawerPrefsHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__wbdWorkspaceMountedAt = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__wbdWorkspaceRenderCount = 0;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__wbdWorkspaceUnmountedAt = Date.now();
    };
  }, []);

  // Lightweight diagnostics only, no state updates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__wbdWorkspaceRenderCount =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__wbdWorkspaceRenderCount ?? 0) + 1;
  const toggleSceneDrawer = useCallback(() => {
    setSceneDrawerOpen((prev) => {
      const next = !prev;
      if (isNarrowViewport && next) {
        setContextDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport]);
  const toggleContextDrawer = useCallback(() => {
    setContextDrawerOpen((prev) => {
      const next = !prev;
      if (isNarrowViewport && next) {
        setSceneDrawerOpen(false);
      }
      return next;
    });
  }, [isNarrowViewport]);
  const openContextDrawer = useCallback(
    (view: ContextDrawerView) => {
      setActiveContextView(view);
      setContextDrawerOpen(true);
      if (isNarrowViewport) {
        setSceneDrawerOpen(false);
      }
    },
    [isNarrowViewport]
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutosaveErrorRef = useRef<string | null>(null);
  const canInsertStatBlock =
    (statBlockSourceType === 'character' && characterSheets.length > 0) ||
    (statBlockSourceType === 'item' && entities.length > 0);

  useEffect(() => {
    if (!consistencyPopover) return;
    const close = () => setConsistencyPopover(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [consistencyPopover]);

  const fileNameToTitle = (name: string): string => {
    const base = name.replace(/\.[^.]+$/, '').trim();
    return base || 'Imported scene';
  };

  const plainTextToHtml = (text: string): string => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) {
      return '<p></p>';
    }
    return paragraphs.map((chunk) => `<p>${chunk.replace(/\n/g, '<br />')}</p>`).join('');
  };

  const fileToHtml = (fileName: string, rawContent: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return rawContent.trim() || '<p></p>';
    }
    return plainTextToHtml(rawContent);
  };

  const readU16LE = (bytes: Uint8Array, offset: number): number =>
    bytes[offset] | (bytes[offset + 1] << 8);

  const readU32LE = (bytes: Uint8Array, offset: number): number =>
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>> 0;

  const findZipEntry = (
    bytes: Uint8Array
    ,
    matcher: (fileName: string) => boolean
  ): {
    fileName: string;
    compressionMethod: number;
    compressedData: Uint8Array;
  } | null => {
    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const localSignature = 0x04034b50;

    const minEocdSize = 22;
    const maxCommentLength = 0xffff;
    const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
    let eocdOffset = -1;
    for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
      if (readU32LE(bytes, i) === eocdSignature) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return null;

    const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
    const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (centralDirectoryEnd > bytes.length) return null;

    const decoder = new TextDecoder('utf-8');
    let cursor = centralDirectoryOffset;

    while (cursor + 46 <= centralDirectoryEnd) {
      if (readU32LE(bytes, cursor) !== centralSignature) {
        break;
      }
      const compressionMethod = readU16LE(bytes, cursor + 10);
      const compressedSize = readU32LE(bytes, cursor + 20);
      const fileNameLength = readU16LE(bytes, cursor + 28);
      const extraLength = readU16LE(bytes, cursor + 30);
      const commentLength = readU16LE(bytes, cursor + 32);
      const localHeaderOffset = readU32LE(bytes, cursor + 42);
      const fileNameStart = cursor + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      if (fileNameEnd > bytes.length) return null;

      const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
      cursor = fileNameEnd + extraLength + commentLength;

      if (!matcher(fileName)) continue;
      if (localHeaderOffset + 30 > bytes.length) return null;
      if (readU32LE(bytes, localHeaderOffset) !== localSignature) return null;

      const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
      const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) return null;

      return {
        fileName,
        compressionMethod,
        compressedData: bytes.slice(dataStart, dataEnd)
      };
    }

    return null;
  };

  const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
    const copy = new Uint8Array(compressedData.byteLength);
    copy.set(compressedData);
    const stream = new Blob([copy.buffer]).stream().pipeThrough(
      new DecompressionStream('deflate-raw')
    );
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  };

  const docxXmlToText = (xml: string): string => {
    const withBreaks = xml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<w:cr\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n\n');
    const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
    const parser = new DOMParser();
    const decoded = parser.parseFromString(
      `<!doctype html><body>${withoutTags}`,
      'text/html'
    ).body.textContent;
    return decoded?.trim() ?? '';
  };

  const parseDocxToText = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entry = findZipEntry(bytes, (fileName) => fileName === 'word/document.xml');
    if (!entry) {
      throw new Error('Could not read DOCX structure.');
    }

    let xmlBytes: Uint8Array;
    if (entry.compressionMethod === 0) {
      xmlBytes = entry.compressedData;
    } else if (entry.compressionMethod === 8) {
      xmlBytes = await inflateRaw(entry.compressedData);
    } else {
      throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
    }

    const xml = new TextDecoder('utf-8').decode(xmlBytes);
    return docxXmlToText(xml);
  };

  const htmlLikeToPlainText = (raw: string): string => {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(raw, 'text/html');
    return parsed.body.textContent?.replace(/\s+\n/g, '\n').trim() ?? '';
  };

  const parsePagesToText = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const preferredEntries = [
      'quicklook/preview.txt',
      'quicklook/preview.html',
      'quicklook/preview.htm',
      'index.xml'
    ];

    const entry = findZipEntry(bytes, (fileName) =>
      preferredEntries.includes(fileName.toLowerCase())
    );
    if (!entry) {
      throw new Error('No readable text preview found in .pages package.');
    }

    let payloadBytes: Uint8Array;
    if (entry.compressionMethod === 0) {
      payloadBytes = entry.compressedData;
    } else if (entry.compressionMethod === 8) {
      payloadBytes = await inflateRaw(entry.compressedData);
    } else {
      throw new Error(
        `Unsupported .pages entry compression method (${entry.compressionMethod}).`
      );
    }

    const raw = new TextDecoder('utf-8').decode(payloadBytes).trim();
    if (!raw) {
      throw new Error('Empty text payload in .pages package.');
    }

    const lowerName = entry.fileName.toLowerCase();
    if (lowerName.endsWith('.txt')) {
      return raw;
    }

    const normalized = htmlLikeToPlainText(raw);
    if (!normalized) {
      throw new Error('Unable to extract readable text from .pages payload.');
    }
    return normalized;
  };
  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    setMemories(sorted);
    emitShodhMemoriesUpdated(sorted);
  }, [shodhService]);

  const refreshSystemHistory = useCallback(() => {
    if (!activeProject) {
      setSystemHistoryEntries([]);
      return;
    }
    setSystemHistoryEntries(getSystemHistoryEntries(activeProject.id));
  }, [activeProject]);

  const addSystemHistory = useCallback(
    (input: {
      category: SystemHistoryEntry['category'];
      message: string;
      insertText?: string;
      sceneId?: string;
    }) => {
      if (!activeProject) return;
      appendSystemHistoryEntry(activeProject.id, input);
      refreshSystemHistory();
    },
    [activeProject, refreshSystemHistory]
  );

  const syncCompendiumSystemSignals = useCallback(async () => {
    if (!activeProject) return;
    const [logs, entries, progress] = await Promise.all([
      getCompendiumActionLogs(activeProject.id),
      getCompendiumEntriesByProject(activeProject.id),
      getCompendiumProgress(activeProject.id)
    ]);
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

    logs.slice(0, 80).forEach((log) => {
      const entry = entryMap.get(log.entryId);
      const action = entry?.actions.find((item) => item.id === log.actionId);
      const message = `Compendium action: ${entry?.name ?? 'Unknown entry'} · ${
        action?.label ?? log.actionId
      } (+${log.pointsAwarded} pts${log.quantity > 1 ? ` x${log.quantity}` : ''}).`;
      appendSystemHistoryEntry(activeProject.id, {
        category: 'resource',
        message,
        insertText: `System Update: ${message}`,
        sourceKey: `compendium-log:${log.id}`,
        createdAt: log.createdAt
      });
    });

    appendSystemHistoryEntry(activeProject.id, {
      category: 'quest',
      message:
        `Compendium progress: ${progress.totalPoints} total points, ` +
        `${progress.unlockedMilestoneIds.length} milestone(s), ` +
        `${progress.unlockedRecipeIds.length} recipe(s) unlocked.`,
      insertText:
        `Quest Progress: ${progress.totalPoints} points · ` +
        `${progress.unlockedMilestoneIds.length} milestones · ` +
        `${progress.unlockedRecipeIds.length} recipes.`,
      sourceKey: `compendium-progress:${progress.updatedAt}`,
      createdAt: progress.updatedAt
    });

    refreshSystemHistory();
  }, [activeProject, refreshSystemHistory]);

  // Load project-scoped data when project changes
  useEffect(() => {
    if (!activeProject) {
      setEditorConfig(null);
      setToolbarButtons([]);
      setProjectSettings(null);
      setEntities([]);
      setCategories([]);
      setAliases([]);
      setResolvedActionCues([]);
      setCharacters([]);
      setCharacterSheets([]);
      setRuleset(null);
      setSettlementState(null);
      setSettlementModules([]);
      setSelectedStatCharacterId('');
      setSelectedStatEntityId('');
      setStatBlockSourceType('character');
      setStatBlockStyle('full');
      setStatBlockInsertMode('block');
      setStatBlockScopePreset('all');
      setSelectedStatGroupId('');
      setSelectedStatIds([]);
      setSelectedResourceIds([]);
      setStatBlockGroups([]);
      setNewStatGroupName('');
      setStatPreferencesHydrated(false);
      setSystemHistoryEntries([]);
      return;
    }

    let cancelled = false;

    (async () => {
      await initializeDefaultCategories(activeProject.id);
      const [docs, settings, resolvedCues, loadedEntities, loadedCategories, loadedAliases, loadedCharacters, loadedSheets, loadedRuleset, loadedSettlementState, loadedSettlementModules] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getOrCreateSettings(activeProject.id),
        getResolvedConsistencyActionCues(activeProject),
        getEntitiesByProject(activeProject.id),
        getCategoriesByProject(activeProject.id),
        getAliasesByProject(activeProject.id),
        getCharactersByProject(activeProject.id),
        getCharacterSheetsByProject(activeProject.id),
        getRulesetByProjectId(activeProject.id),
        getOrCreateSettlementState(activeProject.id),
        getSettlementModulesByProject(activeProject.id)
      ]);

      if (cancelled) return;

      setDocuments(docs);
      setEditorConfig(createEditorConfigWithStyles(settings.characterStyles));
      setProjectSettings(settings);
      setImportMode(settings.defaultImportMode ?? 'balanced');
      setSkipImportSuggestions(settings.defaultSkipImportSuggestions ?? false);
      setResolvedActionCues(resolvedCues);
      setCategories(loadedCategories);
      setAliases(loadedAliases);
      setStatBlockSourceType(
        settings.statBlockPreferences?.sourceType ?? 'character'
      );
      setStatBlockStyle(settings.statBlockPreferences?.style ?? 'full');
      setStatBlockInsertMode(
        settings.statBlockPreferences?.insertMode ?? 'block'
      );
      setStatBlockScopePreset(
        settings.statBlockPreferences?.scopePreset ?? 'all'
      );
      setSelectedStatGroupId(
        settings.statBlockPreferences?.selectedGroupId ?? ''
      );
      setSelectedStatIds(settings.statBlockPreferences?.selectedStatIds ?? []);
      setSelectedResourceIds(
        settings.statBlockPreferences?.selectedResourceIds ?? []
      );
      setStatBlockGroups(settings.statBlockPreferences?.groups ?? []);
      setEntities(loadedEntities);
      setCharacters(loadedCharacters);
      setCharacterSheets(loadedSheets);
      setRuleset(loadedRuleset);
      setSettlementState(loadedSettlementState);
      setSettlementModules(loadedSettlementModules);
      setSelectedStatCharacterId(loadedSheets[0]?.id ?? '');
      setSelectedStatEntityId(loadedEntities[0]?.id ?? '');
      setStatPreferencesHydrated(true);
      setSystemHistoryEntries(getSystemHistoryEntries(activeProject.id));

      // Generate toolbar buttons from character styles
      const buttons = settings.characterStyles.map((style) => ({
        id: style.id,
        label: style.name,
        markName: style.markName
      }));
      setToolbarButtons(buttons);

      if (docs.length > 0) {
        const first = docs[0];
        setSelectedId(first.id);
        setSelectedCreatedAt(first.createdAt);
        setTitle(first.title);
        setContent(first.content);
        setSaveStatus('idle');
      } else {
        setSelectedId(null);
        setSelectedCreatedAt(null);
        setTitle('');
        setContent('');
        setSaveStatus('idle');
        setLastSavedAt(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !seriesBibleConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) {
        setCanonState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, seriesBibleConfig?.parentProjectId]);

  useEffect(() => {
    if (!activeProject) return;
    setDrawerPrefsHydrated(false);
    const key = `workspaceDrawers:${activeProject.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        if (isNarrowViewport) {
          setSceneDrawerOpen(false);
          setContextDrawerOpen(false);
        }
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WorkspaceDrawerPreferences>;
      if (isNarrowViewport) {
        setSceneDrawerOpen(false);
        setContextDrawerOpen(false);
      } else if (typeof parsed.leftDrawerOpen === 'boolean') {
        setSceneDrawerOpen(parsed.leftDrawerOpen);
      } else {
        setSceneDrawerOpen(true);
      }
      if (!isNarrowViewport && typeof parsed.rightDrawerOpen === 'boolean') {
        setContextDrawerOpen(parsed.rightDrawerOpen);
      } else if (!isNarrowViewport) {
        setContextDrawerOpen(true);
      }
      if (
        parsed.activeContextView === 'world-bible' ||
        parsed.activeContextView === 'ruleset' ||
        parsed.activeContextView === 'characters' ||
        parsed.activeContextView === 'compendium'
      ) {
        setActiveContextView(parsed.activeContextView);
      }
    } catch {
      // Ignore malformed local state and continue with defaults.
    } finally {
      setDrawerPrefsHydrated(true);
    }
  }, [activeProject, isNarrowViewport]);

  useEffect(() => {
    if (!activeProject || !isDrawerPrefsHydrated) return;
    const key = `workspaceDrawers:${activeProject.id}`;
    const payload: WorkspaceDrawerPreferences = {
      leftDrawerOpen: isSceneDrawerOpen,
      rightDrawerOpen: isContextDrawerOpen,
      activeContextView
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [
    activeProject,
    isDrawerPrefsHydrated,
    isSceneDrawerOpen,
    isContextDrawerOpen,
    activeContextView
  ]);

  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      setShodhService(null);
      return;
    }

    const bibleConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    const shodhOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;

    getRAGService(ragOptions).then((service) => {
      if (!cancelled) {
        setRagService(service);
      }
    });

    getShodhService(shodhOptions).then((service) => {
      if (!cancelled) {
        setShodhService(service);
      }
    });

    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeProject || !projectSettings || !isStatPreferencesHydrated) {
      return;
    }
    const currentPrefs = projectSettings.statBlockPreferences;
    const currentGroupsJson = JSON.stringify(currentPrefs?.groups ?? []);
    const nextGroupsJson = JSON.stringify(statBlockGroups);
    const currentStatIdsJson = JSON.stringify(currentPrefs?.selectedStatIds ?? []);
    const nextStatIdsJson = JSON.stringify(selectedStatIds);
    const currentResourceIdsJson = JSON.stringify(
      currentPrefs?.selectedResourceIds ?? []
    );
    const nextResourceIdsJson = JSON.stringify(selectedResourceIds);
    if (
      currentPrefs?.sourceType === statBlockSourceType &&
      currentPrefs?.style === statBlockStyle &&
      currentPrefs?.insertMode === statBlockInsertMode &&
      currentPrefs?.scopePreset === statBlockScopePreset &&
      (currentPrefs?.selectedGroupId ?? '') === selectedStatGroupId &&
      currentGroupsJson === nextGroupsJson &&
      currentStatIdsJson === nextStatIdsJson &&
      currentResourceIdsJson === nextResourceIdsJson
    ) {
      return;
    }
    const nextSettings: ProjectSettings = {
      ...projectSettings,
      statBlockPreferences: {
        sourceType: statBlockSourceType,
        style: statBlockStyle,
        insertMode: statBlockInsertMode,
        scopePreset: statBlockScopePreset,
        selectedGroupId: selectedStatGroupId,
        selectedStatIds: [...selectedStatIds],
        selectedResourceIds: [...selectedResourceIds],
        groups: statBlockGroups
      },
      updatedAt: Date.now()
    };
    setProjectSettings(nextSettings);
    void saveProjectSettings(nextSettings);
  }, [
    activeProject,
    projectSettings,
    statBlockSourceType,
    statBlockStyle,
    statBlockInsertMode,
    statBlockScopePreset,
    selectedStatGroupId,
    selectedStatIds,
    selectedResourceIds,
    statBlockGroups,
    isStatPreferencesHydrated
  ]);

  useEffect(() => {
    if (!activeProject) return;
    void syncCompendiumSystemSignals().catch(() => {
      // Compendium data is optional for some projects.
    });

    const onFocus = () => {
      void syncCompendiumSystemSignals().catch(() => {
        // Ignore sync errors from optional stores.
      });
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [activeProject, syncCompendiumSystemSignals]);

  useEffect(() => {
    if (!activeProject || !ragService) {
      return;
    }

    const vocabulary = [
      ...entities.map((entity) => ({
        id: entity.id,
        terms: [
          entity.name,
          ...Object.values(entity.fields)
            .filter((value): value is string => typeof value === 'string')
        ]
      })),
      ...characters.map((character) => ({
        id: character.id,
        terms: [
          character.name,
          character.fields?.role ?? '',
          character.fields?.notes ?? ''
        ].filter(Boolean) as string[]
      }))
    ];

    ragService.setEntityVocabulary(vocabulary);
  }, [activeProject, ragService, entities, characters]);

  const knownConsistencyEntities = useMemo(() => {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    return [
      ...entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: 'entity' as const
      })),
      ...characters.map((character) => ({
        id: character.id,
        name: character.name,
        type: 'character' as const
      })),
      ...aliases
        .map((alias) => {
          const linkedEntity = entityById.get(alias.entityId);
          if (!linkedEntity) {
            return null;
          }
          return {
            id: linkedEntity.id,
            name: alias.alias,
            type: 'entity' as const
          };
        })
        .filter((entry): entry is {id: string; name: string; type: 'entity'} => Boolean(entry))
    ];
  }, [aliases, characters, entities]);

  const resetEditor = () => {
    setSelectedId(null);
    setSelectedCreatedAt(null);
    setTitle('');
    setContent('');
    setSaveStatus('idle');
    setLastSavedAt(null);
  };

  const persistDoc = useCallback(async (
    doc: WritingDocument,
    options?: {
      source?: 'workspace-save' | 'workspace-autosave' | 'import';
      consistencyMode?: ImportMode;
    }
  ): Promise<{unresolvedCount: number; consistencyRun: boolean}> => {
    const source = options?.source ?? 'workspace-save';
    const consistencyMode = options?.consistencyMode ?? 'strict';
    let unresolvedCount = 0;

    if (consistencyMode !== 'lenient') {
      const proposal = await consistencyEngine.extractProposal({
        projectId: doc.projectId,
        text: htmlToPlainText(doc.content),
        source,
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues
      });
      const validation = await consistencyEngine.validateProposal(proposal);
      const presentedIssues =
        consistencyMode === 'strict'
          ? validation.issues
          : downgradeUnknownIssuesToWarnings(validation.issues);
      setGuardrailIssues(presentedIssues);
      unresolvedCount = validation.issues.filter(
        (issue) => issue.code === 'UNKNOWN_ENTITY'
      ).length;

      if (!validation.allowCommit && consistencyMode === 'strict') {
        const visibleUnknowns = validation.issues
          .map((issue) => issue.surface)
          .filter((surface): surface is string => Boolean(surface))
          .slice(0, 3);
        const suffix =
          validation.issues.length > 3
            ? ` (+${validation.issues.length - 3} more)`
            : '';
        const summary = visibleUnknowns.join(', ');
        throw new Error(
          `Commit blocked by consistency check: unknown ${validation.issues.length === 1 ? 'entity' : 'entities'} (${summary}${suffix}).`
        );
      }

      if (validation.allowCommit) {
        await consistencyEngine.applyProposal(proposal, validation);
      }
    }

    await saveWritingDocument(doc);

    try {
      if (ragService) {
        await ragService.indexDocument(
          doc.id,
          doc.title || 'Untitled scene',
          doc.content,
          'scene'
        );
      }
    } catch (error) {
      console.warn('RAG indexing failed for scene', doc.id, error);
    }

    try {
      if (shodhService) {
        await shodhService.captureAutoMemory({
          projectId: doc.projectId,
          documentId: doc.id,
          title: doc.title || 'Untitled scene',
          content: doc.content,
          tags: ['scene']
        });
        await refreshMemories();
      }
    } catch (error) {
      console.warn('Auto-memory capture failed for scene', doc.id, error);
    }

    setDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id);
      if (index === -1) {
        return [...prev, doc];
      }
      const copy = [...prev];
      copy[index] = doc;
      return copy;
    });

    setSelectedCreatedAt(doc.createdAt);
    setSaveStatus('saved');
    setLastSavedAt(Date.now());
    if (consistencyMode === 'strict') {
      setGuardrailIssues([]);
    }
    lastAutosaveErrorRef.current = null;
    return {
      unresolvedCount,
      consistencyRun: consistencyMode !== 'lenient'
    };
  }, [consistencyEngine, knownConsistencyEntities, resolvedActionCues, ragService, shodhService, refreshMemories]);

  const refreshDeferredReview = useCallback(async (doc: WritingDocument) => {
    const proposal = await consistencyEngine.extractProposal({
      projectId: doc.projectId,
      text: htmlToPlainText(doc.content),
      source: 'workspace-save',
      knownEntities: knownConsistencyEntities,
      actionCues: resolvedActionCues
    });
    const validation = await consistencyEngine.validateProposal(proposal);
    setGuardrailIssues(downgradeUnknownIssuesToWarnings(validation.issues));
  }, [consistencyEngine, knownConsistencyEntities, resolvedActionCues]);

  const resolveDocumentConsistencyMode = useCallback(
    (doc: WritingDocument): ImportMode =>
      doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'strict',
    []
  );

  const handleNewDocument = async () => {
    if (!activeProject) return;

    setIsCreatingScene(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const doc: WritingDocument = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        title: 'Untitled scene',
        content: '<p></p>',
        createdAt: now,
        updatedAt: now
      };

      await saveWritingDocument(doc);

      setDocuments((prev) => [...prev, doc]);
      setSelectedId(doc.id);
      setSelectedCreatedAt(doc.createdAt);
      setTitle(doc.title);
      setContent(doc.content);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setWordCount(0);
      setFeedback({tone: 'success', message: 'Created a new scene.'});
      addSystemHistory({
        category: 'scene',
        message: `Created scene "${doc.title}".`,
        insertText: `System Notice: Scene "${doc.title}" was created.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsCreatingScene(false);
    }
  };

  const runImportBatch = useCallback(async (files: File[]) => {
    if (!activeProject || files.length === 0) return;
    setIsImportingDocuments(true);
    setFeedback(null);
    setImportSummary(null);
    let importedCount = 0;
    let failedCount = 0;
    let unresolvedCount = 0;
    let lastImported: WritingDocument | null = null;
    const failures: ImportFailureItem[] = [];
    const failedFiles: File[] = [];
    const consistencyModeForBatch: ImportMode = skipImportSuggestions
      ? 'lenient'
      : importMode;

    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith('.doc')) {
            failedCount += 1;
            failures.push({fileName: file.name, reason: 'legacy-doc'});
            continue;
          }

          const raw = lower.endsWith('.docx')
            ? await parseDocxToText(file)
            : lower.endsWith('.pages')
              ? await parsePagesToText(file)
              : await file.text();
          const now = Date.now();
          const doc: WritingDocument = {
            id: crypto.randomUUID(),
            projectId: activeProject.id,
            title: fileNameToTitle(file.name),
            content: fileToHtml(file.name, raw),
            consistencyReviewMode:
              consistencyModeForBatch === 'strict' ? 'default' : 'deferred',
            createdAt: now,
            updatedAt: now
          };
          const result = await persistDoc(doc, {
            source: 'import',
            consistencyMode: consistencyModeForBatch
          });
          importedCount += 1;
          unresolvedCount += result.unresolvedCount;
          lastImported = doc;
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : 'Unknown import error.';
          failedCount += 1;
          failedFiles.push(file);
          failures.push({
            fileName: file.name,
            reason: lower.endsWith('.pages') ? 'apple-pages' : 'parse-failed',
            detail
          });
        }
      }

      if (lastImported) {
        setSelectedId(lastImported.id);
        setSelectedCreatedAt(lastImported.createdAt);
        setTitle(lastImported.title);
        setContent(lastImported.content);
        setWordCount(countWords(lastImported.content));
      }

      setImportSummary({
        importedCount,
        failedCount,
        unresolvedCount,
        mode: consistencyModeForBatch,
        suggestionsSkipped: consistencyModeForBatch === 'lenient',
        openedTitle: lastImported?.title,
        failures,
        createdAt: Date.now()
      });
      setRetryImportFiles(failedFiles);

      if (failedCount > 0) {
        const pageFailureCount = failures.filter(
          (item) => item.reason === 'apple-pages'
        ).length;
        setFeedback({
          tone: 'error',
          message:
            `Imported ${importedCount} document(s); ${failedCount} failed. ` +
            (pageFailureCount > 0
              ? 'For Apple Pages files, export as .docx or .txt from Pages, then import.'
              : failures[0]?.detail ??
                'Legacy .doc files are not supported yet. Convert to .docx, .txt, or .md.')
        });
      } else {
        setFeedback({
          tone: 'success',
          message:
            consistencyModeForBatch === 'lenient'
              ? `Imported ${importedCount} document(s). Consistency suggestions skipped for this import.`
              : `Imported ${importedCount} document(s). Unresolved entities: ${unresolvedCount}.`
        });
      }
    } finally {
      setIsImportingDocuments(false);
    }
  }, [activeProject, importMode, persistDoc, skipImportSuggestions]);

  const handleImportDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    await runImportBatch(Array.from(fileList));
    event.target.value = '';
  };

  const handleRetryFailedImports = async () => {
    if (retryImportFiles.length === 0) return;
    await runImportBatch(retryImportFiles);
  };

  const handleSelectDocument = (doc: WritingDocument) => {
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('idle');
    setWordCount(countWords(doc.content));
    setConsistencyPopover(null);
    if (doc.consistencyReviewMode === 'deferred') {
      void refreshDeferredReview(doc).catch((error) => {
        console.warn('Deferred review refresh failed', error);
      });
    } else {
      setGuardrailIssues([]);
    }
  };

  const handleRunConsistencyReview = useCallback(async () => {
    if (!activeProject) return;
    if (documents.length === 0) {
      setConsistencyReviewItems([]);
      setLastConsistencyReviewAt(Date.now());
      setFeedback({tone: 'error', message: 'No scenes available to review.'});
      addSystemHistory({
        category: 'consistency',
        message: 'Consistency review skipped: no scenes available.'
      });
      return;
    }

    setIsRunningConsistencyReview(true);
    setFeedback(null);
    try {
      const items: ConsistencyReviewItem[] = [];
      for (const doc of documents) {
        const proposal = await consistencyEngine.extractProposal({
          projectId: activeProject.id,
          text: htmlToPlainText(doc.content),
          source: 'workspace-save',
          knownEntities: knownConsistencyEntities,
          actionCues: resolvedActionCues
        });
        const validation = await consistencyEngine.validateProposal(proposal);
        validation.issues.forEach((issue, index) => {
          items.push({
            id: `${doc.id}:${issue.code}:${issue.surface ?? 'issue'}:${index}`,
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue
          });
        });
      }

      const contradictionItems = findCanonContradictions({
        documents,
        entities,
        characters,
        knownEntities: knownConsistencyEntities
      });
      const combinedItems = [...items, ...contradictionItems];

      setConsistencyReviewItems(combinedItems);
      setLastConsistencyReviewAt(Date.now());
      if (combinedItems.length === 0) {
        setFeedback({
          tone: 'success',
          message: `Consistency review complete: no issues across ${documents.length} scene(s).`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Consistency review complete with no issues across ${documents.length} scene(s).`
        });
      } else {
        const contradictionCount = contradictionItems.length;
        const firstSceneId = combinedItems[0]?.sceneId;
        setFeedback({
          tone: 'error',
          message:
            `Consistency review found ${combinedItems.length} issue(s) across ${documents.length} scene(s).` +
            (contradictionCount > 0
              ? ` ${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} with canon records.`
              : '')
        });
        addSystemHistory({
          category: 'consistency',
          message:
            `Consistency review found ${combinedItems.length} issue(s) across ${documents.length} scene(s).` +
            (contradictionCount > 0
              ? ` ${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} with canon records.`
              : ''),
          sceneId: firstSceneId
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to run consistency review.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsRunningConsistencyReview(false);
    }
  }, [
    activeProject,
    characters,
    consistencyEngine,
    documents,
    entities,
    knownConsistencyEntities,
    resolvedActionCues,
    addSystemHistory
  ]);

  const openWorldRecord = (target: {id: string; type: 'character' | 'entity'}) => {
    if (target.type === 'entity') {
      navigate('/world-bible', {state: {focusEntityId: target.id}});
      return;
    }
    navigate('/characters');
  };

  const openExportModal = (format: ExportFormat) => {
    const selection = documents.map((doc) => ({
      id: doc.id,
      title: doc.title || 'Untitled scene',
      included: true
    }));
    setExportSelection(selection);
    setExportFormat(format);
    setExportModalOpen(true);
  };

  const closeExportModal = () => {
    setExportModalOpen(false);
  };

  const closeStatBlockModal = () => {
    setStatBlockModalOpen(false);
  };

  useEffect(() => {
    if (!isStatBlockModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStatBlockModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStatBlockModalOpen]);

  const moveExportItem = (id: string, direction: -1 | 1) => {
    setExportSelection((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const toggleExportItem = (id: string) => {
    setExportSelection((prev) =>
      prev.map((item) =>
        item.id === id ? {...item, included: !item.included} : item
      )
    );
  };

  const toggleAllExportItems = (included: boolean) => {
    setExportSelection((prev) => prev.map((item) => ({...item, included})));
  };

  const handleExportScenes = () => {
    if (!activeProject) return;

    const selectedIds = exportSelection
      .filter((item) => item.included)
      .map((item) => item.id);
    const selectedScenes = selectedIds
      .map((id) => documents.find((doc) => doc.id === id))
      .filter((doc): doc is WritingDocument => Boolean(doc));

    if (selectedScenes.length === 0) {
      setFeedback({tone: 'error', message: 'Select at least one scene to export.'});
      return;
    }

    if (exportFormat === 'markdown') {
      exportScenesAsMarkdown({
        projectName: activeProject.name,
        scenes: selectedScenes
      });
    } else if (exportFormat === 'docx') {
      exportScenesAsDocx({
        projectName: activeProject.name,
        scenes: selectedScenes
      });
    } else {
      exportScenesAsEpub({
        projectName: activeProject.name,
        scenes: selectedScenes
      });
    }

    setExportModalOpen(false);
    const exportMessage =
      exportFormat === 'markdown'
        ? `Exported ${selectedScenes.length} scene(s) to Markdown.`
        : exportFormat === 'docx'
          ? `Exported ${selectedScenes.length} scene(s) to DOCX.`
          : `Exported ${selectedScenes.length} scene(s) to EPUB.`;
    setFeedback({
      tone: 'success',
      message: exportMessage
    });
    addSystemHistory({
      category: 'system',
      message: exportMessage,
      insertText: `System Export: ${exportMessage}`
    });
  };

  const handleSave = async () => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const nextTitle = title.trim() || 'Untitled scene';
    if (
      existingDocument &&
      existingDocument.title === nextTitle &&
      existingDocument.content === content
    ) {
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      setFeedback({tone: 'success', message: 'Scene already saved.'});
      return;
    }

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: nextTitle,
      content,
      consistencyReviewMode: existingDocument?.consistencyReviewMode ?? 'default',
      createdAt,
      updatedAt: now
    };

    setSaveStatus('saving');
    setFeedback(null);
    try {
      await persistDoc(doc, {
        source: 'workspace-save',
        consistencyMode: resolveDocumentConsistencyMode(doc)
      });
      setFeedback({tone: 'success', message: 'Scene saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save scene.';
      setSaveStatus('idle');
      setFeedback({tone: 'error', message});
    }
  };

  const handleDelete = async (doc: WritingDocument) => {
    const confirmed = window.confirm(`Delete "${doc.title || 'Untitled scene'}"?`);
    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    setFeedback(null);
    try {
      await deleteWritingDocument(doc.id);
      await Promise.all([
        ragService?.deleteDocument(doc.id) ?? Promise.resolve(),
        shodhService?.deleteMemoriesForDocument(doc.id) ?? Promise.resolve()
      ]);
      await refreshMemories();
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

      if (selectedId === doc.id) {
        resetEditor();
      }
      setFeedback({tone: 'success', message: 'Scene deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    setSaveStatus('idle');
    setGuardrailIssues([]);
    setConsistencyPopover(null);
    setWordCount(countWords(html));
  };

  const unknownGuardrailIssues = useMemo(() => {
    const seen = new Set<string>();
    return guardrailIssues
      .filter((issue) => issue.code === 'UNKNOWN_ENTITY' && Boolean(issue.surface))
      .filter((issue) => {
        const key = (issue.surface ?? '').trim().toLowerCase();
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }, [guardrailIssues]);

  const hasBlockingUnknownGuardrailIssues = useMemo(
    () => unknownGuardrailIssues.some((issue) => issue.severity === 'blocking'),
    [unknownGuardrailIssues]
  );

  const highlightableUnknownIssues = useMemo(
    () =>
      unknownGuardrailIssues.map((issue) => ({
        id: `${issue.code}:${issue.surface ?? ''}`,
        surface: issue.surface ?? '',
        message: issue.message,
        severity: issue.severity
      })),
    [unknownGuardrailIssues]
  );

  const unknownLinkOptions = useMemo(() => {
    const optionMap: Record<string, WorldEntity[]> = {};
    unknownGuardrailIssues.forEach((issue) => {
      const surface = (issue.surface ?? '').trim();
      if (!surface) return;
      const normalizedSurface = surface.toLowerCase();
      const filtered = entities.filter((entity) => {
        const normalizedName = entity.name.toLowerCase();
        if (normalizedName === normalizedSurface) {
          return true;
        }
        return (
          normalizedName.includes(normalizedSurface) ||
          normalizedSurface.includes(normalizedName)
        );
      });
      const ranked = [...filtered].sort((a, b) => {
        const aExact = a.name.toLowerCase() === normalizedSurface ? 0 : 1;
        const bExact = b.name.toLowerCase() === normalizedSurface ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aIncludes = a.name.toLowerCase().includes(normalizedSurface) ? 0 : 1;
        const bIncludes = b.name.toLowerCase().includes(normalizedSurface) ? 0 : 1;
        if (aIncludes !== bIncludes) return aIncludes - bIncludes;
        return a.name.localeCompare(b.name);
      });
      optionMap[surface] = ranked.slice(0, 20);
    });
    return optionMap;
  }, [unknownGuardrailIssues, entities]);

  const resolveUnknownEntity = useCallback(async (surface: string) => {
    if (!activeProject) return;

    const normalized = surface.trim();
    if (!normalized) return;

    setResolvingUnknown(surface);
    setFeedback(null);
    try {
      let availableCategories = categories;
      if (availableCategories.length === 0) {
        await initializeDefaultCategories(activeProject.id);
        availableCategories = await getCategoriesByProject(activeProject.id);
        setCategories(availableCategories);
      }

      const preferredCategory =
        availableCategories.find((category) =>
          ['items', 'characters', 'locations'].includes(category.slug)
        ) ?? availableCategories[0];

      if (!preferredCategory) {
        throw new Error('No categories available for entity creation.');
      }

      const now = Date.now();
      const entity: WorldEntity = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        categoryId: preferredCategory.id,
        name: normalized,
        fields: {},
        links: [],
        createdAt: now,
        updatedAt: now
      };
      await saveEntity(entity);
      setEntities((prev) => [...prev, entity]);
      setGuardrailIssues((prev) =>
        prev.filter(
          (issue) => issue.surface?.trim().toLowerCase() !== normalized.toLowerCase()
        )
      );
      setUnknownLinkSelection((prev) => {
        const copy = {...prev};
        delete copy[surface];
        return copy;
      });
      setConsistencyPopover((prev) =>
        prev?.surface.trim().toLowerCase() === normalized.toLowerCase() ? null : prev
      );
      setFeedback({
        tone: 'success',
        message: `Entity "${normalized}" created in ${preferredCategory.name}. Save again to validate.`
      });
      setResolverNotice({
        message: `Entity "${normalized}" created.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create entity.';
      setFeedback({tone: 'error', message});
    } finally {
      setResolvingUnknown(null);
    }
  }, [activeProject, categories]);

  const resolveAllUnknownEntities = useCallback(async () => {
    const surfaces = unknownGuardrailIssues
      .map((issue) => issue.surface?.trim())
      .filter((surface): surface is string => Boolean(surface));
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      await resolveUnknownEntity(surface);
    }
  }, [unknownGuardrailIssues, resolveUnknownEntity]);

  const dismissAllUnknownEntities = useCallback(() => {
    const blocked = new Set(
      unknownGuardrailIssues
        .map((issue) => issue.surface?.trim().toLowerCase())
        .filter((surface): surface is string => Boolean(surface))
    );
    setGuardrailIssues((prev) =>
      prev.filter((issue) => {
        const surface = issue.surface?.trim().toLowerCase();
        return !surface || !blocked.has(surface);
      })
    );
    setFeedback({
      tone: 'success',
      message: 'Unknown entity warnings dismissed for now.'
    });
  }, [unknownGuardrailIssues]);

  const dismissUnknownEntity = useCallback((surface: string) => {
    const normalized = surface.trim().toLowerCase();
    if (!normalized) return;
    setGuardrailIssues((prev) =>
      prev.filter((issue) => issue.surface?.trim().toLowerCase() !== normalized)
    );
    setConsistencyPopover((prev) =>
      prev?.surface.trim().toLowerCase() === normalized ? null : prev
    );
  }, []);

  const linkUnknownEntity = useCallback(
    async (surface: string, explicitEntityId?: string) => {
      if (!activeProject) return;
      const selectedEntityId = explicitEntityId ?? unknownLinkSelection[surface];
      if (!selectedEntityId) {
        setFeedback({
          tone: 'error',
          message: `Select an entity before linking "${surface}".`
        });
        return;
      }

      setLinkingUnknown(surface);
      setFeedback(null);
      try {
        const saved = await saveAlias({
          projectId: activeProject.id,
          entityId: selectedEntityId,
          alias: surface
        });
        setAliases((prev) => {
          const existingIndex = prev.findIndex((entry) => entry.id === saved.id);
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = saved;
            return copy;
          }
          return [...prev, saved];
        });
        setGuardrailIssues((prev) =>
          prev.filter(
            (issue) => issue.surface?.trim().toLowerCase() !== surface.trim().toLowerCase()
          )
        );
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          prev?.surface.trim().toLowerCase() === surface.trim().toLowerCase() ? null : prev
        );
        setFeedback({
          tone: 'success',
          message: `Linked alias "${surface}" to existing entity. Save again to validate.`
        });
        setResolverNotice({
          message: `Alias "${surface}" linked to existing entity.`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to link alias.';
        setFeedback({tone: 'error', message});
      } finally {
        setLinkingUnknown(null);
      }
    },
    [activeProject, unknownLinkSelection]
  );

  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }),
    [characters]
  );
  const runtimeModifiers = useMemo(
    () =>
      deriveCharacterRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      }),
    [settlementState, settlementModules, activePartySynergies]
  );

  useEffect(() => {
    if (!activeProject) return;
    const activeRules = activePartySynergies
      .filter((item) => item.missingRoles.length === 0)
      .map((item) => item.ruleId)
      .sort();
    if (activeRules.length === 0) return;

    const message =
      activeRules.length === 1
        ? 'Quest hook available from an active party synergy combo.'
        : `Quest hooks available from ${activeRules.length} active party synergy combos.`;

    appendSystemHistoryEntry(activeProject.id, {
      category: 'quest',
      message,
      insertText: `Quest Update: ${message}`,
      sourceKey: `party-synergy:${activeRules.join('|')}`,
      createdAt: Date.now()
    });
    refreshSystemHistory();
  }, [activeProject, activePartySynergies, refreshSystemHistory]);
  const statDefinitionNameById = useMemo(() => {
    const map = new Map<string, string>();
    ruleset?.statDefinitions.forEach((def) => {
      map.set(def.id, def.name);
    });
    return map;
  }, [ruleset]);
  const resourceDefinitionNameById = useMemo(() => {
    const map = new Map<string, string>();
    ruleset?.resourceDefinitions.forEach((def) => {
      map.set(def.id, def.name);
    });
    return map;
  }, [ruleset]);
  const selectedSheet =
    characterSheets.find((sheet) => sheet.id === selectedStatCharacterId) ?? null;
  const selectedEntity =
    entities.find((entity) => entity.id === selectedStatEntityId) ?? null;
  const activeProjectMode = projectSettings?.projectMode ?? 'litrpg';
  const showGameSystems =
    projectSettings?.featureToggles.enableGameSystems !== false;
  const availableStatIds = useMemo(
    () => (selectedSheet ? selectedSheet.stats.map((stat) => stat.definitionId) : []),
    [selectedSheet]
  );
  const availableResourceIds = useMemo(
    () =>
      selectedSheet
        ? selectedSheet.resources.map((resource) => resource.definitionId)
        : [],
    [selectedSheet]
  );
  const availableStatIdSet = useMemo(
    () => new Set(availableStatIds),
    [availableStatIds]
  );
  const availableResourceIdSet = useMemo(
    () => new Set(availableResourceIds),
    [availableResourceIds]
  );

  useEffect(() => {
    setSelectedStatIds((prev) => prev.filter((id) => availableStatIdSet.has(id)));
  }, [availableStatIdSet]);

  useEffect(() => {
    setSelectedResourceIds((prev) =>
      prev.filter((id) => availableResourceIdSet.has(id))
    );
  }, [availableResourceIdSet]);

  const selectedStatGroup = useMemo(
    () => statBlockGroups.find((group) => group.id === selectedStatGroupId) ?? null,
    [statBlockGroups, selectedStatGroupId]
  );

  const resolveCharacterSelection = useCallback(() => {
    if (statBlockScopePreset === 'all') {
      return {
        selectedStatIds: undefined,
        selectedResourceIds: undefined
      };
    }
    if (statBlockScopePreset === 'stats') {
      return {
        selectedStatIds: availableStatIds,
        selectedResourceIds: []
      };
    }
    if (statBlockScopePreset === 'resources') {
      return {
        selectedStatIds: [],
        selectedResourceIds: availableResourceIds
      };
    }
    if (selectedStatGroup) {
      return {
        selectedStatIds: selectedStatGroup.statIds.filter((id) =>
          availableStatIdSet.has(id)
        ),
        selectedResourceIds: selectedStatGroup.resourceIds.filter((id) =>
          availableResourceIdSet.has(id)
        )
      };
    }
    return {
      selectedStatIds: selectedStatIds.filter((id) => availableStatIdSet.has(id)),
      selectedResourceIds: selectedResourceIds.filter((id) =>
        availableResourceIdSet.has(id)
      )
    };
  }, [
    statBlockScopePreset,
    availableStatIds,
    availableResourceIds,
    selectedStatGroup,
    selectedStatIds,
    selectedResourceIds,
    availableStatIdSet,
    availableResourceIdSet
  ]);

  const resolveCharacterBlock = useCallback(
    (
      sheet: CharacterSheet,
      style: StatBlockStyle,
      selection?: {selectedStatIds?: string[]; selectedResourceIds?: string[]}
    ): string => {
      const selectedStatSet = selection?.selectedStatIds
        ? new Set(selection.selectedStatIds)
        : null;
      const selectedResourceSet = selection?.selectedResourceIds
        ? new Set(selection.selectedResourceIds)
        : null;
      const effectiveLevel = Math.max(1, sheet.level + runtimeModifiers.levelBonus);
      return buildCharacterStatBlockHtml(
        {
          name: sheet.name,
          level: sheet.level,
          effectiveLevel,
          experience: sheet.experience,
          stats: sheet.stats
            .filter((stat) =>
              selectedStatSet ? selectedStatSet.has(stat.definitionId) : true
            )
            .map((stat) => {
              const effective = getEffectiveStatValue({
                definitionId: stat.definitionId,
                baseValue: stat.value,
                runtime: runtimeModifiers
              });
              const modifierNotes = (stat.modifiers ?? [])
                .map((modifier) =>
                  modifier.type === 'multiplier'
                    ? `${modifier.source} x${modifier.value}`
                    : `${modifier.source} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`
                )
                .join(', ');
              return {
                name: statDefinitionNameById.get(stat.definitionId) ?? stat.definitionId,
                baseValue: stat.value,
                effectiveValue: effective,
                modifierNotes
              };
            }),
          resources: sheet.resources
            .filter((resource) =>
              selectedResourceSet ? selectedResourceSet.has(resource.definitionId) : true
            )
            .map((resource) => {
              const effective = getEffectiveResourceValues({
                definitionId: resource.definitionId,
                current: resource.current,
                max: resource.max,
                runtime: runtimeModifiers
              });
              return {
                name:
                  resourceDefinitionNameById.get(resource.definitionId) ??
                  resource.definitionId,
                current: resource.current,
                max: resource.max,
                effectiveCurrent: effective.current,
                effectiveMax: effective.max
              };
            }),
          activeNotes: runtimeModifiers.notes
        },
        style
      );
    },
    [runtimeModifiers, statDefinitionNameById, resourceDefinitionNameById]
  );

  const resolveItemBlock = useCallback(
    (entity: WorldEntity, style: StatBlockStyle): string => {
      return buildItemStatBlockHtml(
        {
          name: entity.name,
          fields: Object.entries(entity.fields)
            .map(([key, value]) => ({
              key,
              value: formatEntityFieldValue(value)
            }))
            .filter((entry) => Boolean(entry.value))
        },
        style
      );
    },
    []
  );

  const selectionQuickSnippets = useMemo(() => {
    if (!activeProject) {
      return {characters: {}, entities: {}};
    }
    const normalize = (input: string) =>
      input
        .trim()
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const characterById = new Map(characters.map((character) => [character.id, character]));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const recentSystemMessageFor = (name: string): string => {
      const normalized = name.trim().toLowerCase();
      const match = systemHistoryEntries.find((entry) =>
        entry.message.toLowerCase().includes(normalized)
      );
      return match?.message ?? 'No recent linked system event.';
    };

    const buildCharacterLore = (sheet: CharacterSheet): LoreInspectorRecord => {
      const character = sheet.characterId ? characterById.get(sheet.characterId) : null;
      const role =
        typeof character?.fields.role === 'string' && character.fields.role.trim()
          ? character.fields.role.trim()
          : 'Unassigned class';
      const statuses = (sheet.statuses ?? []).slice(0, 2);
      const faction =
        typeof character?.fields.faction === 'string' && character.fields.faction.trim()
          ? character.fields.faction.trim()
          : 'Unknown faction';
      const cached = getCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof character?.fields.goal === 'string' && character.fields.goal.trim()) ||
            'No explicit active goal recorded.',
          recentEvent: recentSystemMessageFor(sheet.name),
          motivation:
            (typeof character?.fields.motivation === 'string' &&
              character.fields.motivation.trim()) ||
            character?.description?.trim() ||
            'No explicit motivation captured yet.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt, synopsis);
      }
      return {
        type: 'character',
        id: sheet.id,
        name: sheet.name,
        vitalSigns: [
          `Level ${sheet.level}`,
          role,
          statuses.length > 0 ? statuses.join(', ') : 'No active buffs/debuffs',
          `Faction: ${faction}`
        ],
        synopsis
      };
    };

    const buildEntityLore = (entity: WorldEntity): LoreInspectorRecord => {
      const categoryName = categoryNameById.get(entity.categoryId) ?? 'Entity';
      const status =
        typeof entity.fields.status === 'string' && entity.fields.status.trim()
          ? entity.fields.status.trim()
          : 'State unknown';
      const cached = getCachedSynopsis(activeProject.id, entity.id, entity.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof entity.fields.goal === 'string' && entity.fields.goal.trim()) ||
            `Track relevance of ${entity.name} in this scene.`,
          recentEvent: recentSystemMessageFor(entity.name),
          motivation:
            (typeof entity.fields.motivation === 'string' &&
              entity.fields.motivation.trim()) ||
            (typeof entity.fields.notes === 'string' && entity.fields.notes.trim()) ||
            'No motivation/secret recorded.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, entity.id, entity.updatedAt, synopsis);
      }
      return {
        type: 'entity',
        id: entity.id,
        name: entity.name,
        vitalSigns: [categoryName, status],
        synopsis
      };
    };

    const characterEntries: Array<
      [string, {name: string; html: string; lore: LoreInspectorRecord}]
    > = [];
    const entityEntries: Array<
      [string, {name: string; html: string; lore: LoreInspectorRecord}]
    > = [];
    const surnameCandidates = new Map<string, Array<{
      bucket: 'characters' | 'entities';
      entry: {name: string; html: string; lore: LoreInspectorRecord};
    }>>();

    const registerEntry = (
      bucket: 'characters' | 'entities',
      label: string,
      entry: {name: string; html: string; lore: LoreInspectorRecord}
    ) => {
      const key = normalize(label);
      if (!key) return;
      if (bucket === 'characters') {
        characterEntries.push([key, entry]);
      } else {
        entityEntries.push([key, entry]);
      }

      const tokens = label.trim().split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return;
      const trailing = normalize(tokens[tokens.length - 1] ?? '');
      if (!trailing || trailing.length < 4) return;
      const existing = surnameCandidates.get(trailing) ?? [];
      existing.push({bucket, entry});
      surnameCandidates.set(trailing, existing);
    };

    characterSheets.forEach((sheet) => {
      const entry = {
        name: sheet.name,
        html: resolveCharacterBlock(sheet, 'compact'),
        lore: buildCharacterLore(sheet)
      };
      registerEntry('characters', sheet.name, entry);
    });

    entities.forEach((entity) => {
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', entity.name, entry);
    });

    aliases.forEach((alias) => {
      const entity = entityById.get(alias.entityId);
      if (!entity) return;
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', alias.alias, entry);
    });

    surnameCandidates.forEach((matches, trailing) => {
      if (matches.length !== 1) return;
      const [match] = matches;
      if (!match) return;
      if (match.bucket === 'characters') {
        characterEntries.push([trailing, match.entry]);
      } else {
        entityEntries.push([trailing, match.entry]);
      }
    });

    return {
      characters: Object.fromEntries(characterEntries),
      entities: Object.fromEntries(entityEntries)
    };
  }, [
    activeProject,
    aliases,
    categories,
    characters,
    characterSheets,
    entities,
    resolveCharacterBlock,
    resolveItemBlock,
    systemHistoryEntries
  ]);

  const resolveTemplateToBlock = useCallback(
    (
      sourceType: StatBlockSourceType,
      sourceRef: string,
      style: StatBlockStyle,
      selection?: {selectedStatIds?: string[]; selectedResourceIds?: string[]}
    ): string | null => {
      if (sourceType === 'character') {
        const normalizedRef = sourceRef.trim().toLowerCase();
        const sheet =
          characterSheets.find((candidate) => candidate.id === sourceRef) ??
          characterSheets.find(
            (candidate) => candidate.name.trim().toLowerCase() === normalizedRef
          );
        return sheet ? resolveCharacterBlock(sheet, style, selection) : null;
      }
      const normalizedRef = sourceRef.trim().toLowerCase();
      const entity =
        entities.find((candidate) => candidate.id === sourceRef) ??
        entities.find(
          (candidate) => candidate.name.trim().toLowerCase() === normalizedRef
        );
      return entity ? resolveItemBlock(entity, style) : null;
    },
    [characterSheets, entities, resolveCharacterBlock, resolveItemBlock]
  );

  const handleRefreshStatTemplates = () => {
    const result = replaceStatBlockTokensInHtml(content, (token) =>
      resolveTemplateToBlock(token.sourceType, token.sourceRef, token.style, {
        selectedStatIds: token.selectedStatIds,
        selectedResourceIds: token.selectedResourceIds
      })
    );
    if (result.replacedCount === 0) {
      setFeedback({
        tone: 'error',
        message: 'No matching STAT_BLOCK templates found to refresh.'
      });
      return;
    }
    setContent(result.html);
    setSaveStatus('idle');
    setWordCount(countWords(result.html));
    setFeedback({
      tone: 'success',
      message: `Refreshed ${result.replacedCount} stat block template(s).`
    });
    addSystemHistory({
      category: 'system',
      message: `Refreshed ${result.replacedCount} stat block template(s).`,
      insertText: `System Update: Refreshed ${result.replacedCount} stat templates in scene text.`
    });
  };

  const handleInsertStatBlock = () => {
    const characterSelection = resolveCharacterSelection();
    const hasCharacterSelection =
      statBlockScopePreset === 'all' ||
      ((characterSelection.selectedStatIds?.length ?? 0) > 0 ||
        (characterSelection.selectedResourceIds?.length ?? 0) > 0);
    if (statBlockSourceType === 'character' && !hasCharacterSelection) {
      setFeedback({
        tone: 'error',
        message: 'Select at least one stat or resource for this status block.'
      });
      return;
    }

    const token =
      statBlockSourceType === 'character'
        ? selectedSheet
          ? createStatBlockToken({
              sourceType: 'character',
              sourceRef: selectedSheet.name.trim() || selectedSheet.id,
              style: statBlockStyle,
              selectedStatIds: characterSelection.selectedStatIds,
              selectedResourceIds: characterSelection.selectedResourceIds
            })
          : null
        : selectedEntity
          ? createStatBlockToken({
              sourceType: 'item',
              sourceRef: selectedEntity.name.trim() || selectedEntity.id,
              style: statBlockStyle
            })
          : null;
    const html =
      statBlockSourceType === 'character'
        ? selectedSheet
          ? resolveCharacterBlock(selectedSheet, statBlockStyle, characterSelection)
          : null
        : selectedEntity
          ? resolveItemBlock(selectedEntity, statBlockStyle)
          : null;

    if (!html || !token) {
      setFeedback({
        tone: 'error',
        message:
          statBlockSourceType === 'character'
            ? 'Select a character sheet to insert.'
            : 'Select an item/entity to insert.'
      });
      return;
    }

    const shouldInsertAsTemplate =
      statBlockInsertMode === 'template' && activeProjectMode !== 'litrpg';
    setStatBlockInsertContent(
      shouldInsertAsTemplate ? `<p>${token}</p>` : html
    );
    setStatBlockModalOpen(false);
    setFeedback({
      tone: 'success',
      message:
        shouldInsertAsTemplate
          ? 'Inserted STAT_BLOCK template token.'
          : statBlockInsertMode === 'template' && activeProjectMode === 'litrpg'
            ? 'Inserted live status block (LitRPG mode auto-resolves placeholders).'
            : 'Inserted status block into scene.'
    });

    if (statBlockSourceType === 'character' && selectedSheet) {
      const resourcePreview = selectedSheet.resources
        .slice(0, 2)
        .map((resource) => `${resource.definitionId}: ${resource.current}/${resource.max}`)
        .join(', ');
      const message =
        `Status block inserted for ${selectedSheet.name} (Lv ${selectedSheet.level}, ${selectedSheet.experience} XP)` +
        (resourcePreview ? ` · ${resourcePreview}` : '.');
      addSystemHistory({
        category: 'resource',
        message,
        insertText: `System Status: ${message}`
      });
    } else if (statBlockSourceType === 'item' && selectedEntity) {
      addSystemHistory({
        category: 'system',
        message: `Status block inserted for entity "${selectedEntity.name}".`,
        insertText: `System Status: Entity "${selectedEntity.name}" record inserted into scene.`
      });
    }
  };

  const handleToggleStatSelection = (statId: string) => {
    setSelectedStatIds((prev) =>
      prev.includes(statId) ? prev.filter((id) => id !== statId) : [...prev, statId]
    );
    setStatBlockScopePreset('custom');
    setSelectedStatGroupId('');
  };

  const handleToggleResourceSelection = (resourceId: string) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
    setStatBlockScopePreset('custom');
    setSelectedStatGroupId('');
  };

  const handleSaveStatGroup = () => {
    const name = newStatGroupName.trim();
    const selection = resolveCharacterSelection();
    const statIds = selection.selectedStatIds ?? [];
    const resourceIds = selection.selectedResourceIds ?? [];
    if (!name) {
      setFeedback({tone: 'error', message: 'Enter a group name first.'});
      return;
    }
    if (statIds.length === 0 && resourceIds.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'Choose at least one stat/resource before saving a group.'
      });
      return;
    }
    const existing = statBlockGroups.find(
      (group) => group.name.trim().toLowerCase() === name.toLowerCase()
    );
    const nextGroup: StatBlockGroup = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      statIds,
      resourceIds
    };
    setStatBlockGroups((prev) => {
      if (existing) {
        return prev.map((group) => (group.id === existing.id ? nextGroup : group));
      }
      return [...prev, nextGroup];
    });
    setSelectedStatGroupId(nextGroup.id);
    setStatBlockScopePreset('custom');
    setNewStatGroupName('');
    setFeedback({
      tone: 'success',
      message: existing
        ? `Updated stat group "${name}".`
        : `Saved stat group "${name}".`
    });
  };

  const handleDeleteStatGroup = (groupId: string) => {
    const group = statBlockGroups.find((entry) => entry.id === groupId);
    setStatBlockGroups((prev) => prev.filter((entry) => entry.id !== groupId));
    if (selectedStatGroupId === groupId) {
      setSelectedStatGroupId('');
      setStatBlockScopePreset('all');
    }
    if (group) {
      setFeedback({tone: 'success', message: `Deleted stat group "${group.name}".`});
    }
  };

  const activeCharacterSelection = resolveCharacterSelection();
  const activeSelectedStatSet = new Set(activeCharacterSelection.selectedStatIds ?? []);
  const activeSelectedResourceSet = new Set(
    activeCharacterSelection.selectedResourceIds ?? []
  );
  const statBlockScopeValue = selectedStatGroup
    ? `group:${selectedStatGroup.id}`
    : statBlockScopePreset;

  const selectedDocument = selectedId
    ? documents.find((doc) => doc.id === selectedId)
    : null;
  const activeConsistencyPopoverIssue = consistencyPopover
    ? highlightableUnknownIssues.find((issue) => issue.id === consistencyPopover.issueId) ?? null
    : null;
  const selectedDocumentMemories = selectedId
    ? memories.filter((memory) => memory.documentId === selectedId)
    : [];
  const memoryCandidates =
    memoryScope === 'document' ? selectedDocumentMemories : memories;
  const scopeLabel =
    memoryScope === 'document' ? 'this scene' : 'the project';
  const emptyMemoryMessage =
    memoryScope === 'document'
      ? 'No memories captured for this scene yet.'
      : 'Project memories will appear here as you capture them.';

  const openMemoryModal = () => {
    if (!selectedDocument) return;
    setMemoryDraft(summarizeContent(selectedDocument.content));
    setMemoryModalOpen(true);
  };

  const updateSelectedDocumentConsistencyReviewMode = useCallback(
    async (mode: 'default' | 'deferred') => {
      if (!selectedDocument) return;
      const nextDocument: WritingDocument = {
        ...selectedDocument,
        consistencyReviewMode: mode,
        updatedAt: Date.now()
      };
      await saveWritingDocument(nextDocument);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === nextDocument.id ? nextDocument : doc))
      );
      setFeedback({
        tone: 'success',
        message:
          mode === 'deferred'
            ? 'Scene set to review later. Saves will warn instead of block.'
            : 'Scene set to strict consistency review.'
      });
    },
    [selectedDocument]
  );

  useEffect(() => {
    if (!showGameSystems && activeContextView === 'compendium') {
      setActiveContextView('world-bible');
    }
  }, [showGameSystems, activeContextView]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1200px)');
    const update = () => setNarrowViewport(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport) return;
    setSceneDrawerOpen(false);
    setContextDrawerOpen(false);
  }, [isNarrowViewport]);

  useEffect(() => {
    if (!isNarrowViewport || (!isContextDrawerOpen && !isSceneDrawerOpen)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isContextDrawerOpen) {
          setContextDrawerOpen(false);
          return;
        }
        if (isSceneDrawerOpen) {
          setSceneDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNarrowViewport, isContextDrawerOpen, isSceneDrawerOpen]);

  useEffect(() => {
    const onWorkspaceCommand = (event: Event) => {
      const detail = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail;
      const commandId = detail?.id;
      if (!commandId) return;

      switch (commandId) {
        case 'new-scene':
          void handleNewDocument();
          break;
        case 'save-scene':
          void handleSave();
          break;
        case 'toggle-left-drawer':
          toggleSceneDrawer();
          break;
        case 'toggle-right-drawer':
          toggleContextDrawer();
          break;
        case 'open-context-world-bible':
          openContextDrawer('world-bible');
          break;
        case 'open-context-ruleset':
          openContextDrawer('ruleset');
          break;
        case 'open-context-characters':
          openContextDrawer('characters');
          break;
        case 'open-context-compendium':
          if (showGameSystems) {
            openContextDrawer('compendium');
          }
          break;
        case 'run-consistency-review':
          void handleRunConsistencyReview();
          break;
        case 'export-markdown':
          openExportModal('markdown');
          break;
        case 'export-docx':
          openExportModal('docx');
          break;
        case 'export-epub':
          openExportModal('epub');
          break;
        case 'extract-memory':
          openMemoryModal();
          break;
        case 'toggle-ai-panel':
          break;
        default:
          break;
      }
    };

    window.addEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onWorkspaceCommand);
    };
  }, [
    handleNewDocument,
    openContextDrawer,
    handleRunConsistencyReview,
    handleSave,
    openMemoryModal,
    openExportModal,
    showGameSystems,
    toggleContextDrawer,
    toggleSceneDrawer
  ]);

  const handleMemorySave = async () => {
    if (!selectedDocument || !shodhService || !memoryDraft.trim()) {
      setMemoryModalOpen(false);
      return;
    }

    setIsSavingMemory(true);
    setFeedback(null);
    try {
      await shodhService.addMemory({
        projectId: selectedDocument.projectId,
        documentId: selectedDocument.id,
        title: selectedDocument.title || 'Untitled scene',
        summary: memoryDraft.trim(),
        tags: ['scene', 'manual']
      });

      await refreshMemories();
      setMemoryModalOpen(false);
      setFeedback({tone: 'success', message: 'Memory saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save memory.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = useCallback(
    async (memoryId: string) => {
      if (!shodhService) return;
      await shodhService.deleteMemory(memoryId);
      await refreshMemories();
    },
    [shodhService, refreshMemories]
  );

  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesBibleConfig?.parentProjectId) return;
      setIsPromotingMemoryId(memory.id);
      setFeedback(null);
      try {
        await promoteMemoryToParent(memory, seriesBibleConfig.parentProjectId);
        await refreshMemories();
        setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to promote memory.';
        setFeedback({tone: 'error', message});
      } finally {
        setIsPromotingMemoryId(null);
      }
    },
    [seriesBibleConfig?.parentProjectId, refreshMemories]
  );

  const handlePromoteDocument = useCallback(async () => {
    if (
      !seriesBibleConfig?.parentProjectId ||
      !selectedDocument
    ) {
      return;
    }
    setIsPromotingDocument(true);
    setFeedback(null);
    try {
      await promoteDocumentToParent({
        parentProjectId: seriesBibleConfig.parentProjectId,
        documentId: selectedDocument.id,
        title: selectedDocument.title || 'Untitled scene',
        content: selectedDocument.content,
        type: 'scene',
        tags: ['scene']
      });
      setFeedback({tone: 'success', message: 'Scene promoted to parent canon.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to promote scene.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsPromotingDocument(false);
    }
  }, [seriesBibleConfig?.parentProjectId, selectedDocument]);

  const handleCanonSync = useCallback(async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
      addSystemHistory({
        category: 'consistency',
        message: 'Canon sync state marked as updated.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject, addSystemHistory]);

  useEffect(() => {
    if (!activeProject || !selectedId) return;
    const existingDocument = documents.find((doc) => doc.id === selectedId);
    const nextTitle = title.trim() || 'Untitled scene';
    if (
      existingDocument &&
      existingDocument.title === nextTitle &&
      existingDocument.content === content
    ) {
      return;
    }

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: nextTitle,
      content,
      consistencyReviewMode: existingDocument?.consistencyReviewMode ?? 'default',
      createdAt,
      updatedAt: now
    };

    const timeoutId = window.setTimeout(() => {
      setSaveStatus('saving');
      void persistDoc(doc, {
        source: 'workspace-autosave',
        consistencyMode: resolveDocumentConsistencyMode(doc)
      }).catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Unable to save scene.';
        setSaveStatus('idle');
        if (lastAutosaveErrorRef.current !== message) {
          lastAutosaveErrorRef.current = message;
          setFeedback({tone: 'error', message});
        }
      });
    }, 800);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    title,
    content,
    selectedId,
    activeProject,
    selectedCreatedAt,
    persistDoc,
    documents,
    resolveDocumentConsistencyMode
  ]);

  if (!activeProject) {
    return (
      <section>
        <h1>Writing Workspace</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  if (!editorConfig) {
    return (
      <section>
        <h1>Writing Workspace</h1>
        <p>Loading editor...</p>
      </section>
    );
  }

  const contextDrawerTabs: Array<{
    id: ContextDrawerView;
    label: string;
    hidden?: boolean;
  }> = [
    {id: 'world-bible', label: 'World Bible'},
    {id: 'ruleset', label: 'Ruleset'},
    {id: 'characters', label: 'Characters'},
    {id: 'compendium', label: 'Compendium', hidden: !showGameSystems}
  ];

  const contextDrawerContent = (() => {
    if (activeContextView === 'world-bible') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Entities: <strong>{entities.length}</strong> · Categories:{' '}
            <strong>{categories.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/world-bible')}>
            Open World Bible
          </button>
        </div>
      );
    }
    if (activeContextView === 'ruleset') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Stats: <strong>{ruleset?.statDefinitions.length ?? 0}</strong> · Resources:{' '}
            <strong>{ruleset?.resourceDefinitions.length ?? 0}</strong> · Rules:{' '}
            <strong>{ruleset?.rules.length ?? 0}</strong>
          </p>
          <button type='button' onClick={() => navigate('/ruleset')}>
            Open Ruleset
          </button>
        </div>
      );
    }
    if (activeContextView === 'characters') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Characters: <strong>{characters.length}</strong> · Sheets:{' '}
            <strong>{characterSheets.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/characters')}>
            Open Characters
          </button>
        </div>
      );
    }
    return (
      <div className={styles.contextSummary}>
        <p className={styles.contextSummaryText}>
          Modules: <strong>{settlementModules.length}</strong> · Party synergies:{' '}
          <strong>{activePartySynergies.length}</strong>
        </p>
        <button type='button' onClick={() => navigate('/compendium')}>
          Open Compendium
        </button>
      </div>
    );
  })();

  const contextDrawerPanel = (
    <>
      <div
        className={styles.contextCard}
      >
        <div className={styles.contextTabs}>
          {contextDrawerTabs
            .filter((tab) => !tab.hidden)
            .map((tab) => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveContextView(tab.id)}
                className={styles.contextTabButton}
                style={{
                  backgroundColor:
                    tab.id === activeContextView ? '#dbeafe' : 'transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
        </div>
        <div className={styles.contextContent}>{contextDrawerContent}</div>
      </div>

      {selectedId && (
        <ShodhMemoryPanel
          title='Canon memories'
          memories={memoryCandidates}
          filterValue={memoryFilter}
          onFilterChange={setMemoryFilter}
          scopeSelector={{
            label: 'Scope',
            value: memoryScope,
            options: [
              {value: 'document', label: 'This scene'},
              {value: 'project', label: 'All project'}
            ],
            onChange: (value) =>
              setMemoryScope(value as 'document' | 'project')
          }}
          scopeSummaryLabel={scopeLabel}
          highlightDocumentId={selectedId}
          onRefresh={() => void refreshMemories()}
          pageSize={MEMORIES_PER_PAGE}
          showDelete
          onDeleteMemory={(id) => {
            void handleDeleteMemory(id);
          }}
          emptyState={emptyMemoryMessage}
          renderSourceLabel={(memory) =>
            memory.projectId === activeProject.id ? 'Local' : 'Parent'
          }
          renderMemoryActions={(memory) => {
            if (
              seriesBibleConfig?.parentProjectId &&
              memory.projectId === activeProject.id
            ) {
              return (
                <button
                  type='button'
                  onClick={() => void handlePromoteMemory(memory)}
                  disabled={isPromotingMemoryId === memory.id}
                  style={{fontSize: '0.8rem'}}
                >
                  {isPromotingMemoryId === memory.id
                    ? 'Promoting...'
                    : 'Promote'}
                </button>
              );
            }
            return null;
          }}
        />
      )}
    </>
  );

  const sceneDrawerPanel = (
    <>
      <div style={{marginBottom: '1rem'}}>
        <button
          type='button'
          onClick={handleNewDocument}
          disabled={isCreatingScene}
        >
          {isCreatingScene ? 'Creating...' : '+ New Scene'}
        </button>
        <button
          type='button'
          onClick={() => importInputRef.current?.click()}
          disabled={isImportingDocuments}
          style={{marginLeft: '0.5rem'}}
        >
          {isImportingDocuments ? 'Importing...' : 'Import'}
        </button>
        <label className={styles.importModeLabel}>
          Import mode
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as ImportMode)}
            disabled={isImportingDocuments}
            className={styles.importModeSelect}
          >
            <option value='balanced'>Balanced</option>
            <option value='strict'>Strict</option>
            <option value='lenient'>Lenient</option>
          </select>
        </label>
        <label className={styles.importToggleLabel}>
          <input
            type='checkbox'
            checked={skipImportSuggestions}
            disabled={isImportingDocuments}
            onChange={(event) => setSkipImportSuggestions(event.target.checked)}
          />
          Skip consistency suggestions for this import
        </label>
        <button
          type='button'
          onClick={() => openExportModal('markdown')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export MD
        </button>
        <button
          type='button'
          onClick={() => openExportModal('docx')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export DOCX
        </button>
        <button
          type='button'
          onClick={() => openExportModal('epub')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export EPUB
        </button>
        <input
          ref={importInputRef}
          type='file'
          accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,.pages,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
          multiple
          onChange={(e) => void handleImportDocuments(e)}
          style={{display: 'none'}}
        />
      </div>

      {importSummary && (
        <div className={styles.importSummaryPanel}>
          <strong>Import Summary</strong>
          <p className={styles.importSummaryText}>
            Imported {importSummary.importedCount} · Failed {importSummary.failedCount} ·
            Unresolved {importSummary.unresolvedCount} · Mode {importSummary.mode}
            {importSummary.openedTitle ? ` · Opened "${importSummary.openedTitle}"` : ''}
            {importSummary.suggestionsSkipped ? ' · Suggestions skipped' : ''}
          </p>
          <div className={styles.importSummaryActions}>
            <button
              type='button'
              onClick={() => void handleRetryFailedImports()}
              disabled={isImportingDocuments || retryImportFiles.length === 0}
            >
              Retry failed files only
            </button>
            <button
              type='button'
              onClick={() => {
                setImportSummary(null);
                setRetryImportFiles([]);
              }}
              disabled={isImportingDocuments}
            >
              Dismiss
            </button>
          </div>
          {importSummary.failures.length > 0 && (
            <ul className={styles.importSummaryList}>
              {importSummary.failures.slice(0, 6).map((item) => (
                <li key={`${item.fileName}-${item.reason}`}>
                  {item.fileName}:{' '}
                  {item.reason === 'legacy-doc'
                    ? 'Legacy .doc is unsupported.'
                    : item.reason === 'apple-pages'
                      ? item.detail ?? 'Apple Pages file: export as .docx/.txt then import.'
                      : item.detail ?? 'Could not parse this file.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {documents.length === 0 && (
        <p style={{fontStyle: 'italic'}}>
          No scenes yet. Create one to start writing.
        </p>
      )}

      <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
        {documents.map((doc) => (
          <li
            key={doc.id}
            style={{
              marginBottom: '0.5rem',
              padding: '0.5rem',
              borderRadius: '4px',
              backgroundColor: doc.id === selectedId ? '#eee' : 'transparent',
              cursor: 'pointer'
            }}
          >
            <div
              onClick={() => handleSelectDocument(doc)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '160px'
                }}
              >
                {doc.title || 'Untitled scene'}
              </span>
            </div>
            <button
              type='button'
              onClick={() => handleDelete(doc)}
              disabled={deletingDocumentId === doc.id}
              style={{marginTop: '0.25rem', fontSize: '0.8rem'}}
            >
              {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <section data-workspace-root='true'>
      <h1>Writing Workspace</h1>
      {feedback && (
        <p
          role='status'
          className={`${styles.feedbackBanner} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
      )}
      {resolverNotice && (
        <div role='status' className={styles.resolverNotice}>
          <span>{resolverNotice.message}</span>
          <button
            type='button'
            onClick={() => navigate('/world-bible')}
            className={styles.resolverButtonPrimary}
          >
            View in World Bible
          </button>
          <button
            type='button'
            onClick={() => setResolverNotice(null)}
            className={styles.resolverButtonSecondary}
          >
            Dismiss
          </button>
        </div>
      )}
      <section className={styles.consistencyPanel}>
        <div className={styles.consistencyPanelHeader}>
          <div>
            <strong>Canon Consistency Review</strong>
            <div className={styles.consistencyDescription}>
              Scan all scenes against World Bible and Character records.
            </div>
          </div>
          <button
            type='button'
            onClick={() => void handleRunConsistencyReview()}
            disabled={isRunningConsistencyReview}
          >
            {isRunningConsistencyReview ? 'Running review...' : 'Run review'}
          </button>
        </div>
        {lastConsistencyReviewAt && (
          <div className={styles.consistencyLastRun}>
            Last run: {new Date(lastConsistencyReviewAt).toLocaleString()}
          </div>
        )}
        {consistencyReviewItems.length > 0 && (
          <ul className={styles.consistencyList}>
            {consistencyReviewItems.slice(0, 24).map((item) => (
              <li key={item.id} className={styles.consistencyListItem}>
                <strong>{item.issue.code}</strong> in{' '}
                <button
                  type='button'
                  onClick={() => {
                    const doc = documents.find((entry) => entry.id === item.sceneId);
                    if (doc) handleSelectDocument(doc);
                  }}
                  className={styles.consistencySceneButton}
                >
                  {item.sceneTitle}
                </button>
                : {item.issue.message}
                {item.issue.relatedEntities && item.issue.relatedEntities.length > 0 && (
                  <span className={styles.consistencyRelated}>
                    {item.issue.relatedEntities.slice(0, 3).map((target) => (
                      <button
                        key={`${item.id}-${target.id}`}
                        type='button'
                        onClick={() => openWorldRecord(target)}
                        className={styles.consistencyRelatedButton}
                      >
                        Open {target.name}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {unknownGuardrailIssues.length > 0 && (
        <div className={styles.unknownPanel}>
          <strong>
            {hasBlockingUnknownGuardrailIssues
              ? 'Commit blocked: unknown entities detected.'
              : 'Inline review items highlighted in the scene.'}
          </strong>
          <div className={styles.unknownSummary}>
            {unknownGuardrailIssues.length} item
            {unknownGuardrailIssues.length === 1 ? '' : 's'} highlighted. Click the
            underlined text in the editor to create, link, or dismiss each one.
          </div>
          <div className={styles.unknownBulkActions}>
            <button
              type='button'
              onClick={() => void resolveAllUnknownEntities()}
              className={styles.unknownActionButton}
            >
              Accept all as new entities
            </button>
            <button
              type='button'
              onClick={dismissAllUnknownEntities}
              className={styles.unknownActionButtonSpaced}
            >
              {hasBlockingUnknownGuardrailIssues
                ? 'Dismiss all for now'
                : 'Hide all warnings for now'}
            </button>
          </div>
        </div>
      )}
      {seriesBibleConfig?.parentProjectId && (
        <div className={styles.canonPanel}>
          <strong>Parent canon:</strong>{' '}
          {canonState.parentName ?? 'Unknown'} · Version{' '}
          {canonState.parentCanonVersion ?? 'n/a'}
          {canonState.parentCanonVersion &&
            canonState.childLastSynced &&
            canonState.parentCanonVersion !== canonState.childLastSynced && (
              <span className={styles.canonOutOfSync}>
                Out of sync
              </span>
            )}
          <div className={styles.canonMetaRow}>
            <span>
              Last synced:{' '}
              {canonState.childLastSynced ?? 'never'}
            </span>
            <button
              type='button'
              onClick={() => void handleCanonSync()}
              disabled={isSyncingCanon}
            >
              {isSyncingCanon ? 'Marking...' : 'Mark as synced'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.workspaceFrame}>
        <div className={styles.drawerTopBar}>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={toggleSceneDrawer}
          >
            {isSceneDrawerOpen ? 'Hide scenes' : 'Show scenes'}
          </button>
          <button
            type='button'
            className={styles.drawerTopButton}
            onClick={toggleContextDrawer}
          >
            {isContextDrawerOpen ? 'Hide context' : 'Show context'}
          </button>
        </div>

        <div className={styles.workspaceLayout}>
        {isSceneDrawerOpen && !isNarrowViewport && (
          <aside className={styles.sceneDrawerDesktop}>
            {sceneDrawerPanel}
          </aside>
        )}

        <div className={styles.editorColumn}>
          {selectedId ? (
            <>
              <div style={{marginBottom: '0.75rem'}}>
                <label>
                  Title
                  <br />
                  <input
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
              </div>

              <div
                style={{
                  marginBottom: '0.75rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    border: '1px solid #dbeafe',
                    borderRadius: '6px',
                    backgroundColor: '#f8fbff',
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <strong style={{fontSize: '0.9rem'}}>Status Blocks</strong>
                  <button type='button' onClick={() => setStatBlockModalOpen(true)}>
                    Insert Status Block
                  </button>
                  <button type='button' onClick={handleRefreshStatTemplates}>
                    Refresh Placeholders
                  </button>
                </div>
                <label
                  style={{flex: 1, display: 'flex', flexDirection: 'column'}}
                >
                  Scene Text
                </label>
                {selectedDocument?.consistencyReviewMode === 'deferred' && (
                  <div className={styles.reviewLaterBanner}>
                    <strong>Review later is active.</strong>
                    <span>
                      Saves warn and highlight unknowns, but won&apos;t block this scene.
                    </span>
                    <button
                      type='button'
                      onClick={() => void refreshDeferredReview(selectedDocument)}
                    >
                      Refresh review
                    </button>
                    <button
                      type='button'
                      onClick={() =>
                        void updateSelectedDocumentConsistencyReviewMode('default')
                      }
                    >
                      Resume strict review
                    </button>
                  </div>
                )}
                <br />
                <EditorWithAI
                  projectId={activeProject.id}
                  documentId={selectedId}
                  content={content}
                  onChange={handleContentChange}
                  onWordCountChange={setWordCount}
                  consistencyHighlights={highlightableUnknownIssues}
                  onConsistencyHighlightClick={(issueId, anchorRect) => {
                    const issue = highlightableUnknownIssues.find(
                      (entry) => entry.id === issueId
                    );
                    if (!issue) return;
                    setConsistencyPopover({
                      issueId,
                      surface: issue.surface,
                      left: anchorRect.left,
                      top: anchorRect.bottom + 8
                    });
                    setUnknownLinkSelection((prev) => ({
                      ...prev,
                      [issue.surface]:
                        prev[issue.surface] ?? unknownLinkOptions[issue.surface]?.[0]?.id ?? ''
                    }));
                  }}
                  config={editorConfig}
                  toolbarButtons={toolbarButtons}
                  aiSettings={projectSettings?.aiSettings}
                  projectMode={projectSettings?.projectMode}
                  textToInsert={statBlockInsertContent}
                  onTextInserted={() => setStatBlockInsertContent(null)}
                  systemHistoryEntries={systemHistoryEntries}
                  onClearSystemHistory={() => {
                    clearSystemHistoryEntries(activeProject.id);
                    refreshSystemHistory();
                    setFeedback({tone: 'success', message: 'System history cleared.'});
                  }}
                  onOpenSceneFromHistory={(sceneId) => {
                    const doc = documents.find((entry) => entry.id === sceneId);
                    if (doc) {
                      handleSelectDocument(doc);
                      return;
                    }
                    setFeedback({
                      tone: 'error',
                      message: 'Could not open scene for this system event.'
                    });
                  }}
                  onRunConsistencyReviewFromHistory={() => {
                    void handleRunConsistencyReview();
                  }}
                  selectionQuickSnippets={selectionQuickSnippets}
                />
                {consistencyPopover && activeConsistencyPopoverIssue && (
                  <ContextPopover
                    title={activeConsistencyPopoverIssue.surface}
                    message={activeConsistencyPopoverIssue.message}
                    left={consistencyPopover.left}
                    top={consistencyPopover.top}
                    onClose={() => setConsistencyPopover(null)}
                  >
                    <div className={styles.consistencyPopoverActions}>
                      <button
                        type='button'
                        onClick={() => void resolveUnknownEntity(activeConsistencyPopoverIssue.surface)}
                        disabled={resolvingUnknown === activeConsistencyPopoverIssue.surface}
                      >
                        {resolvingUnknown === activeConsistencyPopoverIssue.surface
                          ? 'Creating...'
                          : 'Create entity'}
                      </button>
                      <button
                        type='button'
                        onClick={() => dismissUnknownEntity(activeConsistencyPopoverIssue.surface)}
                      >
                        Dismiss
                      </button>
                    </div>
                    {unknownLinkOptions[activeConsistencyPopoverIssue.surface]?.length ? (
                      <div className={styles.consistencyPopoverLinkRow}>
                        <select
                          value={
                            unknownLinkSelection[activeConsistencyPopoverIssue.surface] ?? ''
                          }
                          onChange={(event) =>
                            setUnknownLinkSelection((prev) => ({
                              ...prev,
                              [activeConsistencyPopoverIssue.surface]:
                                event.target.value
                            }))
                          }
                        >
                          <option value=''>Select entity...</option>
                          {unknownLinkOptions[activeConsistencyPopoverIssue.surface].map(
                            (entity) => (
                              <option key={entity.id} value={entity.id}>
                                {entity.name}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            void linkUnknownEntity(
                              activeConsistencyPopoverIssue.surface,
                              unknownLinkSelection[activeConsistencyPopoverIssue.surface]
                            )
                          }
                          disabled={
                            linkingUnknown === activeConsistencyPopoverIssue.surface ||
                            !unknownLinkSelection[activeConsistencyPopoverIssue.surface]
                          }
                        >
                          {linkingUnknown === activeConsistencyPopoverIssue.surface
                            ? 'Linking...'
                            : 'Link alias'}
                        </button>
                      </div>
                    ) : (
                      <div className={styles.consistencyPopoverNote}>
                        No close entity matches available.
                      </div>
                    )}
                  </ContextPopover>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type='button'
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  Save now
                </button>
                {seriesBibleConfig?.parentProjectId && (
                  <button
                    type='button'
                    onClick={() => void handlePromoteDocument()}
                    disabled={isPromotingDocument}
                  >
                    {isPromotingDocument
                      ? 'Promoting...'
                      : 'Promote scene to parent'}
                  </button>
                )}
                <button type='button' onClick={openMemoryModal}>
                  Extract memory
                </button>
                <span style={{fontSize: '0.85rem', fontStyle: 'italic'}}>
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved' && lastSavedAt && (
                    <>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</>
                  )}
                  {saveStatus === 'idle' && 'No recent changes'}
                  {' · '}
                  {wordCount} words
                </span>
              </div>
            </>
          ) : (
            <p>Select a scene from the left, or create one with + New Scene.</p>
          )}
        </div>

        {isContextDrawerOpen && !isNarrowViewport && (
          <aside className={styles.contextDrawerDesktop}>
            {contextDrawerPanel}
          </aside>
        )}
        </div>
      </div>

      {isSceneDrawerOpen && isNarrowViewport && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Workspace scene drawer'
          onClick={() => setSceneDrawerOpen(false)}
          className={`${styles.drawerOverlay} ${styles.sceneOverlay}`}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className={styles.drawerPanelLeft}
          >
            <div className={styles.drawerPanelHeader}>
              <strong>Scenes</strong>
              <button type='button' onClick={() => setSceneDrawerOpen(false)}>
                Close
              </button>
            </div>
            {sceneDrawerPanel}
          </aside>
        </div>
      )}

      {isContextDrawerOpen && isNarrowViewport && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Workspace context drawer'
          onClick={() => setContextDrawerOpen(false)}
          className={`${styles.drawerOverlay} ${styles.contextOverlay}`}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className={styles.drawerPanelRight}
          >
            <div className={styles.drawerPanelHeader}>
              <strong>Context Drawer</strong>
              <button type='button' onClick={() => setContextDrawerOpen(false)}>
                Close
              </button>
            </div>
            {contextDrawerPanel}
          </aside>
        </div>
      )}

      {isStatBlockModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Status Block Builder'
          onClick={closeStatBlockModal}
          className={styles.modalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`${styles.modalCard} ${styles.statModalCard}`}
          >
            <h3 className={styles.modalTitle}>Insert Status Block</h3>
            <p className={styles.modalDescription}>
              Choose what to insert. Use <strong>Reusable placeholder</strong> if you
              want to refresh it later.
            </p>

            <div className={styles.statFormGrid}>
              <label>
                Source type
                <br />
                <select
                  id='stat-block-source-type'
                  value={statBlockSourceType}
                  onChange={(event) =>
                    setStatBlockSourceType(event.target.value as StatBlockSourceType)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='character'>Character</option>
                  <option value='item'>Item/Entity</option>
                </select>
              </label>

              {statBlockSourceType === 'character' ? (
                <>
                  <label>
                    Character
                    <br />
                    <select
                      id='stat-block-character'
                      value={selectedStatCharacterId}
                      onChange={(event) => setSelectedStatCharacterId(event.target.value)}
                      disabled={characterSheets.length === 0}
                      className={styles.fullWidthField}
                    >
                      {characterSheets.length === 0 ? (
                        <option value=''>No character sheets</option>
                      ) : (
                        characterSheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label>
                    Block contents
                    <br />
                    <select
                      id='stat-block-contents'
                      value={statBlockScopeValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value.startsWith('group:')) {
                          setSelectedStatGroupId(value.slice('group:'.length));
                          setStatBlockScopePreset('custom');
                          return;
                        }
                        setSelectedStatGroupId('');
                        setStatBlockScopePreset(value as StatBlockScopePreset);
                      }}
                      className={styles.fullWidthField}
                    >
                      <option value='all'>All stats + resources</option>
                      <option value='stats'>Stats only</option>
                      <option value='resources'>Resources only</option>
                      <option value='custom'>Custom selection</option>
                      {statBlockGroups.map((group) => (
                        <option key={group.id} value={`group:${group.id}`}>
                          Group: {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {statBlockScopePreset === 'custom' && !selectedStatGroup && (
                    <div className={styles.statCustomCard}>
                      <strong className={styles.statCustomTitle}>Custom pick</strong>
                      <div className={styles.statCustomGrid}>
                        <div>
                          <div className={styles.statSectionLabel}>Stats</div>
                          {selectedSheet?.stats.length ? (
                            selectedSheet.stats.map((stat) => {
                              const label =
                                statDefinitionNameById.get(stat.definitionId) ??
                                stat.definitionId;
                              return (
                                <label key={stat.definitionId} className={styles.statOptionLabel}>
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedStatSet.has(stat.definitionId)}
                                    onChange={() =>
                                      handleToggleStatSelection(stat.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No stats on this character.
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={styles.statSectionLabel}>Resources</div>
                          {selectedSheet?.resources.length ? (
                            selectedSheet.resources.map((resource) => {
                              const label =
                                resourceDefinitionNameById.get(resource.definitionId) ??
                                resource.definitionId;
                              return (
                                <label
                                  key={resource.definitionId}
                                  className={styles.statOptionLabel}
                                >
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedResourceSet.has(
                                      resource.definitionId
                                    )}
                                    onChange={() =>
                                      handleToggleResourceSelection(resource.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No resources on this character.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedStatGroup && (
                    <div className={styles.statGroupSummary}>
                      <span>
                        Group <strong>{selectedStatGroup.name}</strong> includes{' '}
                        {activeSelectedStatSet.size} stat(s) and{' '}
                        {activeSelectedResourceSet.size} resource(s).
                      </span>
                      <button
                        type='button'
                        onClick={() => handleDeleteStatGroup(selectedStatGroup.id)}
                        className={styles.statGroupDeleteButton}
                      >
                        Delete group
                      </button>
                    </div>
                  )}

                  <div className={styles.statCustomCard}>
                    <strong className={styles.statSaveGroupTitle}>Save current selection</strong>
                    <div className={styles.statSaveGroupRow}>
                      <input
                        type='text'
                        placeholder='Group name (e.g. Qi only)'
                        value={newStatGroupName}
                        onChange={(event) => setNewStatGroupName(event.target.value)}
                        className={styles.statSaveGroupInput}
                      />
                      <button type='button' onClick={handleSaveStatGroup}>
                        Save group
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <label>
                  Item/Entity
                  <br />
                  <select
                    id='stat-block-entity'
                    value={selectedStatEntityId}
                    onChange={(event) => setSelectedStatEntityId(event.target.value)}
                    disabled={entities.length === 0}
                    className={styles.fullWidthField}
                  >
                    {entities.length === 0 ? (
                      <option value=''>No entities</option>
                    ) : (
                      entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              )}

              <label>
                Detail level
                <br />
                <select
                  id='stat-block-detail'
                  value={statBlockStyle}
                  onChange={(event) =>
                    setStatBlockStyle(event.target.value as StatBlockStyle)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='full'>All stats</option>
                  <option value='buffs'>Current buffs only</option>
                  <option value='compact'>Compact</option>
                </select>
              </label>

              <label>
                Insert as
                <br />
                <select
                  id='stat-block-insert-as'
                  value={statBlockInsertMode}
                  onChange={(event) =>
                    setStatBlockInsertMode(event.target.value as StatBlockInsertMode)
                  }
                  disabled={activeProjectMode === 'litrpg'}
                  className={styles.fullWidthField}
                >
                  <option value='block'>Live block now</option>
                  <option value='template'>Reusable placeholder</option>
                </select>
                {activeProjectMode === 'litrpg' && (
                  <span className={styles.modeHint}>
                    LitRPG mode always inserts live text for readability.
                  </span>
                )}
              </label>
            </div>
            {!canInsertStatBlock && (
              <div className={styles.statInsertHintCard}>
                <p className={styles.statInsertHintText}>
                  Add at least one {statBlockSourceType === 'character' ? 'character sheet' : 'entity'} before inserting a status block.
                </p>
                <div className={styles.statInsertHintActions}>
                  <button
                    type='button'
                    onClick={() => {
                      closeStatBlockModal();
                      navigate(
                        statBlockSourceType === 'character'
                          ? '/characters?view=sheets'
                          : '/world-bible'
                      );
                    }}
                    className={styles.statInsertHintButton}
                  >
                    {statBlockSourceType === 'character'
                      ? 'Go to Characters'
                      : 'Go to World Bible'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={closeStatBlockModal}
                className={styles.modalSecondaryAction}
              >
                Cancel
              </button>
              <button type='button' onClick={handleInsertStatBlock} disabled={!canInsertStatBlock}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          className={styles.modalOverlay}
        >
          <div className={`${styles.modalCard} ${styles.exportModalCard}`}>
            <h3 className={styles.modalTitle}>
              Export scenes as{' '}
              {exportFormat === 'markdown'
                ? 'Markdown'
                : exportFormat === 'docx'
                  ? 'DOCX'
                  : 'EPUB'}
            </h3>
            <p className={styles.modalDescription}>
              Choose which scenes to export and adjust their order for the final file.
            </p>
            <div className={styles.exportControlRow}>
              <button type='button' onClick={() => toggleAllExportItems(true)}>
                Select all
              </button>
              <button type='button' onClick={() => toggleAllExportItems(false)}>
                Clear all
              </button>
            </div>
            <div className={styles.exportListContainer}>
              {exportSelection.length === 0 ? (
                <p className={styles.exportEmpty}>
                  No scenes available to export.
                </p>
              ) : (
                <ul className={styles.exportList}>
                  {exportSelection.map((item, index) => (
                    <li key={item.id} className={styles.exportListItem}>
                      <label className={styles.exportItemLabel}>
                        <input
                          type='checkbox'
                          checked={item.included}
                          onChange={() => toggleExportItem(item.id)}
                        />
                        <span className={styles.exportItemTitle}>
                          {index + 1}. {item.title}
                        </span>
                      </label>
                      <div className={styles.exportMoveActions}>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, -1)}
                          disabled={index === 0}
                          className={styles.exportMoveButton}
                        >
                          Up
                        </button>
                        <button
                          type='button'
                          onClick={() => moveExportItem(item.id, 1)}
                          disabled={index === exportSelection.length - 1}
                          className={styles.exportMoveButton}
                        >
                          Down
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={closeExportModal}
                className={styles.modalSecondaryAction}
              >
                Cancel
              </button>
              <button type='button' onClick={handleExportScenes}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {isMemoryModalOpen && selectedDocument && (
        <div
          role='dialog'
          aria-modal='true'
          className={styles.modalOverlay}
        >
          <div className={`${styles.modalCard} ${styles.memoryModalCard}`}>
            <h3 className={styles.modalTitle}>Capture Shodh memory</h3>
            <p className={styles.modalDescription}>
              Review or edit the summary before adding it to the project
              canon.
            </p>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              rows={6}
              className={styles.memoryTextarea}
            />
            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={() => setMemoryModalOpen(false)}
                disabled={isSavingMemory}
                className={styles.modalSecondaryAction}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleMemorySave}
                disabled={isSavingMemory || !memoryDraft.trim()}
              >
                {isSavingMemory ? 'Saving...' : 'Save memory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkspaceRoute;
