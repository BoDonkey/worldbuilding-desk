import {describe, expect, it, vi} from 'vitest';
import type {RAGSearchResult} from '../rag/types';
import {planAssistantTurn, type AssistantTurnSources} from './assistantTurnPlan';

const seraEyes: RAGSearchResult = {
  score: 1.5,
  chunk: {
    id: 'sera-0',
    documentId: 'sera',
    documentTitle: 'Sera Kestrel',
    content: 'Sera Kestrel description: A delver. appearance: gray eyes',
    metadata: {type: 'worldbible', tags: ['characters']}
  }
};

const sources = (results: RAGSearchResult[] = []) => {
  const search = vi.fn<AssistantTurnSources['search']>().mockResolvedValue(results);
  return {
    search,
    sources: {
      search,
      memoryChunks: vi.fn().mockResolvedValue([{content: 'memory', source: 'Memory'}]),
      loadScenes: vi.fn().mockResolvedValue([]),
      followUpSubject: vi.fn().mockResolvedValue({kind: 'unchanged'}),
      ragContextChunks: vi.fn(async (_projectId: string, picked: RAGSearchResult[]) =>
        picked.map((result) => ({content: result.chunk.content, source: result.chunk.documentTitle})))
    } satisfies AssistantTurnSources
  };
};

const turn = (prompt: string, extra: Partial<Parameters<typeof planAssistantTurn>[0]> = {}) => ({
  projectId: 'p',
  prompt,
  hasSelection: false,
  previousTurn: null,
  pendingProposals: null,
  ...extra
});

describe('planAssistantTurn (3.44)', () => {
  it('answers a saved-fact question directly, without the model', async () => {
    const {sources: from} = sources([seraEyes]);
    const plan = await planAssistantTurn(turn("What color are Sera's eyes?"), from);
    expect(plan).toMatchObject({kind: 'direct-answer', content: "Sera's eyes are gray."});
    expect(plan.kind === 'direct-answer' && plan.sources.map((chunk) => chunk.source)).toEqual(['Sera Kestrel']);
  });

  it('never sends an evidence-gated question to the model when nothing settles it', async () => {
    const {sources: from, search} = sources([]);
    const plan = await planAssistantTurn(turn('What did Sera do before she became a delver?'), from);
    expect(plan.kind).toBe('unverified-answer');
    expect(search).toHaveBeenCalledWith('What did Sera do before she became a delver?', 20);
  });

  it('asks which subject is meant when a follow-up cannot be resolved', async () => {
    const {sources: from} = sources();
    from.followUpSubject.mockResolvedValue({kind: 'clarify', candidates: []});
    const plan = await planAssistantTurn(
      turn('What did she do before that?', {previousTurn: {question: 'Who is Sera?', answer: 'A delver.'}}),
      from
    );
    expect(plan.kind).toBe('clarify');
  });

  it('sends a creative request to the model with the retrieved material', async () => {
    const {sources: from, search} = sources([seraEyes]);
    const plan = await planAssistantTurn(turn('Can you suggest five faction names?'), from);
    expect(plan).toEqual({
      kind: 'provider-request',
      ragResults: [seraEyes],
      memoryChunks: [{content: 'memory', source: 'Memory'}]
    });
    expect(search).toHaveBeenCalledWith('Can you suggest five faction names?', 3);
    expect(from.followUpSubject).not.toHaveBeenCalled();
  });
});
