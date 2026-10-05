import type {CanonicalFactValue, LoreFactProposal} from '../../entityTypes';
import type {LLMContextChunk} from '../llm/types';

/**
 * Pending Source Note fact proposals, offered to the project Q&A only when
 * the author asks to discuss them (roadmap 1.4). They are labeled pending in
 * every place they appear and never answer a factual question: the evidence
 * gate and saved-fact answers still use accepted canon only.
 */

/** Newest first; more would crowd out accepted canon in the model's context. */
export const PENDING_PROPOSAL_CONTEXT_LIMIT = 12;

export const PENDING_PROPOSAL_LABEL = 'Pending proposal, not canon';

export const PENDING_PROPOSAL_INSTRUCTION =
  'The author asked to discuss pending proposals. Context labeled "Pending proposal, not canon" ' +
  'comes from Source Notes and has not been accepted. Always describe it as pending or proposed, ' +
  'never as established fact, and keep it apart from accepted canon.';

export const formatProposalValue = (value: CanonicalFactValue): string =>
  typeof value === 'string' ? value : `${value.label}: ${value.value}`;

const isPending = (proposal: LoreFactProposal) => proposal.status === 'proposed';

const describeProposal = (proposal: LoreFactProposal): string =>
  `${proposal.targetName?.trim() || 'Unassigned'} — ${proposal.factType}: ${formatProposalValue(proposal.value)}`;

export function buildPendingProposalChunks(
  proposals: LoreFactProposal[],
  sourceTitleById: Map<string, string> = new Map()
): LLMContextChunk[] {
  return proposals
    .filter(isPending)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PENDING_PROPOSAL_CONTEXT_LIMIT)
    .map((proposal) => {
      const sourceTitle = sourceTitleById.get(proposal.loreDocumentId) ?? 'a Source Note';
      return {
        source: `${PENDING_PROPOSAL_LABEL} - ${describeProposal(proposal)}`,
        content:
          `${describeProposal(proposal)}. Proposed from "${sourceTitle}", quoting: ` +
          `"${proposal.evidence.text.trim()}". Not accepted.`,
        relevance: 0.5
      };
    });
}

/** Pending proposals about someone or something the question names. */
export function findPendingProposalsForQuestion(
  question: string,
  proposals: LoreFactProposal[]
): LoreFactProposal[] {
  const lowered = question.toLowerCase();
  return proposals.filter((proposal) => {
    if (!isPending(proposal)) return false;
    const name = proposal.targetName?.trim().toLowerCase();
    if (!name) return false;
    return name.split(/\s+/).some((part) => part.length >= 3 && new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lowered));
  });
}

/**
 * Adds a clearly separate note to a deterministic answer listing pending
 * proposals that touch the question. The answer itself is unchanged.
 */
export function appendPendingProposalNote(content: string, matches: LoreFactProposal[]): string {
  if (matches.length === 0) return content;
  const lines = matches.slice(0, 5).map((proposal) => `- ${describeProposal(proposal)}`);
  return [
    content,
    '',
    'Pending, not accepted canon (from Source Note review):',
    ...lines,
    'Accept or reject these in Canon Review before relying on them.'
  ].join('\n');
}
