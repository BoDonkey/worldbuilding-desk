import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {Project, WritingDocument} from '../entityTypes';
import {
  promoteMemoryToParent,
  type SeriesBibleConfig
} from '../services/seriesBible/SeriesBibleService';
import type {
  MemoryEntry,
  ShodhMemoryProvider
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorkspaceMemoriesParams {
  activeProject: Project | null;
  seriesBibleConfig: SeriesBibleConfig;
  selectedDocument: WritingDocument | null;
  summarizeContent: (html: string, limit?: number) => string;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
}

export const useWorkspaceMemories = ({
  activeProject,
  seriesBibleConfig,
  selectedDocument,
  summarizeContent,
  setFeedback
}: UseWorkspaceMemoriesParams) => {
  const [shodhService, setShodhService] = useState<ShodhMemoryProvider | null>(null);
  const [isMemoryModalOpen, setMemoryModalOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryScope, setMemoryScope] = useState<'document' | 'project'>('document');
  const [memoryFilter, setMemoryFilter] = useState('');
  const [isPromotingMemoryId, setIsPromotingMemoryId] = useState<string | null>(null);
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  useEffect(() => {
    if (!activeProject) {
      setShodhService(null);
      return;
    }

    const shodhOptions =
      seriesBibleConfig.parentProjectId && seriesBibleConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: seriesBibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;

    getShodhService(shodhOptions).then((service) => {
      if (!cancelled) {
        setShodhService(service);
      }
    });

    return () => {
      cancelled = true;
      setShodhService(null);
    };
  }, [activeProject, seriesBibleConfig.inheritShodh, seriesBibleConfig.parentProjectId]);

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

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  const selectedDocumentMemories = useMemo(
    () =>
      selectedDocument
        ? memories.filter((memory) => memory.documentId === selectedDocument.id)
        : [],
    [memories, selectedDocument]
  );

  const memoryCandidates = useMemo(
    () => (memoryScope === 'document' ? selectedDocumentMemories : memories),
    [memoryScope, selectedDocumentMemories, memories]
  );

  const scopeLabel = memoryScope === 'document' ? 'this scene' : 'the project';
  const emptyMemoryMessage =
    memoryScope === 'document'
      ? 'No memories captured for this scene yet.'
      : 'Project memories will appear here as you capture them.';

  const openMemoryModal = useCallback(() => {
    if (!selectedDocument) return;
    setMemoryDraft(summarizeContent(selectedDocument.content));
    setMemoryModalOpen(true);
  }, [selectedDocument, summarizeContent]);

  const handleMemorySave = useCallback(async () => {
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
  }, [memoryDraft, refreshMemories, selectedDocument, setFeedback, shodhService]);

  const handleDeleteMemory = useCallback(
    async (memoryId: string) => {
      if (!shodhService) return;
      await shodhService.deleteMemory(memoryId);
      await refreshMemories();
    },
    [refreshMemories, shodhService]
  );

  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesBibleConfig.parentProjectId) return;
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
    [refreshMemories, seriesBibleConfig.parentProjectId, setFeedback]
  );

  return {
    shodhService,
    memories,
    refreshMemories,
    isMemoryModalOpen,
    setMemoryModalOpen,
    memoryDraft,
    setMemoryDraft,
    memoryScope,
    setMemoryScope,
    memoryFilter,
    setMemoryFilter,
    isPromotingMemoryId,
    isSavingMemory,
    selectedDocumentMemories,
    memoryCandidates,
    scopeLabel,
    emptyMemoryMessage,
    openMemoryModal,
    handleMemorySave,
    handleDeleteMemory,
    handlePromoteMemory
  };
};
