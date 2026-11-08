import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router';
import type {LoreDocument, Project} from '../entityTypes';
import type {RAGDiagnostics, RAGSearchResult} from '../services/rag/types';
import type {MemoryEntry} from '../services/shodh/ShodhMemoryService';
import {
  rebuildProjectContextHealth,
  type ContextHealthRebuildResult
} from '../services/contextHealth/contextHealthRebuild';
import {
  hasIndexableContextContent,
  summarizeMissingContextDocuments,
  type ExpectedContextDocument
} from '../services/contextHealth/contextHealthCoverage';
import {describeError} from '../services/errors';
import type {SetSourceNoteFeedback, SourceNotesData} from './useSourceNotesData';

/**
 * Context health for the Source Notes route: what retrieval and project
 * memory can see, whether it looks stale, a retrieval probe, and rebuilding
 * derived context from saved records.
 */
export function useSourceNoteContextHealth(params: {
  activeProject: Project | null;
  data: SourceNotesData;
  setFeedback: SetSourceNoteFeedback;
  /** Opens a Source Note found by the probe in the editor. */
  onOpenSourceNote: (document: LoreDocument) => void;
}) {
  const {activeProject, data, setFeedback, onOpenSourceNote} = params;
  const {ragService, shodhService, documents, entities, canonicalFacts, sourceScenes} = data;
  const navigate = useNavigate();
  const [ragDiagnostics, setRagDiagnostics] = useState<RAGDiagnostics | null>(null);
  const [shodhMemories, setShodhMemories] = useState<MemoryEntry[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthProbe, setHealthProbe] = useState('');
  const [healthProbeResults, setHealthProbeResults] = useState<RAGSearchResult[]>([]);
  const [healthProbeRunning, setHealthProbeRunning] = useState(false);
  const [healthProbeSearched, setHealthProbeSearched] = useState(false);
  const [healthRebuilding, setHealthRebuilding] = useState(false);
  const [healthRebuildResult, setHealthRebuildResult] =
    useState<ContextHealthRebuildResult | null>(null);

  useEffect(() => {
    if (activeProject) return;
    setRagDiagnostics(null);
    setShodhMemories([]);
    setHealthProbeResults([]);
    setHealthProbeSearched(false);
    setHealthRebuildResult(null);
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject || !ragService || !shodhService) {
      setRagDiagnostics(null);
      setShodhMemories([]);
      return;
    }

    let cancelled = false;
    const loadHealth = async () => {
      setHealthLoading(true);
      try {
        const [diagnostics, memories] = await Promise.all([
          ragService.getDiagnostics(),
          shodhService.listMemories()
        ]);
        if (cancelled) return;
        setRagDiagnostics(diagnostics);
        setShodhMemories(memories);
      } catch (error) {
        console.warn('Unable to load project context health', error);
        if (!cancelled) {
          setRagDiagnostics(null);
          setShodhMemories([]);
        }
      } finally {
        if (!cancelled) {
          setHealthLoading(false);
        }
      }
    };

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, [
    activeProject,
    canonicalFacts.length,
    documents.length,
    entities.length,
    ragService,
    shodhService
  ]);

  const contextStaleReasons = useMemo(() => {
    if (!ragDiagnostics) return [];
    const expectedDocuments: ExpectedContextDocument[] = [
      ...sourceScenes
        .filter((scene) => hasIndexableContextContent(scene.content))
        .map((scene) => ({
          documentId: scene.id,
          type: 'scene' as const
        })),
      ...entities.map((entity) => ({
        documentId: entity.id,
        type: 'worldbible' as const
      })),
      ...documents
        .filter((document) => hasIndexableContextContent(document.content))
        .map((document) => ({
          documentId: `lore:${document.id}`,
          type: 'lore' as const
        })),
      ...canonicalFacts.map((fact) => ({
        documentId: `canon-fact:${fact.id}`,
        type: 'canon_fact' as const
      }))
    ];
    const missing = summarizeMissingContextDocuments({
      diagnostics: ragDiagnostics,
      expectedDocuments
    });
    const reasons: string[] = [];
    if (missing.scene > 0) {
      reasons.push(
        `${missing.scene} saved scene${missing.scene === 1 ? ' is' : 's are'} missing from retrieval`
      );
    }
    if (missing.worldbible > 0) {
      reasons.push(
        `${missing.worldbible} World Bible record${missing.worldbible === 1 ? ' is' : 's are'} missing from retrieval`
      );
    }
    if (missing.lore > 0) {
      reasons.push(
        `${missing.lore} Source Note${missing.lore === 1 ? ' is' : 's are'} missing from retrieval`
      );
    }
    if (missing.canon_fact > 0) {
      reasons.push(
        `${missing.canon_fact} accepted canon fact${missing.canon_fact === 1 ? ' is' : 's are'} missing from retrieval`
      );
    }
    return reasons;
  }, [
    canonicalFacts,
    documents,
    entities,
    sourceScenes,
    ragDiagnostics
  ]);

  const refreshProjectContextHealth = async () => {
    if (!ragService || !shodhService) return;
    const [diagnostics, memories] = await Promise.all([
      ragService.getDiagnostics(),
      shodhService.listMemories()
    ]);
    setRagDiagnostics(diagnostics);
    setShodhMemories(memories);
  };

  const handleHealthProbe = async () => {
    if (!ragService || !healthProbe.trim()) {
      setHealthProbeResults([]);
      setHealthProbeSearched(false);
      return;
    }
    setHealthProbeRunning(true);
    setHealthProbeSearched(true);
    try {
      setHealthProbeResults(await ragService.search(healthProbe.trim(), 5));
    } catch (error) {
      console.warn('Project context probe failed', error);
      setHealthProbeResults([]);
    } finally {
      setHealthProbeRunning(false);
    }
  };

  const changeHealthProbe = (value: string) => {
    setHealthProbe(value);
    setHealthProbeSearched(false);
  };

  /** The Source Note a probe result came from, directly or through a canon fact. */
  const sourceNoteForResult = (result: RAGSearchResult): LoreDocument | null => {
    const {chunk} = result;
    if (chunk.metadata.type === 'lore') {
      const documentId = chunk.documentId.replace(/^lore:/, '');
      return documents.find((entry) => entry.id === documentId) ?? null;
    }
    if (chunk.metadata.type === 'canon_fact') {
      const factId = chunk.documentId.replace(/^canon-fact:/, '');
      const fact = canonicalFacts.find((entry) => entry.id === factId);
      return fact?.loreDocumentId
        ? documents.find((entry) => entry.id === fact.loreDocumentId) ?? null
        : null;
    }
    return null;
  };

  const openHealthProbeResult = (result: RAGSearchResult) => {
    const {chunk} = result;
    if (chunk.metadata.type === 'scene') {
      navigate('/workspace', {
        state: {
          focusDocumentId: chunk.documentId,
          focusQuery: healthProbe.trim()
        }
      });
      return;
    }
    if (chunk.metadata.type === 'worldbible') {
      navigate('/world-bible', {state: {focusEntityId: chunk.documentId}});
      return;
    }
    const document = sourceNoteForResult(result);
    if (document) {
      onOpenSourceNote(document);
    }
  };

  const canOpenHealthProbeResult = (result: RAGSearchResult) => {
    const {type} = result.chunk.metadata;
    if (type === 'scene' || type === 'worldbible') {
      return true;
    }
    return Boolean(sourceNoteForResult(result));
  };

  const handleRebuildProjectContext = async () => {
    if (!activeProject || !ragService || !shodhService || healthRebuilding) return;
    setHealthRebuilding(true);
    setFeedback(null);
    try {
      const result = await rebuildProjectContextHealth({
        project: activeProject,
        ragService,
        shodhService
      });
      setHealthRebuildResult(result);
      await refreshProjectContextHealth();
      setFeedback({
        tone: 'success',
        message:
          `Context rebuilt from source data: ${result.scenes} scene${result.scenes === 1 ? '' : 's'}, ` +
          `${result.worldRecords} World Bible record${result.worldRecords === 1 ? '' : 's'}, ` +
          `${result.loreDocuments} lore document${result.loreDocuments === 1 ? '' : 's'}, ` +
          `${result.canonFacts} canon fact${result.canonFacts === 1 ? '' : 's'}.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to rebuild project context.');
      setFeedback({tone: 'error', message});
    } finally {
      setHealthRebuilding(false);
    }
  };

  return {
    ragDiagnostics,
    shodhMemories,
    setShodhMemories,
    healthLoading,
    healthProbe,
    changeHealthProbe,
    healthProbeResults,
    healthProbeRunning,
    healthProbeSearched,
    healthRebuilding,
    healthRebuildResult,
    contextStaleReasons,
    contextMayNeedRebuild: contextStaleReasons.length > 0,
    refreshProjectContextHealth,
    handleHealthProbe,
    openHealthProbeResult,
    canOpenHealthProbeResult,
    handleRebuildProjectContext,
    canRebuild: Boolean(ragService && shodhService)
  };
}

export type SourceNoteContextHealth = ReturnType<typeof useSourceNoteContextHealth>;
