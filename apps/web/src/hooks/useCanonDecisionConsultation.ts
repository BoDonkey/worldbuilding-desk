import {useMemo, useState} from 'react';
import type {CanonDecisionCluster, Project, ProjectSettings} from '../entityTypes';
import {buildRagContextChunks} from '../services/llm/contextProvenance';
import {readAISwitches} from '../services/llm/aiSwitches';
import {resolveResponseTokenLimit} from '../services/llm/modelRun';
import {describeError} from '../services/errors';
import {buildCanonDecisionConsultationPrompt} from '../services/lore/canonDecisionConsultation';
import {
  findCanonDecisionMembers,
  type CanonDecisionRecords
} from '../services/lore/canonDecisionActions';
import type {RAGProvider} from '../services/rag/RAGService';
import {useConsultationBudget} from './useConsultationBudget';
import {useFeatureModelRun} from './useFeatureModelRun';
import type {CanonDecisionFeedback} from './useCanonDecisionActions';

const NOT_CONFIGURED = 'Configure an AI provider in Settings first.';

const PROVIDER_LABELS = {
  anthropic: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  ollama: 'Local Ollama',
  'local-openai': 'Local server'
} as const;

/**
 * "Ask the model" on a Canon Decisions cluster (slice 3.43): which provider
 * and model the request uses, the daily budget, the run, and each cluster's
 * answer. The model only advises; the author confirms any recommended action.
 */
export function useCanonDecisionConsultation(params: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  records: CanonDecisionRecords;
  ragService: RAGProvider | null;
  setFeedback: (feedback: CanonDecisionFeedback) => void;
}) {
  const {activeProject, projectSettings, records, ragService, setFeedback} = params;
  const [consultingClusterId, setConsultingClusterId] = useState<string | null>(null);
  /** The cluster whose run the progress line describes (the latest one consulted). */
  const [runClusterId, setRunClusterId] = useState<string | null>(null);
  const [consultationByClusterId, setConsultationByClusterId] = useState<
    Record<string, {content?: string; error?: string}>
  >({});
  const [dismissedRecommendationClusterIds, setDismissedRecommendationClusterIds] = useState<
    Set<string>
  >(new Set());

  const canonDecisionProviderMode =
    projectSettings?.aiSettings?.inspectorSettings?.canonDecisionProviderMode ?? 'project-provider';
  const effectiveAIProviderId =
    canonDecisionProviderMode === 'local-ollama'
      ? 'ollama'
      : projectSettings?.aiSettings?.provider;
  const aiProviderLabel = effectiveAIProviderId
    ? PROVIDER_LABELS[effectiveAIProviderId]
    : 'AI';
  const aiConsultationEnabled = readAISwitches(projectSettings?.aiSettings).coaching;
  // The settings a canon-decision request actually uses: the local-Ollama override and the
  // low-cost model included. The budget classifies this route, so the exemption applies only when
  // that exact model is verified local.
  const consultationAISettings = useMemo(() => {
    const aiSettings = projectSettings?.aiSettings;
    if (!aiSettings || canonDecisionProviderMode !== 'local-ollama') return aiSettings;
    const lowCostModel = aiSettings.inspectorSettings?.lowCostModel?.trim();
    return {
      ...aiSettings,
      provider: 'ollama' as const,
      configs: {
        ...aiSettings.configs,
        ollama: {
          ...aiSettings.configs?.ollama,
          ...(lowCostModel ? {model: lowCostModel} : {})
        }
      }
    };
  }, [projectSettings?.aiSettings, canonDecisionProviderMode]);
  const budget = useConsultationBudget(
    activeProject?.id ?? null,
    projectSettings?.aiSettings?.inspectorSettings,
    consultationAISettings
  );
  const {run: runModel, modelRun} = useFeatureModelRun({
    aiConfig: consultationAISettings,
    budget,
    providerMessages: {notConfigured: NOT_CONFIGURED}
  });

  const handleConsultCluster = async (cluster: CanonDecisionCluster) => {
    if (!activeProject) return;
    if (!projectSettings?.aiSettings) {
      setFeedback({tone: 'error', message: NOT_CONFIGURED});
      return;
    }
    if (!aiConsultationEnabled) {
      setFeedback({tone: 'error', message: 'AI coaching is off for this project. Turn it on in Settings → AI Settings.'});
      return;
    }
    if (budget.blocked) {
      setFeedback({
        tone: 'error',
        message: budget.blockedMessage ?? 'AI consultation budget reached for today.'
      });
      return;
    }

    const members = findCanonDecisionMembers(records, cluster);
    const {searchQuery, systemPrompt, userPrompt} = buildCanonDecisionConsultationPrompt({
      cluster,
      entityProposal: members.entityProposal,
      factProposal: members.factProposal,
      canonicalFact: members.canonicalFact,
      targetCharacter: members.targetCharacter,
      targetEntity: members.targetEntity,
      sourceDocument: members.sourceDocument
    });

    setConsultingClusterId(cluster.id);
    setRunClusterId(cluster.id);
    setConsultationByClusterId((prev) => ({
      ...prev,
      [cluster.id]: {content: ''}
    }));
    setDismissedRecommendationClusterIds((prev) => {
      if (!prev.has(cluster.id)) return prev;
      const next = new Set(prev);
      next.delete(cluster.id);
      return next;
    });
    setFeedback(null);

    try {
      const aiSettingsForConsultation = consultationAISettings ?? projectSettings.aiSettings;

      // The same trust labels the assistant uses, so a Source Note is not read as canon.
      const ragChunks = ragService
        ? await buildRagContextChunks(activeProject.id, await ragService.search(searchQuery, 3))
        : [];

      await runModel(
        {
          feature: 'canon-decision',
          messages: [{role: 'user', content: userPrompt}],
          systemPrompt,
          context: ragChunks,
          model: projectSettings.aiSettings.inspectorSettings?.lowCostModel?.trim() || undefined,
          maxTokens: resolveResponseTokenLimit(
            aiSettingsForConsultation.provider,
            projectSettings.aiSettings.inspectorSettings?.maxResponseTokens
          )
        },
        ({answer}) => {
          setConsultationByClusterId((prev) => ({
            ...prev,
            [cluster.id]: {content: answer}
          }));
        }
      );
    } catch (error) {
      const message =
        describeError(error, 'AI consultation failed for this cluster.');
      setConsultationByClusterId((prev) => ({
        ...prev,
        [cluster.id]: {error: message}
      }));
    } finally {
      setConsultingClusterId(null);
    }
  };

  const dismissRecommendation = (clusterId: string) =>
    setDismissedRecommendationClusterIds((prev) => new Set(prev).add(clusterId));

  return {
    modelRun,
    budget,
    aiProviderLabel,
    aiConsultationEnabled,
    consultingClusterId,
    runClusterId,
    consultationByClusterId,
    dismissedRecommendationClusterIds,
    dismissRecommendation,
    handleConsultCluster
  };
}
