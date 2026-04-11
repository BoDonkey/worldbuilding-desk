import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  Character,
  EntityCategory,
  Project,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {saveWritingDocument} from '../writingStorage';
import {getCategoriesByProject, initializeDefaultCategories} from '../categoryStorage';
import {saveEntity} from '../entityStorage';
import {upsertCompendiumEntryFromEntity} from '../services/compendium';
import type {RAGProvider} from '../services/rag/RAGService';
import type {
  ConsistencyAlias,
  ConsistencyEngineService,
  GuardrailIssue
} from '../services/consistency';
import {findCanonContradictions, saveAlias} from '../services/consistency';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
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
}

interface ConsistencyPopoverState {
  issueId: string;
  surface: string;
  left: number;
  top: number;
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
  resolvedActionCues: string[];
  consistencyEngine: ConsistencyEngineService;
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
            ? `Review "${issue.surface}" before canonizing this scene.`
            : 'Review this unknown entity before canonizing this scene.'
        }
      : issue
  );

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
  resolvedActionCues,
  consistencyEngine,
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
      if (consistencyMode === 'strict') {
        setGuardrailIssues([]);
      }
      lastAutosaveErrorRef.current = null;
      return {
        unresolvedCount,
        consistencyRun: consistencyMode !== 'lenient'
      };
    },
    [
      consistencyEngine,
      knownConsistencyEntities,
      resolvedActionCues,
      ragService,
      shodhService,
      refreshMemories,
      setDocuments,
      setLastSavedAt,
      setSaveStatus,
      setSelectedCreatedAt,
      lastAutosaveErrorRef
    ]
  );

  const refreshDeferredReview = useCallback(
    async (doc: WritingDocument) => {
      const proposal = await consistencyEngine.extractProposal({
        projectId: doc.projectId,
        text: htmlToPlainText(doc.content),
        source: 'workspace-save',
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues
      });
      const validation = await consistencyEngine.validateProposal(proposal);
      setGuardrailIssues(downgradeUnknownIssuesToWarnings(validation.issues));
    },
    [consistencyEngine, knownConsistencyEntities, resolvedActionCues]
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
        const message =
          `Consistency review found ${combinedItems.length} issue(s) across ${documents.length} scene(s).` +
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
    consistencyEngine,
    documents,
    entities,
    knownConsistencyEntities,
    resolvedActionCues,
    setFeedback
  ]);

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
  }, [entities, unknownGuardrailIssues]);

  const resolveUnknownEntity = useCallback(
    async (surface: string, categoryId?: string) => {
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
          name: normalized,
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
        setUnknownCategorySelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          prev?.surface.trim().toLowerCase() === normalized.toLowerCase() ? null : prev
        );
        setFeedback({
          tone: 'success',
          message: `Entity "${normalized}" created in ${chosenCategory.name} and marked needs completion. Save again to validate.`
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
    },
    [activeProject, categories, setCategories, setEntities, setFeedback]
  );

  const resolveAllUnknownEntities = useCallback(async () => {
    const surfaces = unknownGuardrailIssues
      .map((issue) => issue.surface?.trim())
      .filter((surface): surface is string => Boolean(surface));
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      await resolveUnknownEntity(surface);
    }
  }, [resolveUnknownEntity, unknownGuardrailIssues]);

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
  }, [setFeedback, unknownGuardrailIssues]);

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
    [activeProject, setAliases, setFeedback, unknownLinkSelection]
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
        [surface]: prev[surface] ?? unknownLinkOptions[surface]?.[0]?.id ?? ''
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
    consistencyPopover,
    setConsistencyPopover,
    knownConsistencyEntities,
    persistDoc,
    refreshDeferredReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableUnknownIssues,
    unknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    linkUnknownEntity,
    activeConsistencyPopoverIssue,
    openConsistencyPopover
  };
};
