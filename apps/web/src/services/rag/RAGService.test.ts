import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {getLexicalSearchScore, getRagTrustRankingBoost, RAGService} from './RAGService';

describe('RAGService lexical search scoring', () => {
  it('scores exact named matches above unrelated chapter text', () => {
    const query = 'Dresden';

    expect(
      getLexicalSearchScore(
        query,
        'Imported lore mentions the Dresden Files as an inspiration.'
      )
    ).toBeGreaterThan(0);
    expect(
      getLexicalSearchScore(
        query,
        'Chapter three follows the courier through the Iron Warrens at dawn.'
      )
    ).toBe(0);
  });

  it('does not match search terms inside longer unrelated words', () => {
    expect(getLexicalSearchScore('Loa', 'A cloaked figure crossed the room.')).toBe(0);
    expect(getLexicalSearchScore('Reference to Loa', 'The Loa keep separate houses.')).toBeGreaterThan(0);
  });

  it('ranks named factual terms without question-word noise', () => {
    expect(
      getLexicalSearchScore(
        'What did Sera do before she became a delver?',
        'Sera occupation: cartographer. She later became a delver.'
      )
    ).toBeGreaterThan(
      getLexicalSearchScore(
        'What did Sera do before she became a delver?',
        'What happened before the tide turned was never recorded.'
      )
    );
  });

  it('boosts accepted canon sources above source notes for close matches', () => {
    expect(getRagTrustRankingBoost('canon_fact')).toBeGreaterThan(
      getRagTrustRankingBoost('worldbible')
    );
    expect(getRagTrustRankingBoost('worldbible')).toBeGreaterThan(
      getRagTrustRankingBoost('lore')
    );
    expect(getRagTrustRankingBoost('scene')).toBeGreaterThan(0);
  });

  it('retrieves Sera eye color from a rebuilt World Bible record', async () => {
    const rag = new RAGService();
    await rag.init(`rag-eye-color-${crypto.randomUUID()}`);
    await rag.indexDocument(
      'sera',
      'Sera Kestrel',
      'Sera Kestrel\ndescription: A veteran delver.\nappearance: gray eyes',
      'worldbible',
      {tags: ['characters'], entityIds: ['sera']}
    );
    await rag.indexDocument(
      'scene',
      'Chapter One',
      'A blue-eyed stranger watched the gate.',
      'scene'
    );

    const results = await rag.search("What color are Sera's eyes?", 3);

    expect(results[0].chunk.documentId).toBe('sera');
    expect(results[0].chunk.content).toContain('appearance: gray eyes');
  });

  it('rejects craft material at the project RAG boundary', async () => {
    const rag = new RAGService();
    await rag.init(`rag-craft-isolation-${crypto.randomUUID()}`);

    await expect(rag.indexDocument(
      'craft-pattern',
      'Scene structure',
      'A vetted instructional pattern.',
      'craft' as never
    )).rejects.toThrow('Unsupported project RAG document type: craft');
    await expect(rag.getDiagnostics()).resolves.toMatchObject({
      chunkCount: 0,
      documentCount: 0
    });
  });
});
