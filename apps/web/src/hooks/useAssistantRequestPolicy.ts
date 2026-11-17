import {useCallback} from 'react';
import type {ProjectAISettings} from '../entityTypes';
import {describeError} from '../services/errors';
import {describeRouteDataFlow} from '../services/llm/providerRoute';
import type {LLMRequest} from '../services/llm/types';
import type {SplitModelOutput} from '../services/llm/modelRun';
import type {ConsultationFeature} from '../services/editor';
import {aiSwitchRefusal} from '../services/llm/aiSwitches';
import {useConsultationBudget} from './useConsultationBudget';
import {useFeatureModelRun} from './useFeatureModelRun';

export type AssistantRequestOutcome =
  | {ok: true; stopped: boolean}
  | {ok: false; message: string};

/**
 * One authorization boundary for project-assistant model requests. Retrieval
 * and deterministic factual answers happen before this boundary; anything
 * that reaches `run` is a real provider request and is therefore checked,
 * disclosed, accounted, streamed, and stoppable in one place.
 */
export function useAssistantRequestPolicy({
  projectId,
  aiConfig,
  sentMaterial
}: {
  projectId: string;
  aiConfig: ProjectAISettings | undefined;
  sentMaterial: string;
}) {
  const inspector = aiConfig?.inspectorSettings;
  const budget = useConsultationBudget(projectId, inspector, aiConfig);
  const featureRun = useFeatureModelRun({
    aiConfig,
    budget,
    providerMessages: {
      notConfigured: 'AI provider is not configured. Add an API key in Settings.',
      invalid: 'Invalid AI configuration.',
      record: true
    }
  });
  const {modelRun, run: runModel} = featureRun;

  const providerIssue = featureRun.providerIssue ??
    (!budget.route.allowsRequests
      ? budget.route.reason ?? 'This provider route is not available.'
      : null);
  const disclosure = providerIssue
    ? null
    : describeRouteDataFlow(budget.route, sentMaterial);

  const run = useCallback(
    async ({
      feature,
      request,
      onUpdate,
      failureMessage
    }: {
      feature: ConsultationFeature;
      request: Omit<LLMRequest, 'signal'>;
      onUpdate?: (output: SplitModelOutput) => void;
      failureMessage: string;
    }): Promise<AssistantRequestOutcome> => {
      const switchRefusal = aiSwitchRefusal(aiConfig, feature);
      if (switchRefusal) return {ok: false, message: switchRefusal};
      if (providerIssue) return {ok: false, message: providerIssue};
      if (budget.blocked) {
        return {
          ok: false,
          message: budget.blockedMessage ?? 'AI consultation budget reached for today.'
        };
      }

      // `runModel` spends one consultation: `recordConsultation` counts hosted/remote requests
      // against the project budget and verified private-local requests against the runaway guard.
      try {
        const result = await runModel({...request, feature}, onUpdate);
        return {ok: true, stopped: result.stopped};
      } catch (error) {
        return {
          ok: false,
          message: describeError(error, failureMessage)
        };
      }
    },
    [aiConfig, budget, providerIssue, runModel]
  );

  return {
    run,
    providerIssue,
    disclosure,
    budget,
    modelRun
  };
}

export type AssistantRequestPolicy = ReturnType<typeof useAssistantRequestPolicy>;
