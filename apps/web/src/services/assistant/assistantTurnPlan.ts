import type {LoreFactProposal, WritingDocument} from '../../entityTypes';
import type {LLMContextChunk} from '../llm/types';
import {buildRagContextChunks} from '../llm/contextProvenance';
import {filterCanonFactResultsForScene} from '../lore/canonicalFactValidity';
import type {RAGSearchResult} from '../rag/types';
import {getDocumentsByProject} from '../storage';
import {buildUnverifiedFactualAnswer, isEvidenceGatedFactualQuestion} from './factualQuestionBoundary';
import {
  buildSubjectClarification,
  describeResolvedSubject,
  planFollowUpSubject,
  type FollowUpSubjectResolution,
  type PreviousTurn
} from './followUpSubject';
import {appendPendingProposalNote, findPendingProposalsForQuestion} from './pendingProposalContext';
import {getDirectSavedFactAnswer} from './savedFactAnswer';
import {getTemporalCustodySubject, resolveTemporalCustodyAnswer} from './temporalCustody';

/**
 * The assistant's evidence gate as one function (3.44, review B2). A
 * question that needs saved project evidence is answered from accepted
 * facts or told what is not established; it never becomes a provider
 * request. Only other questions reach the model, with the retrieved
 * material the caller turns into context.
 */

/** True when the question asks for project facts that must come from saved evidence. */
export const requiresProjectGrounding = (
  promptText: string,
  hasSelectedContext: boolean
): boolean => isEvidenceGatedFactualQuestion(promptText, hasSelectedContext);

export type AssistantTurnPlan =
  /** The question refers back to a subject that could not be pinned down. */
  | {kind: 'clarify'; content: string}
  /** Answered from accepted saved facts; no model. */
  | {kind: 'direct-answer'; content: string; sources: LLMContextChunk[]}
  /** Needed saved evidence and none settles it; no model. */
  | {kind: 'unverified-answer'; content: string; sources: LLMContextChunk[]}
  /** Safe to send to the model with this retrieved material. */
  | {kind: 'provider-request'; ragResults: RAGSearchResult[]; memoryChunks: LLMContextChunk[]};

export type PendingProposals = {proposals: LoreFactProposal[]} | null;

/** Where the plan reads from. The component supplies its search and memory services. */
export interface AssistantTurnSources {
  search: (query: string, limit: number) => Promise<RAGSearchResult[]>;
  memoryChunks: (query: string, orderedScenes: WritingDocument[]) => Promise<LLMContextChunk[]>;
  loadScenes?: (projectId: string) => Promise<WritingDocument[]>;
  followUpSubject?: typeof planFollowUpSubject;
  ragContextChunks?: typeof buildRagContextChunks;
}

export async function planAssistantTurn(
  params: {
    projectId: string;
    prompt: string;
    /** The author has selected text or a record field as context. */
    hasSelection: boolean;
    previousTurn: PreviousTurn | null;
    /** The open scene when the assistant runs on a document. */
    documentSceneId?: string;
    pendingProposals: PendingProposals;
  },
  sources: AssistantTurnSources
): Promise<AssistantTurnPlan> {
  const {projectId, prompt, pendingProposals} = params;
  const loadScenes = sources.loadScenes ?? getDocumentsByProject;
  const followUpSubject = sources.followUpSubject ?? planFollowUpSubject;
  const ragContextChunks = sources.ragContextChunks ?? buildRagContextChunks;

  const groundingRequired = requiresProjectGrounding(prompt, params.hasSelection);
  // A gated follow-up runs on its carried-over subject (1.4b); selected
  // text keeps its own handling.
  const subject: FollowUpSubjectResolution = groundingRequired && !params.hasSelection
    ? await followUpSubject({projectId, prompt, previousTurn: params.previousTurn})
    : {kind: 'unchanged'};
  if (subject.kind === 'clarify') {
    return {kind: 'clarify', content: buildSubjectClarification(subject.candidates)};
  }
  const factualPrompt = subject.kind === 'resolved' ? subject.prompt : prompt;
  const withNotes = (content: string) => {
    const withPending = pendingProposals
      ? appendPendingProposalNote(
          content,
          findPendingProposalsForQuestion(factualPrompt, pendingProposals.proposals)
        )
      : content;
    return subject.kind === 'resolved'
      ? `${describeResolvedSubject(subject.record)} ${withPending}`
      : withPending;
  };

  const needsOrderedScenes =
    Boolean(getTemporalCustodySubject(factualPrompt)) ||
    groundingRequired ||
    params.documentSceneId !== undefined;
  const orderedScenes = needsOrderedScenes
    ? await loadScenes(projectId).catch((error) => {
        console.warn('Unable to load ordered saved scenes for grounding.', error);
        return [];
      })
    : [];
  const [unfilteredRagResults, memoryChunks] = await Promise.all([
    sources.search(factualPrompt, groundingRequired ? 20 : 3),
    sources.memoryChunks(factualPrompt, orderedScenes)
  ]);
  const ragResults = filterCanonFactResultsForScene(
    unfilteredRagResults,
    params.documentSceneId,
    orderedScenes
  );

  const directSavedFact =
    resolveTemporalCustodyAnswer(factualPrompt, orderedScenes, ragResults) ??
    getDirectSavedFactAnswer(factualPrompt, ragResults);
  if (directSavedFact) {
    return {
      kind: 'direct-answer',
      content: withNotes(directSavedFact.content),
      sources: await ragContextChunks(projectId, directSavedFact.results)
    };
  }

  if (groundingRequired) {
    const unverified = buildUnverifiedFactualAnswer(ragResults);
    return {
      kind: 'unverified-answer',
      content: withNotes(unverified.content),
      sources: await ragContextChunks(projectId, unverified.results)
    };
  }

  return {kind: 'provider-request', ragResults, memoryChunks};
}
