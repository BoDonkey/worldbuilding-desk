import {describe, expect, it} from 'vitest';
import {getLexicalSearchScore} from './RAGService';

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
});
