import {useCallback, useMemo} from 'react';
import type {ProjectAISettings} from '../entityTypes';
import type {ConsultationFeature} from '../services/editor';
import {LLMService} from '../services/llm/LLMService';
import type {SplitModelOutput} from '../services/llm/modelRun';
import {getProviderIssue, type ProviderIssueMessages} from '../services/llm/providerIssue';
import type {UseConsultationBudget} from './useConsultationBudget';
import {useModelRun, type ModelRunRequest, type ModelRunResult} from './useModelRun';

/** A feature's model request: tagged with the consultation it spends. */
export type FeatureModelRunRequest = ModelRunRequest & {feature: ConsultationFeature};

/**
 * The one way an AI feature sends a model request (Slice 3.47). Each feature keeps its prompt,
 * parser, and wording; this hook keeps the parts every feature must get right in the same order:
 * provider readiness, the budget guard, spending one consultation under the request's feature,
 * and the streamed, stoppable run. `LLMService` still refuses a request whose AI switch is off,
 * and `budget.spend` charges nothing for one.
 *
 * The budget comes in rather than being built here, because some surfaces share one budget
 * between several features (World Canvas coaching and brainstorm) so each sees the other's spend.
 */
export function useFeatureModelRun({
  aiConfig,
  budget,
  providerMessages
}: {
  /** The exact settings a request uses: provider, key, and switches. */
  aiConfig: ProjectAISettings | undefined;
  budget: UseConsultationBudget;
  /** The feature's wording for a missing or rejected provider setup (see `getProviderIssue`). */
  providerMessages: ProviderIssueMessages;
}) {
  const modelRun = useModelRun();
  const {notConfigured, invalid, record} = providerMessages;
  const providerIssue = useMemo(
    () => getProviderIssue(aiConfig, {notConfigured, invalid, record}),
    [aiConfig, notConfigured, invalid, record]
  );

  /**
   * Builds the service, spends one consultation, and streams the request. Rejects without
   * spending when there is no provider or the budget is used up; callers check those first to show
   * their own wording, so these guards only stop a path that forgot to.
   */
  const run = useCallback(
    async (request: FeatureModelRunRequest, onUpdate?: (output: SplitModelOutput) => void): Promise<ModelRunResult> => {
      if (!aiConfig) throw new Error(notConfigured);
      if (budget.blocked) throw new Error(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      const service = new LLMService(aiConfig);
      budget.spend(request.feature);
      return modelRun.run(service, request, onUpdate);
    },
    [aiConfig, budget, modelRun, notConfigured]
  );

  return {run, modelRun, providerIssue};
}

export type FeatureModelRun = ReturnType<typeof useFeatureModelRun>;
