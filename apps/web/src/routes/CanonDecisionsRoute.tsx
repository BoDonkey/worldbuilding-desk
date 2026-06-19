import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppStore} from '../store/appStore';
import type {
  CanonDecisionCluster,
  CanonicalFact,
  Character,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity
} from '../entityTypes';
import {LLMService} from '../services/llm/LLMService';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getLoreDocumentsByProject, getLoreDocumentLinksByProject} from '../loreStorage';
import {saveAlias} from '../services/consistency';
import {
  getCanonicalFactsByProject,
  deleteCanonicalFact,
  getLoreFactProposalsByProject,
  saveCanonicalFact,
  saveLoreFactProposal
} from '../services/lore/loreFactStorage';
import {
  getLoreEntityProposalsByProject,
  saveLoreEntityProposal
} from '../services/lore/loreEntityProposalStorage';
import {
  getCanonDecisionClustersByProject,
  replaceCanonDecisionClusters,
  saveCanonDecisionCluster
} from '../services/lore/canonDecisionStorage';
import {
  buildEntityDecisionSuppressionKey,
  buildFactDecisionSuppressionKey,
  getCanonDecisionSuppressionsByProject,
  saveCanonDecisionSuppression
} from '../services/lore/canonDecisionSuppressionStorage';
import {buildCanonDecisionClusters} from '../services/lore/canonDecisionClustering';
import {buildCanonDecisionConsultationPrompt} from '../services/lore/canonDecisionConsultation';
import {acceptLoreEntityProposal} from '../services/lore/entityProposalActions';
import {
  applyCanonicalFactSideEffects,
  buildCanonicalFactSummary
} from '../services/lore/canonicalFactActions';
import {getRAGService} from '../services/rag/getRAGService';
import type {RAGProvider} from '../services/rag/RAGService';
import {
  getInspectorConsultationUsage,
  incrementInspectorConsultationUsage
} from '../services/editor';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import styles from '../styles/CanonDecisionsRoute.module.css';

const PROVIDER_LABELS = {
  anthropic: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  ollama: 'Local Ollama'
} as const;

function CanonDecisionsRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const [documents, setDocuments] = useState<LoreDocument[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [entityProposals, setEntityProposals] = useState<LoreEntityProposal[]>([]);
  const [factProposals, setFactProposals] = useState<LoreFactProposal[]>([]);
  const [canonicalFacts, setCanonicalFacts] = useState<CanonicalFact[]>([]);
  const [clusters, setClusters] = useState<CanonDecisionCluster[]>([]);
  const [documentLinksById, setDocumentLinksById] = useState<Map<string, LoreDocumentLink[]>>(
    new Map()
  );
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [actingClusterId, setActingClusterId] = useState<string | null>(null);
  const [consultingClusterId, setConsultingClusterId] = useState<string | null>(null);
  const [consultationByClusterId, setConsultationByClusterId] = useState<
    Record<string, {content?: string; error?: string}>
  >({});
  const [aiBudgetUsed, setAIBudgetUsed] = useState(0);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!activeProject) {
      setDocuments([]);
      setCharacters([]);
      setEntities([]);
      setEntityProposals([]);
      setFactProposals([]);
      setCanonicalFacts([]);
      setClusters([]);
      setDocumentLinksById(new Map());
      return;
    }

    const [
      loadedDocuments,
      loadedDocumentLinks,
      loadedCharacters,
      loadedEntities,
      loadedEntityProposals,
      loadedFactProposals,
      loadedCanonicalFacts,
      existingClusters,
      loadedSuppressions,
      nextRagService
    ] = await Promise.all([
      getLoreDocumentsByProject(activeProject.id),
      getLoreDocumentLinksByProject(activeProject.id),
      getCharactersByProject(activeProject.id),
      getEntitiesByProject(activeProject.id),
      getLoreEntityProposalsByProject(activeProject.id),
      getLoreFactProposalsByProject(activeProject.id),
      getCanonicalFactsByProject(activeProject.id),
      getCanonDecisionClustersByProject(activeProject.id),
      getCanonDecisionSuppressionsByProject(activeProject.id),
      getRAGService({
        projectId: activeProject.id,
        inheritFromParent: activeProject.inheritRag,
        parentProjectId: activeProject.parentProjectId
      })
    ]);

    const nextClusters = buildCanonDecisionClusters({
      projectId: activeProject.id,
      entityProposals: loadedEntityProposals,
      factProposals: loadedFactProposals,
      canonicalFacts: loadedCanonicalFacts,
      characters: loadedCharacters,
      entities: loadedEntities,
      existingClusters,
      suppressions: loadedSuppressions
    });
    await replaceCanonDecisionClusters({
      projectId: activeProject.id,
      clusters: nextClusters
    });

    const linksMap = new Map<string, typeof loadedDocumentLinks>();
    loadedDocumentLinks.forEach((link) => {
      const current = linksMap.get(link.loreDocumentId) ?? [];
      current.push(link);
      linksMap.set(link.loreDocumentId, current);
    });

    setDocuments(loadedDocuments);
    setCharacters(loadedCharacters);
    setEntities(loadedEntities);
    setEntityProposals(loadedEntityProposals);
    setFactProposals(loadedFactProposals);
    setCanonicalFacts(loadedCanonicalFacts);
    setClusters(nextClusters);
    setDocumentLinksById(linksMap);
    setRagService(nextRagService);
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setAIBudgetUsed(0);
      return;
    }
    setAIBudgetUsed(getInspectorConsultationUsage(activeProject.id));
  }, [activeProject]);

  useEffect(() => {
    void refresh();
    const handleChanged = () => {
      void refresh();
    };
    window.addEventListener('wbd:lore-fact-records-changed', handleChanged);
    window.addEventListener('wbd:lore-records-changed', handleChanged);
    window.addEventListener('wbd:entity-records-changed', handleChanged);
    window.addEventListener('wbd:character-records-changed', handleChanged);
    window.addEventListener('wbd:alias-records-changed', handleChanged);
    window.addEventListener('wbd:canon-decision-records-changed', handleChanged);
    return () => {
      window.removeEventListener('wbd:lore-fact-records-changed', handleChanged);
      window.removeEventListener('wbd:lore-records-changed', handleChanged);
      window.removeEventListener('wbd:entity-records-changed', handleChanged);
      window.removeEventListener('wbd:character-records-changed', handleChanged);
      window.removeEventListener('wbd:alias-records-changed', handleChanged);
      window.removeEventListener('wbd:canon-decision-records-changed', handleChanged);
    };
  }, [refresh]);

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents]
  );
  const entityProposalsById = useMemo(
    () => new Map(entityProposals.map((proposal) => [proposal.id, proposal])),
    [entityProposals]
  );
  const factProposalsById = useMemo(
    () => new Map(factProposals.map((proposal) => [proposal.id, proposal])),
    [factProposals]
  );
  const canonicalFactsById = useMemo(
    () => new Map(canonicalFacts.map((fact) => [fact.id, fact])),
    [canonicalFacts]
  );
  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const entitiesById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities]
  );
  const canonDecisionProviderMode =
    projectSettings?.aiSettings?.inspectorSettings?.canonDecisionProviderMode ?? 'project-provider';
  const effectiveAIProviderId =
    canonDecisionProviderMode === 'local-ollama'
      ? 'ollama'
      : projectSettings?.aiSettings?.provider;
  const aiProviderLabel = effectiveAIProviderId
    ? PROVIDER_LABELS[effectiveAIProviderId]
    : 'AI';
  const aiConsultationEnabled =
    projectSettings?.aiSettings?.inspectorSettings?.enableAIConsultation !== false;
  const aiBudgetMax =
    projectSettings?.aiSettings?.inspectorSettings?.maxConsultationsPerDay ?? 20;

  const resolveCluster = async (
    cluster: CanonDecisionCluster,
    resolution: CanonDecisionCluster['resolution'],
    status: CanonDecisionCluster['status']
  ) => {
    await saveCanonDecisionCluster({
      ...cluster,
      resolution,
      status,
      updatedAt: Date.now()
    });
  };

  const persistEntitySuppression = async (cluster: CanonDecisionCluster) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
    const targetRef = cluster.memberRefs.find(
      (ref) => ref.type === 'character' || ref.type === 'world_entity'
    );
    if (!proposalRef || !targetRef || !activeProject) return;
    const proposal = entityProposalsById.get(proposalRef.id);
    const targetName =
      targetRef.type === 'character'
        ? charactersById.get(targetRef.id)?.name
        : entitiesById.get(targetRef.id)?.name;
    if (!proposal || !targetName) return;
    await saveCanonDecisionSuppression({
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      kind: 'entity_identity',
      key: buildEntityDecisionSuppressionKey({
        proposalName: proposal.name,
        targetName
      }),
      resolution: 'keep_separate',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  const persistAliasSuppression = async (cluster: CanonDecisionCluster) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
    const targetRef = cluster.memberRefs.find(
      (ref) => ref.type === 'character' || ref.type === 'world_entity'
    );
    if (!proposalRef || !targetRef || !activeProject) return;
    const proposal = entityProposalsById.get(proposalRef.id);
    const targetName =
      targetRef.type === 'character'
        ? charactersById.get(targetRef.id)?.name
        : entitiesById.get(targetRef.id)?.name;
    if (!proposal || !targetName) return;
    await saveCanonDecisionSuppression({
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      kind: 'entity_identity',
      key: buildEntityDecisionSuppressionKey({
        proposalName: proposal.name,
        targetName
      }),
      resolution: 'alias',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  const persistFactSuppression = async (
    cluster: CanonDecisionCluster,
    resolution: 'reject' | 'accept_update' | 'keep_separate'
  ) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_fact_proposal');
    const canonicalRef = cluster.memberRefs.find((ref) => ref.type === 'canonical_fact');
    if (!proposalRef || !canonicalRef || !activeProject) return;
    const proposal = factProposalsById.get(proposalRef.id);
    const canonicalFact = canonicalFactsById.get(canonicalRef.id);
    if (!proposal || !canonicalFact || !proposal.targetType || !proposal.targetId) return;
    await saveCanonDecisionSuppression({
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      kind: 'fact_conflict',
      key: buildFactDecisionSuppressionKey({
        targetType: proposal.targetType,
        targetId: proposal.targetId,
        factType: proposal.factType,
        canonicalValue:
          typeof canonicalFact.value === 'string'
            ? canonicalFact.value
            : `${canonicalFact.value.label}: ${canonicalFact.value.value}`,
        proposalValue:
          typeof proposal.value === 'string'
            ? proposal.value
            : `${proposal.value.label}: ${proposal.value.value}`
      }),
      resolution,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  const handleAliasEntity = async (cluster: CanonDecisionCluster) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
    const targetRef = cluster.memberRefs.find(
      (ref) => ref.type === 'character' || ref.type === 'world_entity'
    );
    if (!proposalRef || !targetRef || !activeProject) return;
    const proposal = entityProposalsById.get(proposalRef.id);
    if (!proposal) return;
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      const nextProposal: LoreEntityProposal = {
        ...proposal,
        targetType: targetRef.type === 'character' ? 'character' : 'entity',
        targetId: targetRef.id,
        status: 'accepted',
        updatedAt: Date.now()
      };
      await acceptLoreEntityProposal({
        proposal: nextProposal,
        existingLinks: documentLinksById.get(proposal.loreDocumentId) ?? []
      });
      await saveAlias({
        projectId: activeProject.id,
        targetId: targetRef.id,
        targetType: targetRef.type === 'character' ? 'character' : 'entity',
        alias: proposal.name
      });
      await saveLoreEntityProposal(nextProposal);
      await persistAliasSuppression(cluster);
      await resolveCluster(cluster, 'alias', 'resolved');
      setFeedback({tone: 'success', message: `"${proposal.name}" aliased to existing canon.`});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to alias candidate.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleAcceptNewEntity = async (cluster: CanonDecisionCluster) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
    if (!proposalRef) return;
    const proposal = entityProposalsById.get(proposalRef.id);
    if (!proposal) return;
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      const target = await acceptLoreEntityProposal({
        proposal: {
          ...proposal,
          targetType: undefined,
          targetId: undefined
        },
        existingLinks: documentLinksById.get(proposal.loreDocumentId) ?? []
      });
      await saveLoreEntityProposal({
        ...proposal,
        targetType: target.targetType,
        targetId: target.targetId,
        status: 'accepted',
        updatedAt: Date.now()
      });
      await resolveCluster(cluster, 'accept_new', 'resolved');
      setFeedback({tone: 'success', message: `"${proposal.name}" created as new canon.`});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to accept new candidate.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleAcceptFactUpdate = async (cluster: CanonDecisionCluster) => {
    const proposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_fact_proposal');
    const canonicalRef = cluster.memberRefs.find((ref) => ref.type === 'canonical_fact');
    if (!proposalRef || !canonicalRef || !activeProject) return;
    const proposal = factProposalsById.get(proposalRef.id);
    const previousFact = canonicalFactsById.get(canonicalRef.id);
    if (!proposal || !previousFact || !proposal.targetType || !proposal.targetId) return;
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      const sourceDocument = documentsById.get(proposal.loreDocumentId);
      const nextFact: CanonicalFact = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        targetType: proposal.targetType,
        targetId: proposal.targetId,
        targetName: proposal.targetName,
        loreDocumentId: proposal.loreDocumentId,
        sourceLoreDocumentTitle: sourceDocument?.title,
        sourceProposalId: proposal.id,
        factType: proposal.factType,
        value: proposal.value,
        evidenceText: proposal.evidence.text,
        evidenceStart: proposal.evidence.start,
        evidenceEnd: proposal.evidence.end,
        acceptedAt: Date.now(),
        updatedAt: Date.now()
      };
      await deleteCanonicalFact(previousFact.id);
      await saveCanonicalFact(nextFact);
      await saveLoreFactProposal({
        ...proposal,
        status: 'accepted',
        updatedAt: Date.now()
      });
      await applyCanonicalFactSideEffects(activeProject.id, nextFact);
      if (ragService) {
        await ragService.deleteDocument(`canon-fact:${previousFact.id}`);
        await ragService.indexDocument(
          `canon-fact:${nextFact.id}`,
          nextFact.targetName ?? nextFact.targetId,
          buildCanonicalFactSummary(nextFact),
          'canon_fact',
          {
            tags: ['canon_fact', nextFact.factType],
            entityIds: [nextFact.targetId]
          }
        );
      }
      await resolveCluster(cluster, 'accept_update', 'resolved');
      await persistFactSuppression(cluster, 'accept_update');
      setFeedback({tone: 'success', message: 'Canonical fact updated.'});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update canonical fact.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleKeepSeparate = async (cluster: CanonDecisionCluster) => {
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      if (cluster.kind === 'entity_identity') {
        await persistEntitySuppression(cluster);
      }
      if (cluster.kind === 'fact_conflict') {
        await persistFactSuppression(cluster, 'keep_separate');
      }
      await resolveCluster(cluster, 'keep_separate', 'resolved');
      setFeedback({tone: 'success', message: 'Cluster marked keep separate.'});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update cluster.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleReject = async (cluster: CanonDecisionCluster) => {
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      const entityProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
      const factProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_fact_proposal');
      if (entityProposalRef) {
        const proposal = entityProposalsById.get(entityProposalRef.id);
        if (proposal) {
          await saveLoreEntityProposal({...proposal, status: 'rejected', updatedAt: Date.now()});
        }
      }
      if (factProposalRef) {
        const proposal = factProposalsById.get(factProposalRef.id);
        if (proposal) {
          await saveLoreFactProposal({...proposal, status: 'rejected', updatedAt: Date.now()});
        }
      }
      if (cluster.kind === 'fact_conflict') {
        await persistFactSuppression(cluster, 'reject');
      }
      await resolveCluster(cluster, 'reject', 'resolved');
      setFeedback({tone: 'success', message: 'Cluster rejected.'});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reject cluster.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleDefer = async (cluster: CanonDecisionCluster) => {
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      await resolveCluster(cluster, 'defer', 'deferred');
      setFeedback({tone: 'success', message: 'Cluster deferred.'});
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to defer cluster.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleConsultCluster = async (cluster: CanonDecisionCluster) => {
    if (!activeProject) return;
    if (!projectSettings?.aiSettings) {
      setFeedback({tone: 'error', message: 'Configure an AI provider in Settings first.'});
      return;
    }
    if (!aiConsultationEnabled) {
      setFeedback({tone: 'error', message: 'AI consultation is disabled in Settings.'});
      return;
    }
    const used = getInspectorConsultationUsage(activeProject.id);
    if (used >= aiBudgetMax) {
      setFeedback({
        tone: 'error',
        message: `AI consultation budget reached for today (${used}/${aiBudgetMax}).`
      });
      return;
    }

    const entityProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
    const factProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_fact_proposal');
    const canonicalFactRef = cluster.memberRefs.find((ref) => ref.type === 'canonical_fact');
    const targetRef = cluster.memberRefs.find(
      (ref) => ref.type === 'character' || ref.type === 'world_entity'
    );
    const entityProposal = entityProposalRef
      ? entityProposalsById.get(entityProposalRef.id) ?? null
      : null;
    const factProposal = factProposalRef
      ? factProposalsById.get(factProposalRef.id) ?? null
      : null;
    const canonicalFact = canonicalFactRef
      ? canonicalFactsById.get(canonicalFactRef.id) ?? null
      : null;
    const targetCharacter =
      targetRef?.type === 'character' ? charactersById.get(targetRef.id) ?? null : null;
    const targetEntity =
      targetRef?.type === 'world_entity' ? entitiesById.get(targetRef.id) ?? null : null;
    const sourceDocumentId = entityProposal?.loreDocumentId ?? factProposal?.loreDocumentId;
    const sourceDocument = sourceDocumentId ? documentsById.get(sourceDocumentId) ?? null : null;
    const {searchQuery, systemPrompt, userPrompt} = buildCanonDecisionConsultationPrompt({
      cluster,
      entityProposal,
      factProposal,
      canonicalFact,
      targetCharacter,
      targetEntity,
      sourceDocument
    });

    setConsultingClusterId(cluster.id);
    setConsultationByClusterId((prev) => ({
      ...prev,
      [cluster.id]: {content: ''}
    }));
    setFeedback(null);

    try {
      const aiSettingsForConsultation =
        canonDecisionProviderMode === 'local-ollama'
          ? {
              ...projectSettings.aiSettings,
              provider: 'ollama' as const
            }
          : projectSettings.aiSettings;
      const service = new LLMService(aiSettingsForConsultation);
      const nextUsed = incrementInspectorConsultationUsage(activeProject.id);
      setAIBudgetUsed(nextUsed);

      const ragChunks = ragService
        ? (await ragService.search(searchQuery, 3)).map((result) => ({
            content: result.chunk.content,
            source: result.chunk.documentTitle,
            relevance: result.score
          }))
        : [];

      let content = '';
      for await (const chunkText of service.stream({
        messages: [{role: 'user', content: userPrompt}],
        systemPrompt,
        context: ragChunks,
        model: projectSettings.aiSettings.inspectorSettings?.lowCostModel?.trim() || undefined,
        maxTokens: projectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      })) {
        content += chunkText;
        setConsultationByClusterId((prev) => ({
          ...prev,
          [cluster.id]: {content}
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI consultation failed for this cluster.';
      setConsultationByClusterId((prev) => ({
        ...prev,
        [cluster.id]: {error: message}
      }));
    } finally {
      setConsultingClusterId(null);
    }
  };

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.pageTitle}>Canon Decisions</h1>
        <p className={styles.pageIntro}>Open a project first to review canon decisions.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Source of truth review'
        title='Canon Decisions'
        description='Resolve likely duplicate entities and conflicting facts before they turn into noisy canon.'
        actions={<ProjectScratchpadButton projectId={activeProject.id} />}
      />
      <div className={styles.utilityRow}>
        <span className={styles.countBadge}>{clusters.length}</span>
      </div>

      {feedback ? (
        <p
          className={`${styles.feedback} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
          role='status'
        >
          {feedback.message}
        </p>
      ) : null}

      {clusters.length === 0 ? (
        <div className={styles.emptyPanel}>
          <h2>No open canon decisions</h2>
          <p>
            Extraction candidates currently look clean enough to avoid duplicate or conflict review.
          </p>
        </div>
      ) : (
        <div className={styles.clusterList}>
          {clusters.map((cluster) => {
            const entityProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_entity_proposal');
            const factProposalRef = cluster.memberRefs.find((ref) => ref.type === 'lore_fact_proposal');
            const canonicalFactRef = cluster.memberRefs.find((ref) => ref.type === 'canonical_fact');
            const targetRef = cluster.memberRefs.find(
              (ref) => ref.type === 'character' || ref.type === 'world_entity'
            );
            const entityProposal = entityProposalRef
              ? entityProposalsById.get(entityProposalRef.id)
              : null;
            const factProposal = factProposalRef
              ? factProposalsById.get(factProposalRef.id)
              : null;
            const canonicalFact = canonicalFactRef
              ? canonicalFactsById.get(canonicalFactRef.id)
              : null;
            const targetLabel = targetRef
              ? targetRef.type === 'character'
                ? charactersById.get(targetRef.id)?.name
                : entitiesById.get(targetRef.id)?.name
              : null;

            return (
              <article key={cluster.id} className={styles.clusterCard}>
                <div className={styles.clusterHeader}>
                  <div>
                    <p className={styles.clusterKind}>{cluster.kind.replace(/_/g, ' ')}</p>
                    <h2>{cluster.title}</h2>
                  </div>
                  <span className={styles.statusBadge}>{cluster.status}</span>
                </div>
                <p className={styles.clusterSummary}>{cluster.summary}</p>
                <div className={styles.reasonRow}>
                  {cluster.reasonCodes.map((reason) => (
                    <span key={reason} className={styles.reasonChip}>
                      {reason.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {entityProposal ? (
                  <div className={styles.detailPanel}>
                    <p><strong>Candidate:</strong> {entityProposal.name}</p>
                    <p><strong>Kind:</strong> {entityProposal.entityKind}</p>
                    <p><strong>Evidence:</strong> {entityProposal.evidence.text}</p>
                    {targetLabel ? <p><strong>Existing match:</strong> {targetLabel}</p> : null}
                  </div>
                ) : null}

                {factProposal && canonicalFact ? (
                  <div className={styles.detailPanel}>
                    <p><strong>Proposed:</strong> {factProposal.factType} = {typeof factProposal.value === 'string' ? factProposal.value : `${factProposal.value.label}: ${factProposal.value.value}`}</p>
                    <p><strong>Current canon:</strong> {buildCanonicalFactSummary(canonicalFact)}</p>
                    <p><strong>Evidence:</strong> {factProposal.evidence.text}</p>
                  </div>
                ) : null}

                <div className={styles.aiPanel}>
                  <div className={styles.aiPanelHeader}>
                    <p className={styles.aiPanelTitle}>Rubber-Duck AI</p>
                    <span className={styles.aiPanelMeta}>
                      {aiProviderLabel} · {aiBudgetUsed}/{aiBudgetMax} today
                    </span>
                  </div>
                  {consultationByClusterId[cluster.id]?.error ? (
                    <p className={styles.aiError}>{consultationByClusterId[cluster.id]?.error}</p>
                  ) : consultationByClusterId[cluster.id]?.content ? (
                    <div className={styles.aiResponse}>
                      {consultationByClusterId[cluster.id]?.content}
                    </div>
                  ) : (
                    <p className={styles.aiHint}>
                      Ask the model to compare the evidence, explain ambiguity, and suggest the safest next canon decision.
                    </p>
                  )}
                </div>

                <div className={styles.actionRow}>
                  <button
                    type='button'
                    onClick={() => void handleConsultCluster(cluster)}
                    disabled={
                      actingClusterId === cluster.id ||
                      consultingClusterId === cluster.id ||
                      !projectSettings?.aiSettings ||
                      !aiConsultationEnabled
                    }
                  >
                    {consultingClusterId === cluster.id
                      ? `Asking ${aiProviderLabel}...`
                      : `Ask ${aiProviderLabel}`}
                  </button>
                  {cluster.kind === 'entity_identity' ? (
                    <>
                      {targetRef ? (
                        <button
                          type='button'
                          onClick={() => void handleAliasEntity(cluster)}
                          disabled={actingClusterId === cluster.id}
                        >
                          Alias To Existing
                        </button>
                      ) : null}
                      <button
                        type='button'
                        onClick={() => void handleAcceptNewEntity(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Accept New
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleKeepSeparate(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Keep Separate
                      </button>
                    </>
                  ) : null}

                  {cluster.kind === 'fact_conflict' ? (
                    <>
                      <button
                        type='button'
                        onClick={() => void handleAcceptFactUpdate(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Accept Update
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleKeepSeparate(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Keep Separate
                      </button>
                    </>
                  ) : null}

                  <button
                    type='button'
                    onClick={() => void handleReject(cluster)}
                    disabled={actingClusterId === cluster.id}
                  >
                    Reject
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleDefer(cluster)}
                    disabled={actingClusterId === cluster.id}
                  >
                    Defer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CanonDecisionsRoute;
