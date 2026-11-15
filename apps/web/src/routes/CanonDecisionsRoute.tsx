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
  WritingDocument,
  WorldEntity
} from '../entityTypes';
import {
  getCharactersByProject,
  getEntitiesByProject,
  getLoreDocumentsByProject,
  getLoreDocumentLinksByProject,
  getDocumentsByProject,
  getCanonicalFactsByProject,
  getLoreFactProposalsByProject,
  getLoreEntityProposalsByProject,
  getCanonDecisionClustersByProject,
  replaceCanonDecisionClusters,
  getCanonDecisionSuppressionsByProject
} from '../services/storage';
import {buildCanonDecisionClusters} from '../services/lore/canonDecisionClustering';
import {
  findCanonDecisionMembers,
  type CanonDecisionContext,
  type CanonDecisionRecords
} from '../services/lore/canonDecisionActions';
import {
  CANON_DECISION_ACTION_LABELS,
  parseCanonDecisionRecommendation,
  type CanonDecisionRecommendedAction
} from '../services/lore/canonDecisionRecommendation';
import {AIProposalPreview} from '../components/common/AIProposalPreview';
import {buildCanonicalFactSummary} from '../services/lore/canonicalFactActions';
import {getRAGService} from '../services/rag/getRAGService';
import type {RAGProvider} from '../services/rag/RAGService';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import styles from '../styles/CanonDecisionsRoute.module.css';
import {ConsultationBudgetNotice, ModelRunProgress, RouteFeedback} from '../components/common';
import {useCanonDecisionActions} from '../hooks/useCanonDecisionActions';
import {useCanonDecisionConsultation} from '../hooks/useCanonDecisionConsultation';
import {RECORDS_CHANGED} from '../services/recordEvents';

function CanonDecisionsRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const [documents, setDocuments] = useState<LoreDocument[]>([]);
  const [scenes, setScenes] = useState<WritingDocument[]>([]);
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

  const refresh = useCallback(async () => {
    if (!activeProject) {
      setDocuments([]);
      setScenes([]);
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
      loadedScenes,
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
      getDocumentsByProject(activeProject.id),
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
    setScenes(loadedScenes);
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
    void refresh();
    const handleChanged = () => {
      void refresh();
    };
    window.addEventListener(RECORDS_CHANGED.loreFact, handleChanged);
    window.addEventListener(RECORDS_CHANGED.lore, handleChanged);
    window.addEventListener(RECORDS_CHANGED.entity, handleChanged);
    window.addEventListener(RECORDS_CHANGED.character, handleChanged);
    window.addEventListener(RECORDS_CHANGED.alias, handleChanged);
    window.addEventListener(RECORDS_CHANGED.canonDecision, handleChanged);
    return () => {
      window.removeEventListener(RECORDS_CHANGED.loreFact, handleChanged);
      window.removeEventListener(RECORDS_CHANGED.lore, handleChanged);
      window.removeEventListener(RECORDS_CHANGED.entity, handleChanged);
      window.removeEventListener(RECORDS_CHANGED.character, handleChanged);
      window.removeEventListener(RECORDS_CHANGED.alias, handleChanged);
      window.removeEventListener(RECORDS_CHANGED.canonDecision, handleChanged);
    };
  }, [refresh]);

  const records = useMemo<CanonDecisionRecords>(
    () => ({
      documentsById: new Map(documents.map((document) => [document.id, document])),
      entityProposalsById: new Map(entityProposals.map((proposal) => [proposal.id, proposal])),
      factProposalsById: new Map(factProposals.map((proposal) => [proposal.id, proposal])),
      canonicalFactsById: new Map(canonicalFacts.map((fact) => [fact.id, fact])),
      charactersById: new Map(characters.map((character) => [character.id, character])),
      entitiesById: new Map(entities.map((entity) => [entity.id, entity])),
      documentLinksById,
      canonicalFacts,
      scenes
    }),
    [documents, entityProposals, factProposals, canonicalFacts, characters, entities, documentLinksById, scenes]
  );
  const decisionContext = useMemo<CanonDecisionContext | null>(
    () => (activeProject ? {project: activeProject, records, ragService} : null),
    [activeProject, records, ragService]
  );
  const actions = useCanonDecisionActions({context: decisionContext, refresh});
  const {actingClusterId, feedback, setFeedback, factEffectiveSceneByClusterId} = actions;
  const consultation = useCanonDecisionConsultation({
    activeProject,
    projectSettings,
    records,
    ragService,
    setFeedback
  });
  const {
    modelRun,
    budget,
    aiProviderLabel,
    aiConsultationEnabled,
    consultingClusterId,
    runClusterId,
    consultationByClusterId,
    dismissedRecommendationClusterIds
  } = consultation;

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

      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />

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
            const {
              entityProposal,
              factProposal,
              canonicalFact,
              targetRef,
              targetName: targetLabel
            } = findCanonDecisionMembers(records, cluster);
            const recommendation =
              consultingClusterId !== cluster.id && !dismissedRecommendationClusterIds.has(cluster.id)
                ? parseCanonDecisionRecommendation(
                    consultationByClusterId[cluster.id]?.content ?? '',
                    cluster.kind
                  )
                : null;
            const recommendedActionHandlers: Partial<
              Record<CanonDecisionRecommendedAction, () => Promise<void>>
            > = {
              alias: targetRef ? () => actions.handleAliasEntity(cluster) : undefined,
              accept_new: () => actions.handleAcceptNewEntity(cluster),
              accept_update: () => actions.handleAcceptFactUpdate(cluster),
              keep_separate: () => actions.handleKeepSeparate(cluster),
              reject: () => actions.handleReject(cluster),
              defer: () => actions.handleDefer(cluster)
            };
            const recommendedActionHandler = recommendation
              ? recommendedActionHandlers[recommendation.action]
              : undefined;

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
                    <p><strong>Current canon:</strong> {buildCanonicalFactSummary(canonicalFact, scenes)}</p>
                    <p><strong>Evidence:</strong> {factProposal.evidence.text}</p>
                    <label className={styles.sceneControl}>
                      <span>New fact becomes true as of</span>
                      <select
                        value={factEffectiveSceneByClusterId[cluster.id] ?? ''}
                        onChange={(event) => actions.setFactEffectiveScene(cluster.id, event.target.value)}
                      >
                        <option value=''>Choose a scene</option>
                        {scenes.map((scene) => (
                          <option key={scene.id} value={scene.id}>
                            {scene.title || 'Untitled scene'}
                          </option>
                        ))}
                      </select>
                      <small>
                        The current fact applies before this scene; the proposed fact applies from it onward.
                      </small>
                    </label>
                  </div>
                ) : null}

                {recommendation && recommendedActionHandler ? (
                  <AIProposalPreview
                    title={`AI recommends: ${CANON_DECISION_ACTION_LABELS[recommendation.action]}`}
                    text={recommendation.rationale}
                    onDismiss={() => consultation.dismissRecommendation(cluster.id)}
                    onConfirm={recommendedActionHandler}
                  />
                ) : null}

                {aiConsultationEnabled && (
                <div className={styles.aiPanel}>
                  <div className={styles.aiPanelHeader}>
                    <p className={styles.aiPanelTitle}>Think it through</p>
                    <span className={styles.aiPanelMeta}>
                      {aiProviderLabel}
                      {budget.isLocal ? '' : ` · ${budget.status.used}/${budget.status.limit} today`}
                    </span>
                  </div>
                  <ConsultationBudgetNotice
                    status={budget.status}
                    isLocal={budget.isLocal}
                    onGrantMore={budget.grantMore}
                    hidden={!aiConsultationEnabled}
                  />
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
                )}

                {runClusterId === cluster.id && <ModelRunProgress run={modelRun} />}

                <div className={styles.actionRow}>
                  {aiConsultationEnabled && (
                  <button
                    type='button'
                    onClick={() => void consultation.handleConsultCluster(cluster)}
                    disabled={
                      actingClusterId === cluster.id ||
                      consultingClusterId === cluster.id ||
                      modelRun.isRunning ||
                      !projectSettings?.aiSettings ||
                      !aiConsultationEnabled
                    }
                  >
                    {consultingClusterId === cluster.id
                      ? `Asking ${aiProviderLabel}...`
                      : `Ask ${aiProviderLabel}`}
                  </button>
                  )}
                  {cluster.kind === 'entity_identity' ? (
                    <>
                      {targetRef ? (
                        <button
                          type='button'
                          onClick={() => void actions.handleAliasEntity(cluster)}
                          disabled={actingClusterId === cluster.id}
                        >
                          Alias To Existing
                        </button>
                      ) : null}
                      <button
                        type='button'
                        onClick={() => void actions.handleAcceptNewEntity(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Accept New
                      </button>
                      <button
                        type='button'
                        onClick={() => void actions.handleKeepSeparate(cluster)}
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
                        onClick={() => void actions.handleAcceptFactUpdate(cluster)}
                        disabled={
                          actingClusterId === cluster.id ||
                          !factEffectiveSceneByClusterId[cluster.id]
                        }
                      >
                        Supersede
                      </button>
                      <button
                        type='button'
                        onClick={() => void actions.handleKeepSeparate(cluster)}
                        disabled={actingClusterId === cluster.id}
                      >
                        Keep Separate
                      </button>
                    </>
                  ) : null}

                  <button
                    type='button'
                    onClick={() => void actions.handleReject(cluster)}
                    disabled={actingClusterId === cluster.id}
                  >
                    Reject
                  </button>
                  <button
                    type='button'
                    onClick={() => void actions.handleDefer(cluster)}
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
