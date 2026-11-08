import {useMemo, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  CanonicalFact,
  LoreDocument,
  LoreEntityProposal,
  LoreFactProposal,
  Project
} from '../entityTypes';
import {
  getCanonicalFactsByProject,
  getEntitiesByProject,
  getLoreDocumentLinksByProject,
  replaceLoreEntityProposals,
  replaceLoreFactProposals,
  saveLoreEntityProposal,
  saveLoreFactProposal
} from '../services/storage';
import {extractLoreFactProposals} from '../services/lore/loreFactExtraction';
import {extractLoreEntityProposals} from '../services/lore/loreEntityExtraction';
import {
  acceptCanonicalFact,
  buildCanonicalFactSummary,
  captureCanonicalFactMemory,
  deleteCanonicalFactMemory,
  prependUniqueCanonicalFact,
  removeCanonicalFact
} from '../services/lore/canonicalFactActions';
import {getCanonicalFactValidityTags} from '../services/lore/canonicalFactValidity';
import {acceptLoreEntityProposal} from '../services/lore/entityProposalActions';
import type {MemoryEntry} from '../services/shodh/ShodhMemoryService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {describeError} from '../services/errors';
import type {ConfirmRequest} from './useConfirmDialog';
import type {SetSourceNoteFeedback, SourceNotesData} from './useSourceNotesData';

export type FactTargetDraft = {
  targetType: 'entity';
  targetId: string;
};

export type FactTargetDrafts = Record<string, FactTargetDraft>;

/**
 * Extraction review for the Source Note being edited: running extraction,
 * and accepting or rejecting the entity and fact candidates it proposes.
 * Nothing here changes canon until the author accepts a candidate.
 */
export function useSourceNoteExtractionReview(params: {
  activeProject: Project | null;
  data: SourceNotesData;
  editingId: string | null;
  hasUnsavedEditorChanges: boolean;
  /** Target choices per fact proposal; the editor clears them when it starts over. */
  factTargetDrafts: FactTargetDrafts;
  setFactTargetDrafts: Dispatch<SetStateAction<FactTargetDrafts>>;
  setShodhMemories: (memories: MemoryEntry[]) => void;
  refreshContextHealth: () => Promise<void>;
  setFeedback: SetSourceNoteFeedback;
  requestConfirm: (request: ConfirmRequest) => void;
  announceStatus: (message: string) => void;
}) {
  const {
    activeProject,
    data,
    editingId,
    hasUnsavedEditorChanges,
    factTargetDrafts,
    setFactTargetDrafts,
    setShodhMemories,
    refreshContextHealth,
    setFeedback,
    requestConfirm,
    announceStatus
  } = params;
  const {
    documents,
    characters,
    entities,
    setEntities,
    setDocumentLinks,
    setEntityProposals,
    proposals,
    setProposals,
    canonicalFacts,
    setCanonicalFacts,
    ragService,
    shodhService,
    sourceScenes,
    linksByDocumentId,
    proposalsByDocumentId,
    entityProposalsByDocumentId,
    canonicalFactsByDocumentId
  } = data;
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [actingProposalId, setActingProposalId] = useState<string | null>(null);
  const [actingEntityProposalId, setActingEntityProposalId] = useState<string | null>(null);
  const [removingFactId, setRemovingFactId] = useState<string | null>(null);

  const factLinkableTargets = useMemo(
    () => entities.map((entity) => ({
      key: `entity:${entity.id}`,
      label: entity.name,
      targetType: 'entity' as const,
      targetId: entity.id
    })),
    [entities]
  );

  const editingDocumentProposals = useMemo(
    () => (editingId ? proposalsByDocumentId.get(editingId) ?? [] : []),
    [editingId, proposalsByDocumentId]
  );

  const editingEntityProposals = useMemo(
    () => (editingId ? entityProposalsByDocumentId.get(editingId) ?? [] : []),
    [editingId, entityProposalsByDocumentId]
  );

  const editingDocumentFacts = useMemo(
    () => (editingId ? canonicalFactsByDocumentId.get(editingId) ?? [] : []),
    [canonicalFactsByDocumentId, editingId]
  );

  const handleExtractFacts = async (document: LoreDocument) => {
    if (!activeProject) return;
    if (document.id === editingId && hasUnsavedEditorChanges) {
      setFeedback({
        tone: 'error',
        message: 'Save this Source Note before extracting again so the scan uses your latest text and context links.'
      });
      return;
    }
    setExtractingId(document.id);
    setFeedback(null);
    announceStatus('Extracting facts from this Source Note.');
    try {
      const links = linksByDocumentId.get(document.id) ?? [];
      const nextEntityProposals = extractLoreEntityProposals({
        projectId: activeProject.id,
        document,
        links,
        characters,
        entities
      });
      const nextProposals = extractLoreFactProposals({
        projectId: activeProject.id,
        document,
        links,
        knownTargets: entities.map((entity) => ({
          type: 'entity' as const,
          id: entity.id,
          name: entity.name
        })),
        existingFacts: canonicalFacts
      });
      await replaceLoreEntityProposals({
        projectId: activeProject.id,
        loreDocumentId: document.id,
        proposals: nextEntityProposals
      });
      await replaceLoreFactProposals({
        projectId: activeProject.id,
        loreDocumentId: document.id,
        proposals: nextProposals
      });
      setEntityProposals((current) => [
        ...current.filter(
          (proposal) =>
            proposal.projectId !== activeProject.id || proposal.loreDocumentId !== document.id
        ),
        ...nextEntityProposals
      ]);
      setProposals((current) => [
        ...current.filter(
          (proposal) =>
            proposal.projectId !== activeProject.id || proposal.loreDocumentId !== document.id
        ),
        ...nextProposals
      ]);
      setFeedback({
        tone: 'success',
        message:
          nextEntityProposals.length + nextProposals.length > 0
            ? `Extracted ${nextEntityProposals.length} entity proposal${nextEntityProposals.length === 1 ? '' : 's'} and ${nextProposals.length} fact proposal${nextProposals.length === 1 ? '' : 's'}.`
            : 'No new entity or fact proposals were extracted from this document.'
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to extract lore facts.');
      setFeedback({tone: 'error', message});
    } finally {
      setExtractingId(null);
      announceStatus('Extraction finished.');
    }
  };

  const getFactProposalTarget = (proposal: LoreFactProposal) => {
    const draft = factTargetDrafts[proposal.id];
    const targetId = draft?.targetId ?? (
      proposal.targetType === 'entity' ? proposal.targetId : undefined
    );
    if (!targetId) return null;
    const target = factLinkableTargets.find((entry) => entry.targetId === targetId);
    if (!target) return null;
    return {
      targetType: target.targetType,
      targetId: target.targetId,
      targetName: target.label
    };
  };

  const getFactProposalTargetValue = (proposal: LoreFactProposal): string => {
    const draft = factTargetDrafts[proposal.id];
    if (draft) return `entity:${draft.targetId}`;
    return proposal.targetType === 'entity' && proposal.targetId
      ? `entity:${proposal.targetId}`
      : '';
  };

  const handleAcceptProposal = async (proposal: LoreFactProposal) => {
    const target = getFactProposalTarget(proposal);
    if (!activeProject || !target) {
      setFeedback({
        tone: 'error',
        message: 'Choose a target for this fact before accepting it.'
      });
      return;
    }
    setActingProposalId(proposal.id);
    setFeedback(null);
    const now = Date.now();
    const fact: CanonicalFact = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      targetType: target.targetType,
      targetId: target.targetId,
      targetName: target.targetName,
      loreDocumentId: proposal.loreDocumentId,
      sourceLoreDocumentTitle:
        documents.find((document) => document.id === proposal.loreDocumentId)?.title ??
        undefined,
      sourceProposalId: proposal.id,
      factType: proposal.factType,
      value: proposal.value,
      evidenceText: proposal.evidence.text,
      evidenceStart: proposal.evidence.start,
      evidenceEnd: proposal.evidence.end,
      acceptedAt: now,
      updatedAt: now
    };

    const nextProposal: LoreFactProposal = {
      ...proposal,
      status: 'accepted',
      targetType: target.targetType,
      targetId: target.targetId,
      targetName: target.targetName,
      updatedAt: now
    };

    try {
      // The fact, its proposal, and its side effects commit together.
      await acceptCanonicalFact({projectId: activeProject.id, fact, proposal: nextProposal});
      if (shodhService) {
        await captureCanonicalFactMemory(shodhService, fact, sourceScenes);
        const memories = await shodhService.listMemories();
        setShodhMemories(memories);
        emitShodhMemoriesUpdated(memories);
      }
      if (ragService) {
        await ragService.indexDocument(
          `canon-fact:${fact.id}`,
          fact.targetName ?? fact.targetId,
          buildCanonicalFactSummary(fact, sourceScenes),
          'canon_fact',
          {
            tags: ['canon_fact', fact.factType, ...getCanonicalFactValidityTags(fact)],
            entityIds: [fact.targetId]
          }
        );
      }
      await refreshContextHealth();
      setCanonicalFacts((current) => prependUniqueCanonicalFact(current, fact));
      setProposals((current) =>
        current.map((entry) => (entry.id === nextProposal.id ? nextProposal : entry))
      );
      setFactTargetDrafts((current) => {
        const next = {...current};
        delete next[proposal.id];
        return next;
      });
      setFeedback({tone: 'success', message: 'Fact accepted into canon.'});
    } catch (error) {
      const message = describeError(error, 'Unable to accept fact.');
      setFeedback({tone: 'error', message});
    } finally {
      setActingProposalId(null);
    }
  };

  const handleAcceptEntityProposal = async (proposal: LoreEntityProposal) => {
    setActingEntityProposalId(proposal.id);
    setFeedback(null);
    try {
      const existingLinks = linksByDocumentId.get(proposal.loreDocumentId) ?? [];
      // Canon, links, and the proposal's accepted status commit together.
      const acceptedTarget = await acceptLoreEntityProposal({
        proposal,
        existingLinks
      });
      const document = documents.find((entry) => entry.id === proposal.loreDocumentId);
      if (activeProject && document) {
        const [nextEntities, nextLinks, nextFacts] = await Promise.all([
          getEntitiesByProject(activeProject.id),
          getLoreDocumentLinksByProject(activeProject.id),
          getCanonicalFactsByProject(activeProject.id)
        ]);
        const documentLinks = nextLinks.filter(
          (link) => link.loreDocumentId === proposal.loreDocumentId
        );
        const refreshedFactProposals = extractLoreFactProposals({
          projectId: activeProject.id,
          document,
          links: documentLinks,
          knownTargets: nextEntities.map((entity) => ({
            type: 'entity' as const,
            id: entity.id,
            name: entity.name
          })),
          existingFacts: nextFacts
        });
        await replaceLoreFactProposals({
          projectId: activeProject.id,
          loreDocumentId: proposal.loreDocumentId,
          proposals: refreshedFactProposals
        });
        setEntities(nextEntities);
        setDocumentLinks(nextLinks);
        setCanonicalFacts(nextFacts);
        setProposals((current) => [
          ...current.filter(
            (entry) => entry.loreDocumentId !== proposal.loreDocumentId
          ),
          ...refreshedFactProposals
        ]);
        setFactTargetDrafts({});
      }
      setEntityProposals((current) =>
        current.map((entry) =>
          entry.id === proposal.id
            ? {
                ...entry,
                status: 'accepted',
                targetType: acceptedTarget.targetType,
                targetId: acceptedTarget.targetId,
                updatedAt: Date.now()
              }
            : entry
        )
      );
      setFeedback({
        tone: 'success',
        message:
          proposal.targetId
            ? `"${proposal.name}" linked to existing ${proposal.targetType === 'character' ? 'character' : 'world record'}.`
            : `"${proposal.name}" created from lore.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to accept entity proposal.');
      setFeedback({tone: 'error', message});
    } finally {
      setActingEntityProposalId(null);
    }
  };

  const handleRejectEntityProposal = async (proposal: LoreEntityProposal) => {
    setActingEntityProposalId(proposal.id);
    setFeedback(null);
    try {
      await saveLoreEntityProposal({
        ...proposal,
        status: 'rejected',
        updatedAt: Date.now()
      });
      setEntityProposals((current) =>
        current.map((entry) =>
          entry.id === proposal.id
            ? {...entry, status: 'rejected', updatedAt: Date.now()}
            : entry
        )
      );
      setFeedback({tone: 'success', message: 'Entity proposal rejected.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to reject entity proposal.');
      setFeedback({tone: 'error', message});
    } finally {
      setActingEntityProposalId(null);
    }
  };

  const handleRejectProposal = async (proposal: LoreFactProposal) => {
    setActingProposalId(proposal.id);
    setFeedback(null);
    try {
      await saveLoreFactProposal({
        ...proposal,
        status: 'rejected',
        updatedAt: Date.now()
      });
      setProposals((current) =>
        current.map((entry) =>
          entry.id === proposal.id
            ? {...entry, status: 'rejected', updatedAt: Date.now()}
            : entry
        )
      );
      setFeedback({tone: 'success', message: 'Proposal rejected.'});
    } catch (error) {
      const message = describeError(error, 'Unable to reject proposal.');
      setFeedback({tone: 'error', message});
    } finally {
      setActingProposalId(null);
    }
  };

  const handleRemoveFact = (fact: CanonicalFact) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    requestConfirm({
      title: 'Remove this accepted fact from canon?',
      message: 'The source proposal will reopen for review instead of being discarded.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        setRemovingFactId(fact.id);
        setFeedback(null);
        try {
          const remainingFacts = canonicalFacts.filter((entry) => entry.id !== fact.id);
          const sourceProposal = proposals.find((proposal) => proposal.id === fact.sourceProposalId);
          const reopenedProposal: LoreFactProposal | undefined = sourceProposal
            ? {...sourceProposal, status: 'proposed', updatedAt: Date.now()}
            : undefined;
          // Side-effect revert, fact deletion, and proposal reopening commit together.
          await removeCanonicalFact({projectId, fact, remainingFacts, reopenedProposal});
          if (reopenedProposal) {
            setProposals((current) =>
              current.map((proposal) =>
                proposal.id === reopenedProposal.id ? reopenedProposal : proposal
              )
            );
          }
          if (ragService) {
            await ragService.deleteDocument(`canon-fact:${fact.id}`);
          }
          if (shodhService) {
            await deleteCanonicalFactMemory(shodhService, fact.id);
            const memories = await shodhService.listMemories();
            setShodhMemories(memories);
            emitShodhMemoriesUpdated(memories);
          }
          await refreshContextHealth();
          setCanonicalFacts((current) => current.filter((entry) => entry.id !== fact.id));
          setFeedback({tone: 'success', message: 'Accepted fact removed.'});
        } catch (error) {
          const message =
            describeError(error, 'Unable to remove accepted fact.');
          setFeedback({tone: 'error', message});
        } finally {
          setRemovingFactId(null);
        }
      }
    });
  };

  const updateFactTargetDraft = (proposalId: string, value: string) => {
    setFactTargetDrafts((current) => {
      if (!value) {
        const next = {...current};
        delete next[proposalId];
        return next;
      }
      const [targetType, targetId] = value.split(':');
      if (targetType !== 'entity' || !targetId) {
        return current;
      }
      return {
        ...current,
        [proposalId]: {
          targetType,
          targetId
        }
      };
    });
  };

  return {
    extractingId,
    actingProposalId,
    actingEntityProposalId,
    removingFactId,
    factLinkableTargets,
    editingDocumentProposals,
    editingEntityProposals,
    editingDocumentFacts,
    sourceScenes,
    handleExtractFacts,
    getFactProposalTargetValue,
    updateFactTargetDraft,
    handleAcceptProposal,
    handleRejectProposal,
    handleAcceptEntityProposal,
    handleRejectEntityProposal,
    handleRemoveFact
  };
}

export type SourceNoteExtractionReviewState = ReturnType<typeof useSourceNoteExtractionReview>;
