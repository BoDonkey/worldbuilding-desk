import {describe, expect, it} from 'vitest';
import {
  buildUnverifiedFactualAnswer,
  isEvidenceGatedFactualQuestion
} from './factualQuestionBoundary';

describe('factual question boundary', () => {
  it('evidence-gates arbitrary factual wording rather than known fixture phrases only', () => {
    expect(isEvidenceGatedFactualQuestion('Who stole the Emberglass Key?')).toBe(true);
    expect(isEvidenceGatedFactualQuestion('Where did the thieves go afterward?')).toBe(true);
    expect(isEvidenceGatedFactualQuestion('When was the vault last opened?')).toBe(true);
    expect(isEvidenceGatedFactualQuestion('Which faction copied the vault tag?')).toBe(true);
    expect(isEvidenceGatedFactualQuestion('Whose vault holds the Key?')).toBe(true);
    expect(isEvidenceGatedFactualQuestion('Does Sera know the culprit?')).toBe(true);
  });

  it('leaves explicitly creative and analytical requests eligible for collaboration', () => {
    expect(isEvidenceGatedFactualQuestion('Who should steal the Emberglass Key?')).toBe(false);
    expect(isEvidenceGatedFactualQuestion('How could the theft complicate chapter six?')).toBe(false);
    expect(isEvidenceGatedFactualQuestion('Can you brainstorm three suspects?')).toBe(false);
    expect(isEvidenceGatedFactualQuestion('What does this imply?', true)).toBe(false);
  });

  it('fails closed with reviewed sources instead of generating an unsupported answer', () => {
    const result = buildUnverifiedFactualAnswer([
      {
        score: 1,
        chunk: {
          id: 'chapter-five-0',
          documentId: 'chapter-five',
          documentTitle: 'Chapter Five',
          content: 'The thieves copied the vault tag, but the passage names no key thief.',
          metadata: {type: 'scene'}
        }
      }
    ]);

    expect(result.content).toContain("couldn't verify an explicit answer");
    expect(result.content).toContain("won't invent one");
    expect(result.results[0].chunk.documentId).toBe('chapter-five');
  });
});
