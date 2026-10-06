import {useCallback, useMemo} from 'react';
import type {ProjectAISettings} from '../entityTypes';
import {describeError} from '../services/errors';
import {LLMService} from '../services/llm/LLMService';
import {describeRouteDataFlow} from '../services/llm/providerRoute';
import type {LLMRequest} from '../services/llm/types';
import type {SplitModelOutput} from '../services/llm/modelRun';
import type {ConsultationFeature} from '../services/editor';
import {useConsultationBudget} from './useConsultationBudget';
import {useModelRun} from './useModelRun';

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
  const modelRun = useModelRun();

  const provider = useMemo(() => {
    if (!aiConfig) {
      return {
        service: null,
        issue: 'AI provider is not configured. Add an API key in Settings.'
      };
    }
    try {
      return {service: new LLMService(aiConfig), issue: null};
    } catch (error) {
      return {
        service: null,
        issue: describeError(error, 'Invalid AI configuration.')
      };
    }
  }, [aiConfig]);

  const providerIssue = provider.issue ??
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
      if (providerIssue || !provider.service) {
        return {ok: false, message: providerIssue ?? 'AI provider unavailable. Check your settings and try again.'};
      }
      if (budget.blocked) {
        return {
          ok: false,
          message: budget.blockedMessage ?? 'AI consultation budget reached for today.'
        };
      }

      // `recordConsultation` counts hosted/remote requests against the project
      // budget and verified private-local requests against the runaway guard.
      budget.spend(feature);
      try {
        const result = await modelRun.run(provider.service, request, onUpdate);
        return {ok: true, stopped: result.stopped};
      } catch (error) {
        return {
          ok: false,
          message: describeError(error, failureMessage)
        };
      }
    },
    [budget, modelRun, provider.service, providerIssue]
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
