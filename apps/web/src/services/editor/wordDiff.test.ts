import {describe, expect, it} from 'vitest';
import {countWordChanges, diffWords, tokenizeWords, type WordDiffOp} from './wordDiff';

const words = (text: string) => tokenizeWords(text);
const render = (ops: WordDiffOp[]) =>
  ops.map((op) => (op.kind === 'same' ? op.token : op.kind === 'added' ? `+${op.token}` : `-${op.token}`)).join(' ');

// Applying the ops to `before` must give `after`, and dropping additions must give `before`.
function expectConsistent(before: string[], after: string[], ops: WordDiffOp[]) {
  expect(ops.filter((op) => op.kind !== 'added').map((op) => op.token)).toEqual(before);
  expect(ops.filter((op) => op.kind !== 'removed').map((op) => op.token)).toEqual(after);
}

describe('word diff', () => {
  it('tokenizes on whitespace (punctuation stays on its word) and keeps paragraph breaks', () => {
    expect(words('Rain fell.\n\nMira  waited.')).toEqual(['Rain', 'fell.', '\n', 'Mira', 'waited.']);
    expect(words('')).toEqual([]);
  });

  it('marks nothing when the texts match', () => {
    const ops = diffWords(words('The gate held.'), words('The gate held.'));
    expect(render(ops)).toBe('The gate held.');
    expect(countWordChanges(ops)).toEqual({added: 0, removed: 0});
  });

  it('marks a replaced word as one removal and one addition', () => {
    const before = words('The old gate held fast.');
    const after = words('The iron gate held fast.');
    const ops = diffWords(before, after);
    expect(render(ops)).toBe('The -old +iron gate held fast.');
    expectConsistent(before, after, ops);
  });

  it('finds insertions and deletions in the middle and across paragraphs', () => {
    const before = words('Mira ran\n\nThe dream ended\n\nShe woke');
    const after = words('Mira ran fast\n\nShe woke at dawn');
    const ops = diffWords(before, after);
    expectConsistent(before, after, ops);
    // Whitespace-separated words: "fast", "at", "dawn" added; the dream paragraph removed.
    expect(countWordChanges(ops)).toEqual({added: 3, removed: 3});
    expect(render(ops)).toBe('Mira ran +fast \n -The -dream -ended -\n She woke +at +dawn');
  });

  it('handles empty sides', () => {
    expect(render(diffWords([], words('New text')))).toBe('+New +text');
    expect(render(diffWords(words('Old text'), []))).toBe('-Old -text');
  });

  it('falls back to a whole replacement past the edit limit, still consistent', () => {
    const before = words('a b c d e f');
    const after = words('u v w x y z');
    const ops = diffWords(before, after, 3);
    expectConsistent(before, after, ops);
    expect(countWordChanges(ops)).toEqual({added: 6, removed: 6});
  });

  it('stays consistent on random edits', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const vocabulary = ['the', 'gate', 'rain', 'Mira', '\n', 'held', 'ran', 'dream'];
    for (let run = 0; run < 50; run += 1) {
      const before = Array.from({length: Math.floor(random() * 30)}, () => vocabulary[Math.floor(random() * vocabulary.length)]);
      const after = before.flatMap((token) => {
        const roll = random();
        if (roll < 0.15) return [];
        if (roll < 0.3) return [token, vocabulary[Math.floor(random() * vocabulary.length)]];
        return [token];
      });
      expectConsistent(before, after, diffWords(before, after));
    }
  });
});
