import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  Character,
  EntityCategory,
  Project,
  ProjectSettings,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {saveWritingDocument} from '../writingStorage';
import {getCategoriesByProject, initializeDefaultCategories} from '../categoryStorage';
import {saveEntity} from '../entityStorage';
import {saveProjectSettings} from '../settingsStorage';
import {upsertCompendiumEntryFromEntity} from '../services/compendium';
import type {RAGProvider} from '../services/rag/RAGService';
import type {
  ConsistencyAlias,
  GuardrailIssue
} from '../services/consistency';
import {findCanonContradictions, saveAlias} from '../services/consistency';
import type {WorldEngine} from '../services/worldEngine';
import type {WorldEngineStatus} from '../services/worldEngine';
import type {ReviewIssueAnnotation} from '../services/worldEngine';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {normalizeCanonText} from '../services/consistency/textMatcher';
import {htmlToPlainText} from '../utils/textHelpers';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface ResolverNotice {
  message: string;
}

interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
  reviewAnnotation?: ReviewIssueAnnotation;
}

interface ConsistencyPopoverState {
  issueId: string;
  surface: string;
  left: number;
  top: number;
}

export type ReviewReadinessState =
  | 'idle'
  | 'running'
  | 'ready'
  | 'attention'
  | 'unavailable';

export interface ReviewReadiness {
  state: ReviewReadinessState;
  count: number;
  label: string;
  detail: string;
}

interface UseWorkspaceConsistencyParams {
  activeProject: Project | null;
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  entities: WorldEntity[];
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  categories: EntityCategory[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  aliases: ConsistencyAlias[];
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  characters: Character[];
  selectedDocumentId: string | null;
  projectSettings: ProjectSettings | null;
  setProjectSettings: Dispatch<SetStateAction<ProjectSettings | null>> | ((settings: ProjectSettings | null) => void);
  resolvedActionCues: string[];
  worldEngine: WorldEngine;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  setSelectedCreatedAt: Dispatch<SetStateAction<number | null>>;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved'>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  lastAutosaveErrorRef: MutableRefObject<string | null>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  addSystemHistory: (input: {
    category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
    message: string;
    insertText?: string;
    sceneId?: string;
  }) => void;
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
            ? `Review "${issue.surface}" when you are ready to add or ignore this scene context.`
            : 'Review this name or world term when you are ready to add or ignore it.'
        }
      : issue
  );

const canonicalizeUnknownSurface = normalizeCanonText;

const getReviewIssueKey = (issue: GuardrailIssue): string =>
  [
    issue.code,
    canonicalizeUnknownSurface(issue.surface ?? issue.message)
  ].join(':');

const getReviewSourceForDocument = (
  doc: WritingDocument
): 'workspace-save' | 'import' =>
  doc.consistencyReviewMode === 'deferred' ? 'import' : 'workspace-save';

const makeReviewItemId = (
  docId: string,
  issue: GuardrailIssue,
  index: number
): string => `${docId}:${getReviewIssueKey(issue)}:${index}`;

export const useWorkspaceConsistency = ({
  activeProject,
  documents,
  setDocuments,
  entities,
  setEntities,
  categories,
  setCategories,
  aliases,
  setAliases,
  characters,
  selectedDocumentId,
  projectSettings,
  setProjectSettings,
  resolvedActionCues,
  worldEngine,
  ragService,
  shodhService,
  refreshMemories,
  setSelectedCreatedAt,
  setSaveStatus,
  setLastSavedAt,
  lastAutosaveErrorRef,
  setFeedback,
  addSystemHistory
}: UseWorkspaceConsistencyParams) => {
  const [guardrailIssues, setGuardrailIssues] = useState<GuardrailIssue[]>([]);
  const [dismissedUnknownByDocument, setDismissedUnknownByDocument] = useState<
    Record<string, string[]>
  >({});
  const [isReviewPrefsHydrated, setReviewPrefsHydrated] = useState(false);
  const [resolvingUnknown, setResolvingUnknown] = useState<string | null>(null);
  const [linkingUnknown, setLinkingUnknown] = useState<string | null>(null);
  const [resolverNotice, setResolverNotice] = useState<ResolverNotice | null>(null);
  const [unknownLinkSelection, setUnknownLinkSelection] = useState<
    Record<string, string>
  >({});
  const [unknownCategorySelection, setUnknownCategorySelection] = useState<
    Record<string, string>
  >({});
  const [isRunningConsistencyReview, setIsRunningConsistencyReview] = useState(false);
  const [consistencyReviewItems, setConsistencyReviewItems] = useState<
    ConsistencyReviewItem[]
  >([]);
  const [lastConsistencyReviewAt, setLastConsistencyReviewAt] = useState<number | null>(
    null
  );
  const [consistencyPopover, setConsistencyPopover] =
    useState<ConsistencyPopoverState | null>(null);
  const [worldEngineStatus, setWorldEngineStatus] =
    useState<WorldEngineStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void worldEngine
      .getStatus()
      .then((status) => {
        if (!cancelled) {
          setWorldEngineStatus(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorldEngineStatus({
            state: 'installedUnavailable',
            reason:
              error instanceof Error
                ? error.message
                : 'Review engine status could not be checked.'
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worldEngine]);

  useEffect(() => {
    if (!activeProject) {
      setDismissedUnknownByDocument({});
      setReviewPrefsHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const prefs = parsed as {
        dismissedUnknownByDocument?: unknown;
      };
      const nextDismissed: Record<string, string[]> = {};
      if (
        prefs.dismissedUnknownByDocument &&
        typeof prefs.dismissedUnknownByDocument === 'object'
      ) {
        Object.entries(prefs.dismissedUnknownByDocument as Record<string, unknown>).forEach(
          ([docId, values]) => {
            if (!Array.isArray(values)) return;
            nextDismissed[docId] = values
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean);
          }
        );
      }
      setDismissedUnknownByDocument(nextDismissed);
    } catch {
      setDismissedUnknownByDocument({});
    } finally {
      setReviewPrefsHydrated(true);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject || !projectSettings || !isReviewPrefsHydrated) return;
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | {
            ignoredUnknownSurfaces?: unknown;
          }
        | null;
      const legacyIgnoredValues = parsed?.ignoredUnknownSurfaces;
      const legacyIgnored = (
        Array.isArray(legacyIgnoredValues) ? legacyIgnoredValues : []
      )
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (legacyIgnored.length === 0) return;

      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), ...legacyIgnored])
      );
      if (mergedIgnored.length === (projectSettings.ignoredUnknownSurfaces ?? []).length) {
        return;
      }

      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .then(() => {
          setProjectSettings(nextSettings);
        })
        .catch(() => {
          // Ignore migration errors and continue using current settings.
        });
    } catch {
      // Ignore malformed legacy local storage.
    }
  }, [activeProject, isReviewPrefsHydrated, projectSettings, setProjectSettings]);

  useEffect(() => {
    if (!activeProject || !isReviewPrefsHydrated) return;
    localStorage.setItem(
      `workspaceReviewPrefs:${activeProject.id}`,
      JSON.stringify({
        dismissedUnknownByDocument
      })
    );
  }, [
    activeProject,
    dismissedUnknownByDocument,
    isReviewPrefsHydrated
  ]);

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

  const knownConsistencyEntities = useMemo(() => {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const characterById = new Map(characters.map((character) => [character.id, character]));
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
          const linkedRecord =
            alias.targetType === 'character'
              ? characterById.get(alias.targetId)
              : entityById.get(alias.targetId);
          if (!linkedRecord) {
            return null;
          }
          return {
            id: linkedRecord.id,
            name: alias.alias,
            type: alias.targetType === 'character' ? ('character' as const) : ('entity' as const)
          };
        })
        .filter(
          (entry): entry is {id: string; name: string; type: 'character' | 'entity'} =>
            Boolean(entry)
        )
    ];
  }, [aliases, characters, entities]);

  const filterDismissedUnknownIssues = useCallback(
    (docId: string, issues: GuardrailIssue[]): GuardrailIssue[] => {
      const dismissed = new Set(
        (dismissedUnknownByDocument[docId] ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      const ignored = new Set(
        (projectSettings?.ignoredUnknownSurfaces ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      if (dismissed.size === 0 && ignored.size === 0) {
        return issues;
      }
      return issues.filter((issue) => {
        if (issue.code !== 'UNKNOWN_ENTITY') {
          return true;
        }
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || (!dismissed.has(surface) && !ignored.has(surface));
      });
    },
    [dismissedUnknownByDocument, projectSettings?.ignoredUnknownSurfaces]
  );

  const removeReviewSurface = useCallback(
    (
      surface: string,
      options?: {
        docId?: string;
      }
    ) => {
      const normalized = canonicalizeUnknownSurface(surface);
      if (!normalized) return;
      const shouldKeepIssue = (issue: GuardrailIssue) => {
        const issueSurface = canonicalizeUnknownSurface(issue.surface ?? '');
        if (!issueSurface) {
          return true;
        }
        return issueSurface !== normalized;
      };
      setGuardrailIssues((prev) => prev.filter(shouldKeepIssue));
      setConsistencyReviewItems((prev) =>
        prev.filter((item) => {
          if (options?.docId && item.sceneId !== options.docId) {
            return true;
          }
          return shouldKeepIssue(item.issue);
        })
      );
    },
    []
  );

  const attachAliasTexts = useCallback(
    async (params: {
      projectId: string;
      targetId: string;
      targetType: 'entity' | 'character';
      aliasTexts: string[];
    }) => {
      const uniqueAliases = Array.from(
        new Map(
          params.aliasTexts
            .map((alias) => alias.trim())
            .filter(Boolean)
            .map((alias) => [alias.toLowerCase(), alias])
        ).values()
      );

      for (const alias of uniqueAliases) {
        const saved = await saveAlias({
          projectId: params.projectId,
          targetId: params.targetId,
          targetType: params.targetType,
          alias
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
      }
    },
    [setAliases]
  );

  const persistDoc = useCallback(
    async (
      doc: WritingDocument,
      options?: {
        source?: 'workspace-save' | 'workspace-autosave' | 'import';
        consistencyMode?: 'strict' | 'balanced' | 'lenient';
      }
    ): Promise<{unresolvedCount: number; consistencyRun: boolean}> => {
      const source = options?.source ?? 'workspace-save';
      const consistencyMode = options?.consistencyMode ?? 'strict';
      const isImport = source === 'import';
      let unresolvedCount = 0;

      if (isImport) {
        await saveWritingDocument(doc);
      }

      if (consistencyMode !== 'lenient') {
        try {
          const {proposal, validation} = await worldEngine.reviewText({
            projectId: doc.projectId,
            text: htmlToPlainText(doc.content),
            source,
            knownEntities: knownConsistencyEntities,
            actionCues: resolvedActionCues
          });
          const presentedIssues =
            consistencyMode === 'strict'
              ? validation.issues
              : downgradeUnknownIssuesToWarnings(validation.issues);
          setGuardrailIssues(filterDismissedUnknownIssues(doc.id, presentedIssues));
          unresolvedCount = validation.issues.filter(
            (issue) => issue.code === 'UNKNOWN_ENTITY'
          ).length;

          if (!validation.allowCommit && consistencyMode === 'strict' && !isImport) {
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
              `Scene save needs review first: ${validation.issues.length} unknown ${validation.issues.length === 1 ? 'name or world term' : 'names or world terms'} (${summary}${suffix}).`
            );
          }

          if (validation.allowCommit) {
            await worldEngine.applyAcceptedProposal(proposal, validation);
          }
        } catch (error) {
          if (!isImport) {
            throw error;
          }
          console.warn('Import review failed after scene persistence', doc.id, error);
        }
      }

      if (!isImport) {
        await saveWritingDocument(doc);
      }

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
        const index = prev.findIndex((entry) => entry.id === doc.id);
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
      if (consistencyMode === 'strict' && !isImport) {
        setGuardrailIssues([]);
      }
      lastAutosaveErrorRef.current = null;
      return {
        unresolvedCount,
        consistencyRun: consistencyMode !== 'lenient'
      };
    },
    [
      filterDismissedUnknownIssues,
      knownConsistencyEntities,
      resolvedActionCues,
      ragService,
      shodhService,
      refreshMemories,
      setDocuments,
      setLastSavedAt,
      setSaveStatus,
      setSelectedCreatedAt,
      lastAutosaveErrorRef,
      worldEngine
    ]
  );

  const refreshDeferredReview = useCallback(
    async (doc: WritingDocument) => {
      const {validation} = await worldEngine.reviewText({
        projectId: doc.projectId,
        text: htmlToPlainText(doc.content),
        source: getReviewSourceForDocument(doc),
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues
      });
      const presentedIssues = filterDismissedUnknownIssues(
        doc.id,
        downgradeUnknownIssuesToWarnings(validation.issues)
      );
      setGuardrailIssues(presentedIssues);
      setConsistencyReviewItems((prev) => [
        ...prev.filter((item) => item.sceneId !== doc.id),
        ...presentedIssues.map((issue, index) => ({
          id: makeReviewItemId(doc.id, issue, index),
          sceneId: doc.id,
          sceneTitle: doc.title || 'Untitled scene',
          issue
        }))
      ]);
    },
    [
      filterDismissedUnknownIssues,
      knownConsistencyEntities,
      resolvedActionCues,
      worldEngine
    ]
  );

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
        const {validation, issueAnnotations} = await worldEngine.reviewText({
          projectId: activeProject.id,
          text: htmlToPlainText(doc.content),
          source: getReviewSourceForDocument(doc),
          knownEntities: knownConsistencyEntities,
          actionCues: resolvedActionCues
        });
        const presentedIssues = filterDismissedUnknownIssues(doc.id, validation.issues);
        presentedIssues.forEach((issue, index) => {
          items.push({
            id: makeReviewItemId(doc.id, issue, index),
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue,
            reviewAnnotation: issueAnnotations[index]
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
        const message =
          `Project review found ${combinedItems.length} item(s) across ${documents.length} scene(s).` +
          (contradictionCount > 0
            ? ` ${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} with canon records.`
            : '');
        setFeedback({tone: 'error', message});
        addSystemHistory({
          category: 'consistency',
          message,
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
    addSystemHistory,
    characters,
    documents,
    entities,
    filterDismissedUnknownIssues,
    knownConsistencyEntities,
    resolvedActionCues,
    setFeedback,
    worldEngine
  ]);

  const unknownGuardrailIssues = useMemo(() => {
    const seen = new Set<string>();
    return guardrailIssues
      .filter((issue) => issue.code === 'UNKNOWN_ENTITY' && Boolean(issue.surface))
      .filter((issue) => {
        const key = canonicalizeUnknownSurface(issue.surface ?? '');
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

  const highlightableUnknownIssues = useMemo(() => {
    const issueMap = new Map<
      string,
      {
        id: string;
        surface: string;
        message: string;
        severity: 'blocking' | 'warning';
      }
    >();
    const addIssue = (issue: GuardrailIssue) => {
      if (issue.code !== 'UNKNOWN_ENTITY' || !issue.surface) return;
      const key = getReviewIssueKey(issue);
      if (issueMap.has(key)) return;
      issueMap.set(key, {
        id: `${issue.code}:${issue.surface}`,
        surface: issue.surface,
        message: issue.message,
        severity: issue.severity
      });
    };

    unknownGuardrailIssues.forEach(addIssue);
    if (selectedDocumentId) {
      consistencyReviewItems
        .filter((item) => item.sceneId === selectedDocumentId)
        .forEach((item) => addIssue(item.issue));
    }

    return Array.from(issueMap.values());
  }, [consistencyReviewItems, selectedDocumentId, unknownGuardrailIssues]);

  const reviewReadiness = useMemo<ReviewReadiness>(() => {
    const issueKeys = new Set<string>();
    unknownGuardrailIssues.forEach((issue) => {
      issueKeys.add(getReviewIssueKey(issue));
    });
    consistencyReviewItems.forEach((item) => {
      issueKeys.add(getReviewIssueKey(item.issue));
    });
    const count = issueKeys.size;
    if (worldEngineStatus && worldEngineStatus.state !== 'available') {
      return {
        state: 'unavailable',
        count,
        label: 'Review unavailable',
        detail:
          worldEngineStatus.state === 'notInstalled'
            ? 'Local review engine is not installed.'
            : worldEngineStatus.reason
      };
    }
    if (isRunningConsistencyReview) {
      return {
        state: 'running',
        count,
        label: 'Review running',
        detail: 'Review is checking the current project.'
      };
    }
    if (hasBlockingUnknownGuardrailIssues) {
      return {
        state: 'attention',
        count,
        label: count === 1 ? '1 review item' : `${count} review items`,
        detail: 'Some review items need attention before a strict save can finish.'
      };
    }
    if (count > 0) {
      return {
        state: 'ready',
        count,
        label: count === 1 ? '1 review item' : `${count} review items`,
        detail: 'Review items are ready when you want to check them.'
      };
    }
    return {
      state: 'idle',
      count: 0,
      label: 'Review clear',
      detail: 'No open review items.'
    };
  }, [
    consistencyReviewItems,
    hasBlockingUnknownGuardrailIssues,
    isRunningConsistencyReview,
    unknownGuardrailIssues,
    worldEngineStatus
  ]);

  const unknownLinkOptions = useMemo(() => {
    const optionMap: Record<
      string,
      Array<{id: string; name: string; type: 'character' | 'entity'}>
    > = {};
    unknownGuardrailIssues.forEach((issue) => {
      const surface = (issue.surface ?? '').trim();
      if (!surface) return;
      const normalizedSurface = surface.toLowerCase();
      const candidates = [
        ...entities.map((entity) => ({id: entity.id, name: entity.name, type: 'entity' as const})),
        ...characters.map((character) => ({
          id: character.id,
          name: character.name,
          type: 'character' as const
        }))
      ];
      const ranked = [...candidates].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === normalizedSurface ? 0 : 1;
        const bExact = bName === normalizedSurface ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aClose =
          aName.includes(normalizedSurface) || normalizedSurface.includes(aName) ? 0 : 1;
        const bClose =
          bName.includes(normalizedSurface) || normalizedSurface.includes(bName) ? 0 : 1;
        if (aClose !== bClose) return aClose - bClose;
        return a.name.localeCompare(b.name);
      });
      optionMap[surface] = ranked.slice(0, 20);
    });
    return optionMap;
  }, [characters, entities, unknownGuardrailIssues]);

  const closeUnknownLinkOptions = useMemo(() => {
    const optionMap: Record<
      string,
      Array<{id: string; name: string; type: 'character' | 'entity'}>
    > = {};
    unknownGuardrailIssues.forEach((issue) => {
      const surface = (issue.surface ?? '').trim();
      if (!surface) return;
      const normalizedSurface = surface.toLowerCase();
      const candidates = unknownLinkOptions[surface] ?? [];
      optionMap[surface] = candidates.filter((record) => {
        const normalizedName = record.name.toLowerCase();
        if (normalizedName === normalizedSurface) {
          return true;
        }
        return (
          normalizedName.includes(normalizedSurface) ||
          normalizedSurface.includes(normalizedName)
        );
      });
    });
    return optionMap;
  }, [unknownGuardrailIssues, unknownLinkOptions]);

  const resolveUnknownEntity = useCallback(
    async (
      surface: string,
      categoryId?: string,
      preferredName?: string
    ) => {
      if (!activeProject) return;

      const normalizedSurface = surface.trim();
      const normalizedName = preferredName?.trim() || normalizedSurface;
      if (!normalizedSurface || !normalizedName) return;

      setResolvingUnknown(surface);
      setFeedback(null);
      try {
        let availableCategories = categories;
        if (availableCategories.length === 0) {
          await initializeDefaultCategories(activeProject.id);
          availableCategories = await getCategoriesByProject(activeProject.id);
          setCategories(availableCategories);
        }

        const chosenCategory =
          (categoryId
            ? availableCategories.find((c) => c.id === categoryId)
            : null) ??
          availableCategories.find((category) =>
            ['characters', 'locations', 'items'].includes(category.slug)
          ) ??
          availableCategories[0];

        if (!chosenCategory) {
          throw new Error('No categories available for entity creation.');
        }

        const now = Date.now();
        const entity: WorldEntity = {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          categoryId: chosenCategory.id,
          name: normalizedName,
          fields: {},
          needsCompletion: true,
          links: [],
          createdAt: now,
          updatedAt: now
        };
        await saveEntity(entity);
        await upsertCompendiumEntryFromEntity({
          projectId: activeProject.id,
          entity,
          domain: 'custom',
          needsCompletion: true
        });
        await attachAliasTexts({
          projectId: activeProject.id,
          targetId: entity.id,
          targetType: 'entity',
          aliasTexts:
            normalizedName.toLowerCase() === normalizedSurface.toLowerCase()
              ? []
              : [normalizedName, normalizedSurface]
        });
        setEntities((prev) => [...prev, entity]);
        removeReviewSurface(normalizedSurface, {docId: selectedDocumentId ?? undefined});
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setUnknownCategorySelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(normalizedSurface)
            ? null
            : prev
        );
        setFeedback({
          tone: 'success',
          message: `"${normalizedName}" added to ${chosenCategory.name} and marked for later completion.`
        });
        setResolverNotice({
          message: `"${normalizedName}" added to your world.`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to create entity.';
        setFeedback({tone: 'error', message});
      } finally {
        setResolvingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      categories,
      removeReviewSurface,
      selectedDocumentId,
      setCategories,
      setEntities,
      setFeedback
    ]
  );

  const clearUnknownSurface = useCallback((surface: string) => {
    removeReviewSurface(surface, {docId: selectedDocumentId ?? undefined});
  }, [removeReviewSurface, selectedDocumentId]);

  const resolveAllUnknownEntities = useCallback(async () => {
    const surfaces = unknownGuardrailIssues
      .map((issue) => issue.surface?.trim())
      .filter((surface): surface is string => Boolean(surface));
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      await resolveUnknownEntity(surface);
    }
  }, [resolveUnknownEntity, unknownGuardrailIssues]);

  const dismissAllUnknownEntities = useCallback((docId?: string) => {
    const dismissedSurfaces = Array.from(
      new Set(
        unknownGuardrailIssues
          .map((issue) => issue.surface?.trim())
          .filter((surface): surface is string => Boolean(surface))
      )
    );
    const blocked = new Set(
        unknownGuardrailIssues
          .map((issue) => (issue.surface ? canonicalizeUnknownSurface(issue.surface) : ''))
          .filter((surface): surface is string => Boolean(surface))
    );
    if (docId && dismissedSurfaces.length > 0) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(
          new Set([...(prev[docId] ?? []), ...dismissedSurfaces])
        )
      }));
    }
    setGuardrailIssues((prev) =>
      prev.filter((issue) => {
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || !blocked.has(surface);
      })
    );
    setConsistencyReviewItems((prev) =>
      prev.filter((item) => {
        const surface = item.issue.surface
          ? canonicalizeUnknownSurface(item.issue.surface)
          : '';
        return !surface || !blocked.has(surface);
      })
    );
    setFeedback({
      tone: 'success',
      message: 'Unknown entity warnings dismissed for now.'
    });
  }, [setFeedback, unknownGuardrailIssues]);

  const dismissUnknownEntity = useCallback((surface: string, docId?: string) => {
    const normalized = canonicalizeUnknownSurface(surface);
    if (!normalized) return;
    if (docId) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
      }));
    }
    removeReviewSurface(surface, {docId});
    setConsistencyPopover((prev) =>
      canonicalizeUnknownSurface(prev?.surface ?? '') === normalized ? null : prev
    );
  }, [removeReviewSurface]);

  const ignoreUnknownSurfaceProjectWide = useCallback(
    (surface: string, docId?: string) => {
      const normalized = surface.trim();
      if (!normalized) return;
      if (!projectSettings || !activeProject) {
        setFeedback({
          tone: 'error',
          message: 'Project settings are not available yet. Try again in a moment.'
        });
        return;
      }
      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), normalized.toLowerCase()])
      );
      if (docId) {
        setDismissedUnknownByDocument((prev) => ({
          ...prev,
          [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
        }));
      }
      removeReviewSurface(surface);
      setConsistencyPopover((prev) =>
        canonicalizeUnknownSurface(prev?.surface ?? '') ===
        canonicalizeUnknownSurface(surface)
          ? null
          : prev
      );
      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .then(() => {
          setProjectSettings(nextSettings);
          setFeedback({
            tone: 'success',
            message: `"${normalized}" will be ignored for this project in future reviews.`
          });
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Unable to save project review settings.';
          setFeedback({tone: 'error', message});
        });
    },
    [
      activeProject,
      projectSettings,
      removeReviewSurface,
      setFeedback,
      setProjectSettings
    ]
  );

  const linkUnknownEntity = useCallback(
    async (
      surface: string,
      explicitEntityId?: string,
      preferredAlias?: string
    ) => {
      if (!activeProject) return false;
      const selectedEntityId = explicitEntityId ?? unknownLinkSelection[surface];
      if (!selectedEntityId) {
        setFeedback({
          tone: 'error',
          message: `Select an entity before linking "${surface}".`
        });
        return false;
      }

      setLinkingUnknown(surface);
      setFeedback(null);
      try {
        const [selectedTargetType, selectedTargetId] = selectedEntityId.split(':');
        if (
          (selectedTargetType !== 'entity' && selectedTargetType !== 'character') ||
          !selectedTargetId
        ) {
          throw new Error('Invalid link target selected.');
        }
        const aliasTexts =
          preferredAlias && preferredAlias.trim()
            ? [preferredAlias.trim(), surface]
            : [surface];
        await attachAliasTexts({
          projectId: activeProject.id,
          targetId: selectedTargetId,
          targetType: selectedTargetType,
          aliasTexts
        });
        removeReviewSurface(surface, {docId: selectedDocumentId ?? undefined});
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(surface)
            ? null
            : prev
        );
        setFeedback({
          tone: 'success',
          message: `Connected "${surface}" to an existing record. Save again to validate.`
        });
        setResolverNotice({
          message: `"${surface}" connected to an existing record.`
        });
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to link alias.';
        setFeedback({tone: 'error', message});
        return false;
      } finally {
        setLinkingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      removeReviewSurface,
      selectedDocumentId,
      setFeedback,
      unknownLinkSelection
    ]
  );

  const activeConsistencyPopoverIssue = consistencyPopover
    ? highlightableUnknownIssues.find((issue) => issue.id === consistencyPopover.issueId) ?? null
    : null;

  const openConsistencyPopover = useCallback(
    (
      issueId: string,
      anchorRect: {left: number; bottom: number},
      surface: string
    ) => {
      setConsistencyPopover({
        issueId,
        surface,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
      setUnknownLinkSelection((prev) => ({
        ...prev,
        [surface]:
          prev[surface] ??
          (unknownLinkOptions[surface]?.[0]
            ? `${unknownLinkOptions[surface][0].type}:${unknownLinkOptions[surface][0].id}`
            : '')
      }));
    },
    [unknownLinkOptions]
  );

  return {
    guardrailIssues,
    setGuardrailIssues,
    resolvingUnknown,
    linkingUnknown,
    resolverNotice,
    setResolverNotice,
    unknownLinkSelection,
    setUnknownLinkSelection,
    unknownCategorySelection,
    setUnknownCategorySelection,
    isRunningConsistencyReview,
    consistencyReviewItems,
    lastConsistencyReviewAt,
    reviewReadiness,
    consistencyPopover,
    setConsistencyPopover,
    knownConsistencyEntities,
    persistDoc,
    refreshDeferredReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableUnknownIssues,
    isReviewPrefsHydrated,
    unknownLinkOptions,
    closeUnknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity,
    clearUnknownSurface,
    activeConsistencyPopoverIssue,
    openConsistencyPopover
  };
};
