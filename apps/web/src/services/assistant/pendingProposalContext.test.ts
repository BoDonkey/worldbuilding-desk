import {describe, expect, it} from 'vitest';
import type {LoreFactProposal} from '../../entityTypes';
import {
  PENDING_PROPOSAL_CONTEXT_LIMIT,
  appendPendingProposalNote,
  buildPendingProposalChunks,
  findPendingProposalsForQuestion,
  formatProposalValue
} from './pendingProposalContext';

const proposal = (changes: Partial<LoreFactProposal> = {}): LoreFactProposal => ({
  id: 'p1', projectId: 'p', loreDocumentId: 'note-1', targetType: 'entity', targetId: 'sera',
  targetName: 'Sera Kestrel', factType: 'background', value: 'secretly a spy', confidence: 0.8,
  evidence: {start: 0, end: 5, text: 'a spy all along'}, status: 'proposed', createdAt: 1, updatedAt: 1,
  ...changes
});

describe('pending proposal context', () => {
  it('labels every chunk as pending and never includes accepted or rejected proposals', () => {
    const chunks = buildPendingProposalChunks(
      [proposal(), proposal({id: 'p2', status: 'accepted'}), proposal({id: 'p3', status: 'rejected'})],
      new Map([['note-1', 'Harbor rumors']])
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].source).toBe('Pending proposal, not canon - Sera Kestrel — background: secretly a spy');
    expect(chunks[0].content).toContain('Proposed from "Harbor rumors", quoting: "a spy all along". Not accepted.');
  });

  it('keeps only the newest proposals', () => {
    const many = Array.from({length: PENDING_PROPOSAL_CONTEXT_LIMIT + 3}, (_, index) =>
      proposal({id: `p${index}`, updatedAt: index})
    );
    const chunks = buildPendingProposalChunks(many);
    expect(chunks).toHaveLength(PENDING_PROPOSAL_CONTEXT_LIMIT);
    expect(chunks[0].content).toContain('a Source Note');
  });

  it('finds proposals about someone the question names, by any part of the name', () => {
    const proposals = [proposal(), proposal({id: 'p2', targetName: 'Tam'}), proposal({id: 'p3', targetName: undefined})];
    expect(findPendingProposalsForQuestion('Is Kestrel a spy?', proposals).map((entry) => entry.id)).toEqual(['p1']);
    expect(findPendingProposalsForQuestion('What does Tamsin want?', proposals)).toEqual([]);
  });

  it('appends a separate pending note without changing the answer', () => {
    expect(appendPendingProposalNote('No saved answer.', [])).toBe('No saved answer.');
    const note = appendPendingProposalNote('No saved answer.', [proposal()]);
    expect(note.startsWith('No saved answer.\n\nPending, not accepted canon')).toBe(true);
    expect(note).toContain('- Sera Kestrel — background: secretly a spy');
    expect(formatProposalValue({label: 'Rank', value: 'Captain'})).toBe('Rank: Captain');
  });
});
