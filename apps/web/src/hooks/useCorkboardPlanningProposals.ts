import {useCallback, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import type {ChapterCard, ProjectAISettings, WritingDocument} from '../entityTypes';
import {stripAssistantThinking} from '../services/assistant/assistantThinking';
import {PLANNING_SOURCE_PREFIX} from '../services/corkboard/planningChat';
import {
  PROPOSAL_MATERIAL,
  ProposalResponseError,
  applyPlanningProposal,
  buildProposalOutline,
  buildProposalRequest,
  buildProposalSystemPrompt,
  parsePlanningProposals,
  staleProposalMessage,
  type PlanningProposal,
  type ProposalActions
} from '../services/corkboard/planningProposals';
import {describeError} from '../services/errors';
import {fitContextChunks} from '../services/llm/contextBudget';
import {resolveModelContextSize} from '../services/llm/modelContextSize';
import {resolveResponseTokenLimit} from '../services/llm/modelRun';
import {describeRouteDataFlow} from '../services/llm/providerRoute';
import type {LLMContextChunk} from '../services/llm/types';
import {rememberPlannedSceneGoal} from '../services/sceneDraft/plannedSceneGoals';
import {saveWritingDocument} from '../services/storage';
import {appendSystemHistoryEntry} from '../services/system/systemHistoryService';
import {buildNewSceneDocument} from '../services/workspace/newSceneDocument';
import {useNotificationStore} from '../store/notificationStore';
import type {AssistantRequestPolicy} from './useAssistantRequestPolicy';
import {useChapterCardSceneActions} from './useChapterCardSceneActions';
import type {useWorkspaceCorkboard} from './useWorkspaceCorkboard';

/** The Corkboard actions accepted proposals go through. */
export type CorkboardProposalActions = Pick<
  ReturnType<typeof useWorkspaceCorkboard>,
  | 'createCorkboardCard'
  | 'updateCorkboardCard'
  | 'moveCorkboardCard'
  | 'addCorkboardPlotPoint'
  | 'updateCorkboardPlotPoint'
  | 'moveCorkboardPlotPoint'
>;

/** Proposals made from one planning-chat reply. */
export interface ProposalBatch {
  status: 'loading' | 'ready' | 'error';
  proposals: PlanningProposal[];
  /** Plain sentences: proposals left out when parsed, or dropped as stale when accepted. */
  notices: string[];
  /** Why the request failed, when `status` is error. */
  error?: string;
}

const PROPOSAL_FAILURE = 'The planning chat could not propose changes.';

/**
 * Propose changes on a planning-chat reply (Slice 4.86). One request turns
 * the reply into structured edits, validated in `planningProposals.ts` against
 * the board as it was sent. The board does not change until the author
 * accepts a proposal, and each accepted proposal is checked again against the
 * current board, then applied through the Corkboard's own actions. Batches
 * are keyed by the reply's index and last only as long as the Corkboard view.
 */
export function useCorkboardPlanningProposals({
  projectId,
  aiConfig,
  cards,
  documents,
  policy,
  actions
}: {
  projectId: string;
  aiConfig: ProjectAISettings | undefined;
  cards: ChapterCard[];
  documents: WritingDocument[];
  policy: AssistantRequestPolicy;
  actions: CorkboardProposalActions;
}) {
  const [batches, setBatches] = useState<Record<number, ProposalBatch>>({});
  const requestingRef = useRef(false);
  const navigate = useNavigate();
  const pushToast = useNotificationStore((state) => state.pushToast);
  const {run: runRequest} = policy;
  const disclosure = policy.providerIssue ? null : describeRouteDataFlow(policy.budget.route, PROPOSAL_MATERIAL);

  const updateBatch = useCallback((index: number, update: (batch: ProposalBatch) => ProposalBatch) =>
    setBatches((previous) => (previous[index] ? {...previous, [index]: update(previous[index])} : previous)), []);

  const propose = useCallback(async (index: number, reply: string, question: string | null) => {
    if (requestingRef.current || !reply.trim()) return;
    requestingRef.current = true;
    setBatches((previous) => ({...previous, [index]: {status: 'loading', proposals: [], notices: []}}));
    const fail = (error: string) => setBatches((previous) => ({
      ...previous,
      [index]: {status: 'error', proposals: [], notices: [], error}
    }));
    try {
      // The board as sent: proposals are validated against it, not the board at reply time.
      const sentCards = cards;
      const outline = buildProposalOutline(sentCards);
      const outlineChunk: LLMContextChunk = {
        content: outline.content,
        source: `${PLANNING_SOURCE_PREFIX}: whole board, keyed for proposals`,
        relevance: 1
      };
      const systemPrompt = buildProposalSystemPrompt();
      const messages = [{role: 'user' as const, content: buildProposalRequest(reply, question)}];
      const replyTokens = aiConfig
        ? resolveResponseTokenLimit(aiConfig.provider, aiConfig.inspectorSettings?.maxResponseTokens)
        : undefined;
      const modelContext = await resolveModelContextSize(aiConfig);
      const budgeted = fitContextChunks({
        chunks: [outlineChunk],
        contextTokens: modelContext.tokens,
        fixedText: [systemPrompt, messages[0].content],
        replyTokens,
        sectionOf: () => 'author-selection'
      });
      if (budgeted.kept.length === 0) {
        fail('The board is too large for this model\'s context window to propose changes.');
        return;
      }

      let answer = '';
      const outcome = await runRequest({
        feature: 'corkboard-planning',
        // The project's main model, not the chat's low-cost one: the reply must be structured.
        request: {messages, context: budgeted.kept, systemPrompt, maxTokens: replyTokens},
        failureMessage: PROPOSAL_FAILURE,
        onUpdate: (output) => {
          answer = output.answer;
        }
      });
      if (!outcome.ok) {
        fail(outcome.message);
        return;
      }
      if (outcome.stopped) {
        fail('Stopped before the proposals were complete. Nothing was changed.');
        return;
      }
      // Validated against the board as sent; a later edit is caught when a proposal is accepted.
      const {proposals, dropped} = parsePlanningProposals(stripAssistantThinking(answer), outline, sentCards);
      const notices = proposals.length === 0 && dropped.length === 0
        ? ['No concrete changes to propose from this reply.']
        : dropped;
      setBatches((previous) => ({...previous, [index]: {status: 'ready', proposals, notices}}));
    } catch (error) {
      fail(error instanceof ProposalResponseError ? error.message : describeError(error, PROPOSAL_FAILURE));
    } finally {
      requestingRef.current = false;
    }
  }, [aiConfig, cards, runRequest]);

  const removeProposal = useCallback((index: number, proposalId: string, notice?: string) =>
    updateBatch(index, (batch) => ({
      ...batch,
      proposals: batch.proposals.filter((proposal) => proposal.id !== proposalId),
      notices: notice ? [...batch.notices, notice] : batch.notices
    })), [updateBatch]);

  const {
    createCorkboardCard,
    updateCorkboardCard,
    moveCorkboardCard,
    addCorkboardPlotPoint,
    updateCorkboardPlotPoint,
    moveCorkboardPlotPoint
  } = actions;
  const createDocument = useCallback(async ({title}: {title?: string}) => {
    const document = buildNewSceneDocument({projectId, documents, title});
    await saveWritingDocument(document);
    appendSystemHistoryEntry(projectId, {
      category: 'scene',
      message: `Created scene "${document.title}".`,
      insertText: `System Notice: Scene "${document.title}" was created.`
    });
    return document;
  }, [documents, projectId]);
  const {createLinkedScene, retryLink} = useChapterCardSceneActions({
    createDocument,
    updateCard: (cardId, sceneIds) => updateCorkboardCard(cardId, {sceneIds}, {persistImmediately: true})
  });

  const proposalActions: ProposalActions = {
    createCard: (initial) => createCorkboardCard(initial),
    moveCard: moveCorkboardCard,
    updateCardSummary: (cardId, summary) => void updateCorkboardCard(cardId, {summary}),
    addPlotPoint: addCorkboardPlotPoint,
    updatePlotPoint: updateCorkboardPlotPoint,
    movePlotPoint: moveCorkboardPlotPoint,
    createLinkedScene: async (card, title, goal) => {
      const {document, linked} = await createLinkedScene(card, title);
      if (!document) throw new Error('The scene could not be created.');
      rememberPlannedSceneGoal(document.id, goal);
      const cardName = card.title.trim() || 'Untitled chapter';
      const openScene = {
        label: 'Open scene',
        onSelect: () => navigate('/workspace', {state: {focusDocumentId: document.id}})
      };
      if (linked) {
        pushToast({message: `Created "${document.title}" and linked it to ${cardName}.`, action: openScene});
        return;
      }
      pushToast({
        tone: 'error',
        message: `Created "${document.title}" but could not link it to ${cardName}.`,
        durationMs: null,
        action: {
          label: 'Link now',
          onSelect: () => {
            void retryLink(card, document).then((ok) => pushToast(ok
              ? {message: `Linked ${document.title} to ${cardName}.`, action: openScene}
              : {tone: 'error', message: `Could not link ${document.title} to ${cardName}.`}));
          }
        }
      });
    }
  };

  /** Applies one proposal the author confirmed, or drops it with a reason when the board moved on. */
  const accept = async (index: number, proposal: PlanningProposal) => {
    const stale = staleProposalMessage(proposal, cards);
    if (stale) {
      removeProposal(index, proposal.id, stale);
      return;
    }
    await applyPlanningProposal(proposal, cards, proposalActions);
    removeProposal(index, proposal.id);
  };

  const dismiss = (index: number, proposalId: string) => removeProposal(index, proposalId);
  const clear = useCallback(() => setBatches({}), []);

  return {batches, propose, accept, dismiss, clear, disclosure};
}

export type CorkboardPlanningProposals = ReturnType<typeof useCorkboardPlanningProposals>;
