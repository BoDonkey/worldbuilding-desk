import {useCallback, useRef, useState} from 'react';
import type {ChapterCard, ProjectAISettings, WritingDocument} from '../entityTypes';
import {stripAssistantThinking} from '../services/assistant/assistantThinking';
import {assistantHistoryBudget, buildAssistantHistory} from '../services/assistant/conversationHistory';
import {getContextSourceRefs, getContextSourceSummaries} from '../services/assistant/contextSources';
import {
  buildPlanningChatSystemPrompt,
  buildPlanningContext,
  describePlanningMaterial,
  planningContextChunk,
  type PlanningChatScope
} from '../services/corkboard/planningChat';
import {describeError} from '../services/errors';
import {buildPromptBreakdown, fitContextChunks} from '../services/llm/contextBudget';
import {buildRagContextChunks} from '../services/llm/contextProvenance';
import {resolveModelContextSize} from '../services/llm/modelContextSize';
import {resolveResponseTokenLimit} from '../services/llm/modelRun';
import type {LLMContextChunk} from '../services/llm/types';
import {getRAGService} from '../services/rag/getRAGService';
import {useAssistantConversation} from './useAssistantConversation';
import {useAssistantRequestPolicy} from './useAssistantRequestPolicy';

/** Separate history from the Workspace assistant: same session-local storage, its own key. */
export const PLANNING_CONVERSATION_SCOPE = 'corkboard-planning';
/** Retrieved records added to a planning request, after the plan itself. */
const RETRIEVED_RECORDS = 4;

/**
 * The Corkboard planning chat (Slice 4.85). Retrieval is the Workspace
 * assistant's (project search, labeled by trust tier), and every request goes
 * through the same request policy: coaching switch, provider route
 * disclosure, budget, Stop. The assistant's factual-question gate is not used:
 * it reads "where does the middle sag?" as a request for saved facts and
 * refuses it, while here the outline itself is the material being discussed.
 * The hook has no card or scene setter: replies are conversation only.
 */
export function useCorkboardPlanningChat({
  projectId,
  aiConfig,
  cards,
  documents
}: {
  projectId: string;
  aiConfig: ProjectAISettings | undefined;
  cards: ChapterCard[];
  documents: WritingDocument[];
}) {
  const [scope, setScope] = useState<PlanningChatScope>('board');
  const [includeSceneExcerpts, setIncludeSceneExcerpts] = useState(false);
  const [messages, setMessages] = useAssistantConversation(projectId, PLANNING_CONVERSATION_SCOPE);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const policy = useAssistantRequestPolicy({
    projectId,
    aiConfig,
    sentMaterial: describePlanningMaterial(scope, includeSceneExcerpts)
  });
  const {run: runRequest} = policy;

  const replaceLastReply = useCallback(
    (update: (last: (typeof messages)[number]) => (typeof messages)[number]) =>
      setMessages((previous) => {
        const last = previous[previous.length - 1];
        return last?.role === 'assistant' ? [...previous.slice(0, -1), update(last)] : previous;
      }),
    [setMessages]
  );

  const send = useCallback(
    async (prompt: string, cardId: string | null): Promise<void> => {
      const question = prompt.trim();
      if (!question || sendingRef.current) return;
      sendingRef.current = true;
      setIsSending(true);
      const history = messages;
      setMessages((previous) => [...previous, {role: 'user', content: question}]);
      try {
        const rag = await getRAGService(projectId).catch(() => null);
        const ragResults = rag ? await rag.search(question, RETRIEVED_RECORDS) : [];
        const planningContext = buildPlanningContext({scope, cards, documents, cardId, includeSceneExcerpts});
        const planChunk = planningContextChunk(planningContext);
        const retrieved = await buildRagContextChunks(projectId, ragResults);
        const chunks: LLMContextChunk[] = planChunk ? [planChunk, ...retrieved] : retrieved;

        const systemPrompt = buildPlanningChatSystemPrompt();
        const inspector = aiConfig?.inspectorSettings;
        const replyTokens = aiConfig ? resolveResponseTokenLimit(aiConfig.provider, inspector?.maxResponseTokens) : undefined;
        const modelContext = await resolveModelContextSize(aiConfig);
        const requestMessages = [
          ...buildAssistantHistory(history, assistantHistoryBudget(modelContext.tokens)).messages,
          {role: 'user' as const, content: question}
        ];
        const budgeted = fitContextChunks({
          chunks,
          contextTokens: modelContext.tokens,
          fixedText: [systemPrompt, ...requestMessages.map((message) => message.content)],
          replyTokens,
          // The plan is what the author asked about, so it is kept first, like a selection.
          sectionOf: (chunk) => (chunk === planChunk ? 'author-selection' : undefined)
        });
        const contextSources = getContextSourceSummaries(budgeted.kept);
        const leftOutSources = getContextSourceSummaries(budgeted.dropped);
        setMessages((previous) => [
          ...previous,
          {
            role: 'assistant',
            content: '',
            contextSources,
            contextSourceRefs: getContextSourceRefs([...budgeted.kept, ...budgeted.dropped]),
            ...(leftOutSources.length > 0 ? {leftOutSources} : {}),
            promptBreakdown: buildPromptBreakdown({
              instructions: systemPrompt,
              messages: requestMessages,
              sections: budgeted.kept
            }),
            modelContext
          }
        ]);

        const outcome = await runRequest({
          feature: 'corkboard-planning',
          request: {
            messages: requestMessages,
            context: budgeted.kept,
            systemPrompt,
            model: inspector?.lowCostModel?.trim() || undefined,
            maxTokens: replyTokens
          },
          failureMessage: 'The planning chat could not generate a response.',
          onUpdate: ({answer}) => replaceLastReply((last) => ({...last, content: stripAssistantThinking(answer)}))
        });
        if (!outcome.ok) replaceLastReply((last) => ({...last, content: outcome.message}));
      } catch (error) {
        const message = describeError(error, 'The planning chat could not prepare its context. Try again.');
        setMessages((previous) => {
          const last = previous[previous.length - 1];
          return last?.role === 'assistant'
            ? [...previous.slice(0, -1), {...last, content: message}]
            : [...previous, {role: 'assistant', content: message}];
        });
      } finally {
        sendingRef.current = false;
        setIsSending(false);
      }
    },
    [aiConfig, cards, documents, includeSceneExcerpts, messages, projectId, replaceLastReply, runRequest, scope, setMessages]
  );

  const clear = useCallback(() => setMessages([]), [setMessages]);

  return {
    scope,
    setScope,
    includeSceneExcerpts,
    setIncludeSceneExcerpts,
    messages,
    send,
    clear,
    isSending: isSending || policy.modelRun.isRunning,
    policy
  };
}

export type CorkboardPlanningChat = ReturnType<typeof useCorkboardPlanningChat>;
