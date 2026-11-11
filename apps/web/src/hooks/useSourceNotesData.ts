import {useEffect, useMemo, useState} from 'react';
import type {
  CanonicalFact,
  Character,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityProposal,
  LoreFactProposal,
  Project,
  WritingDocument,
  WorldEntity
} from '../entityTypes';
import {
  getCanonicalFactsByProject,
  getCharactersByProject,
  getDocumentsByProject,
  getEntitiesByProject,
  getLoreDocumentLinksByProject,
  getLoreDocumentsByProject,
  getLoreEntityProposalsByProject,
  getLoreFactProposalsByProject
} from '../services/storage';
import {getRAGService} from '../services/rag/getRAGService';
import type {RAGProvider} from '../services/rag/RAGService';
import {getShodhService} from '../services/shodh/getShodhService';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';

const RELOAD_EVENTS = [
  'wbd:lore-records-changed',
  'wbd:lore-fact-records-changed',
  'wbd:character-records-changed',
  'wbd:entity-records-changed',
  'wbd:alias-records-changed',
  'wbd:writing-records-changed'
] as const;

function groupByDocument<T>(
  items: T[],
  documentIdOf: (item: T) => string | undefined
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const documentId = documentIdOf(item);
    if (!documentId) return;
    const current = map.get(documentId) ?? [];
    current.push(item);
    map.set(documentId, current);
  });
  return map;
}

/**
 * The records the Source Notes route reads, plus the project's retrieval and
 * memory services. Reloads whenever another surface changes those records.
 */
export function useSourceNotesData(activeProject: Project | null) {
  const [documents, setDocuments] = useState<LoreDocument[]>([]);
  const [documentLinks, setDocumentLinks] = useState<LoreDocumentLink[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [entityProposals, setEntityProposals] = useState<LoreEntityProposal[]>([]);
  const [proposals, setProposals] = useState<LoreFactProposal[]>([]);
  const [canonicalFacts, setCanonicalFacts] = useState<CanonicalFact[]>([]);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] = useState<ShodhMemoryProvider | null>(null);
  const [sourceScenes, setSourceScenes] = useState<WritingDocument[]>([]);

  useEffect(() => {
    if (!activeProject) {
      setDocuments([]);
      setDocumentLinks([]);
      setCharacters([]);
      setEntities([]);
      setProposals([]);
      setCanonicalFacts([]);
      setRagService(null);
      setShodhService(null);
      setSourceScenes([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [
        loadedDocuments,
        loadedLinks,
        loadedCharacters,
        loadedEntities,
        loadedEntityProposals,
        loadedProposals,
        loadedFacts,
        loadedScenes,
        nextRagService,
        nextShodhService
      ] = await Promise.all([
        getLoreDocumentsByProject(activeProject.id),
        getLoreDocumentLinksByProject(activeProject.id),
        getCharactersByProject(activeProject.id),
        getEntitiesByProject(activeProject.id),
        getLoreEntityProposalsByProject(activeProject.id),
        getLoreFactProposalsByProject(activeProject.id),
        getCanonicalFactsByProject(activeProject.id),
        getDocumentsByProject(activeProject.id),
        getRAGService({
          projectId: activeProject.id,
          inheritFromParent: activeProject.inheritRag,
          parentProjectId: activeProject.parentProjectId
        }),
        getShodhService({
          projectId: activeProject.id,
          inheritFromParent: activeProject.inheritShodh,
          parentProjectId: activeProject.parentProjectId
        })
      ]);
      if (cancelled) return;
      setDocuments(loadedDocuments);
      setDocumentLinks(loadedLinks);
      setCharacters(loadedCharacters);
      setEntities(loadedEntities);
      setEntityProposals(loadedEntityProposals);
      setProposals(loadedProposals);
      setCanonicalFacts(loadedFacts);
      setSourceScenes(loadedScenes);
      setRagService(nextRagService);
      setShodhService(nextShodhService);
    };

    void load();
    const handleChanged = () => {
      void load();
    };
    RELOAD_EVENTS.forEach((name) => window.addEventListener(name, handleChanged));

    return () => {
      cancelled = true;
      RELOAD_EVENTS.forEach((name) => window.removeEventListener(name, handleChanged));
    };
  }, [activeProject]);

  const linkableTargets = useMemo(
    () => [
      ...characters.map((character) => ({
        key: `character:${character.id}`,
        label: `${character.name} (Legacy character data)`,
        targetType: 'character' as const,
        targetId: character.id
      })),
      ...entities.map((entity) => ({
        key: `entity:${entity.id}`,
        label: `${entity.name} (World Bible)`,
        targetType: 'entity' as const,
        targetId: entity.id
      }))
    ],
    [characters, entities]
  );

  const linksByDocumentId = useMemo(
    () => groupByDocument(documentLinks, (link) => link.loreDocumentId),
    [documentLinks]
  );

  const proposalsByDocumentId = useMemo(
    () => groupByDocument(
      proposals.filter((proposal) => proposal.status === 'proposed'),
      (proposal) => proposal.loreDocumentId
    ),
    [proposals]
  );

  const entityProposalsByDocumentId = useMemo(
    () => groupByDocument(
      entityProposals.filter((proposal) => proposal.status === 'proposed'),
      (proposal) => proposal.loreDocumentId
    ),
    [entityProposals]
  );

  const canonicalFactsByDocumentId = useMemo(
    () => groupByDocument(canonicalFacts, (fact) => fact.loreDocumentId),
    [canonicalFacts]
  );

  return {
    documents,
    documentLinks,
    setDocumentLinks,
    characters,
    entities,
    setEntities,
    entityProposals,
    setEntityProposals,
    proposals,
    setProposals,
    canonicalFacts,
    setCanonicalFacts,
    ragService,
    shodhService,
    sourceScenes,
    linkableTargets,
    linksByDocumentId,
    proposalsByDocumentId,
    entityProposalsByDocumentId,
    canonicalFactsByDocumentId
  };
}

export type SourceNotesData = ReturnType<typeof useSourceNotesData>;

export type SourceNoteFeedback = {tone: 'success' | 'error'; message: string};
export type SetSourceNoteFeedback = (feedback: SourceNoteFeedback | null) => void;
