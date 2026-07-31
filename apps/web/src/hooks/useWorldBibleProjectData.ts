import {useCallback, useEffect, useState, type Dispatch, type SetStateAction} from 'react';
import type {
  CanonicalFact,
  Character,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  Project,
  StateMutationEvent,
  WritingDocument,
  WorldEntity
} from '../entityTypes';
import {getCategoriesByProject, initializeDefaultCategories, saveCategory} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getLoreDocumentLinksByProject, getLoreDocumentsByProject} from '../loreStorage';
import {getDocumentsByProject} from '../writingStorage';
import {getCompendiumEntriesByProject} from '../services/compendium';
import {getAliasesByProject, type ConsistencyAlias} from '../services/consistency';
import {getCanonicalFactsByProject} from '../services/lore/loreFactStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import {getCanonSyncState, getSeriesBibleConfig} from '../services/seriesBible/SeriesBibleService';
import type {MemoryEntry, ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {getShodhService} from '../services/shodh/getShodhService';
import {getStateMutationEventsByProject} from '../services/state/stateMutationLedger';
import {
  CHARACTER_NOTES_FIELD,
  isCharacterCategory
} from '../services/worldBible/worldBibleSummary';

interface WorldBibleFeedback {
  tone: 'success' | 'error';
  message: string;
}

interface UseWorldBibleProjectDataOptions {
  activeProject: Project | null;
  setFeedback: Dispatch<SetStateAction<WorldBibleFeedback | null>>;
}

const ensureCharacterCategoryLongFormFields = async (
  categories: EntityCategory[]
): Promise<EntityCategory[]> => {
  let changed = false;
  const updatedCategories = categories.map((category) => {
    if (!isCharacterCategory(category)) return category;
    if (category.fieldSchema.some((field) => field.key === CHARACTER_NOTES_FIELD)) {
      return category;
    }
    changed = true;
    return {
      ...category,
      fieldSchema: [
        ...category.fieldSchema,
        {key: CHARACTER_NOTES_FIELD, label: 'Notes', type: 'textarea' as const}
      ]
    };
  });

  if (changed) {
    await Promise.all(
      updatedCategories.map((category, index) =>
        category === categories[index] ? Promise.resolve() : saveCategory(category)
      )
    );
  }

  return updatedCategories;
};

export function useWorldBibleProjectData({
  activeProject,
  setFeedback
}: UseWorldBibleProjectDataOptions) {
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [writingDocuments, setWritingDocuments] = useState<WritingDocument[]>([]);
  const [canonicalFacts, setCanonicalFacts] = useState<CanonicalFact[]>([]);
  const [stateMutationEvents, setStateMutationEvents] = useState<StateMutationEvent[]>([]);
  const [loreDocuments, setLoreDocuments] = useState<LoreDocument[]>([]);
  const [loreDocumentLinks, setLoreDocumentLinks] = useState<LoreDocumentLink[]>([]);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] = useState<ShodhMemoryProvider | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [compendiumLinkedEntityIds, setCompendiumLinkedEntityIds] = useState<
    Set<string>
  >(new Set());

  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    setMemories(list);
    emitShodhMemoriesUpdated(list);
  }, [shodhService]);

  useEffect(() => {
    if (!activeProject) {
      setLoreDocuments([]);
      setLoreDocumentLinks([]);
      return;
    }

    let cancelled = false;
    const loadLoreLinks = async () => {
      const [loadedDocuments, loadedLinks] = await Promise.all([
        getLoreDocumentsByProject(activeProject.id),
        getLoreDocumentLinksByProject(activeProject.id)
      ]);
      if (!cancelled) {
        setLoreDocuments(loadedDocuments);
        setLoreDocumentLinks(loadedLinks);
      }
    };

    void loadLoreLinks();
    window.addEventListener('wbd:lore-records-changed', loadLoreLinks);
    return () => {
      cancelled = true;
      window.removeEventListener('wbd:lore-records-changed', loadLoreLinks);
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setCategories([]);
      setEntities([]);
      setAliases([]);
      setCharacters([]);
      setWritingDocuments([]);
      setCanonicalFacts([]);
      setStateMutationEvents([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const projectId = activeProject.id;
      await initializeDefaultCategories(projectId);
      const [
        loadedCategories,
        loadedEntities,
        loadedAliases,
        loadedCharacters,
        loadedWritingDocuments,
        loadedCanonicalFacts,
        loadedStateMutationEvents
      ] = await Promise.all([
        getCategoriesByProject(projectId),
        getEntitiesByProject(projectId),
        getAliasesByProject(projectId),
        getCharactersByProject(projectId),
        getDocumentsByProject(projectId),
        getCanonicalFactsByProject(projectId),
        getStateMutationEventsByProject(projectId)
      ]);
      const normalizedCategories = await ensureCharacterCategoryLongFormFields(
        loadedCategories
      );

      if (!cancelled) {
        setCategories(normalizedCategories);
        setEntities(loadedEntities);
        setAliases(loadedAliases);
        setCharacters(loadedCharacters);
        setWritingDocuments(loadedWritingDocuments);
        setCanonicalFacts(loadedCanonicalFacts);
        setStateMutationEvents(loadedStateMutationEvents);
      }
    })();

    const refreshProjectHealthData = () => {
      void Promise.all([
        getDocumentsByProject(activeProject.id),
        getCanonicalFactsByProject(activeProject.id),
        getStateMutationEventsByProject(activeProject.id)
      ]).then(
        ([loadedWritingDocuments, loadedCanonicalFacts, loadedStateMutationEvents]) => {
          if (cancelled) return;
          setWritingDocuments(loadedWritingDocuments);
          setCanonicalFacts(loadedCanonicalFacts);
          setStateMutationEvents(loadedStateMutationEvents);
        }
      );
    };

    window.addEventListener('wbd:writing-records-changed', refreshProjectHealthData);
    window.addEventListener('wbd:lore-fact-records-changed', refreshProjectHealthData);
    window.addEventListener(
      'wbd:state-mutation-events-changed',
      refreshProjectHealthData
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        'wbd:writing-records-changed',
        refreshProjectHealthData
      );
      window.removeEventListener(
        'wbd:lore-fact-records-changed',
        refreshProjectHealthData
      );
      window.removeEventListener(
        'wbd:state-mutation-events-changed',
        refreshProjectHealthData
      );
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setAliases([]);
      return;
    }

    let cancelled = false;
    const refreshAliases = () => {
      void getAliasesByProject(activeProject.id)
        .then((loadedAliases) => {
          if (!cancelled) setAliases(loadedAliases);
        })
        .catch(() => {
          if (!cancelled) setAliases([]);
        });
    };

    refreshAliases();
    window.addEventListener('wbd:alias-records-changed', refreshAliases);
    return () => {
      cancelled = true;
      window.removeEventListener('wbd:alias-records-changed', refreshAliases);
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setCompendiumLinkedEntityIds(new Set());
      return;
    }

    let cancelled = false;
    getCompendiumEntriesByProject(activeProject.id)
      .then((entries) => {
        if (cancelled) return;
        setCompendiumLinkedEntityIds(
          new Set(
            entries.map((entry) => entry.sourceEntityId).filter(Boolean) as string[]
          )
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load compendium links.'
        });
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, entities.length, setFeedback]);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      setShodhService(null);
      return;
    }

    const seriesConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      seriesConfig.parentProjectId && seriesConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: seriesConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    const shodhOptions =
      seriesConfig.parentProjectId && seriesConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: seriesConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;
    void Promise.all([getRAGService(ragOptions), getShodhService(shodhOptions)]).then(
      ([rag, shodh]) => {
        if (!cancelled) {
          setRagService(rag);
          setShodhService(shodh);
        }
      }
    );
    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    const seriesConfig = activeProject ? getSeriesBibleConfig(activeProject) : null;
    if (!activeProject || !seriesConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    void getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) setCanonState(state);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!ragService) return;
    ragService.setEntityVocabulary(
      entities.map((entity) => ({
        id: entity.id,
        terms: [
          entity.name,
          ...Object.values(entity.fields).filter(
            (value): value is string => typeof value === 'string'
          )
        ]
      }))
    );
  }, [entities, ragService]);

  return {
    categories,
    setCategories,
    entities,
    setEntities,
    characters,
    setCharacters,
    writingDocuments,
    canonicalFacts,
    stateMutationEvents,
    loreDocuments,
    loreDocumentLinks,
    aliases,
    setAliases,
    ragService,
    shodhService,
    memories,
    refreshMemories,
    canonState,
    setCanonState,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds
  };
}
