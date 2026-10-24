import {describe, expect, it} from 'vitest';
import {
  buildUnverifiedFactualAnswer,
  isContinuationRequest,
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

  // 1.4b: classify by what is asked, not by the opening word.
  it.each([
    'Tell me how long Brannic served',
    'Remind me where the ledger is kept',
    "Give me Sera's rank",
    'Show me who holds the Emberglass Key',
    'List the members of the Compact',
    "What's Sera's occupation?",
    'And his rank?',
    'So where did she go?',
    'How about Dess?',
    'What about her brother?',
    'Also, when was the vault sealed?',
    'Please tell me where Odessa lives',
    'Can you tell me where Sera was born?',
    'Could you remind me how old Brannic is?',
    'Can you explain the Compact succession?'
  ])('gates the report-style or continuing request "%s"', (prompt) => {
    expect(isEvidenceGatedFactualQuestion(prompt)).toBe(true);
  });

  it.each([
    'Write the next scene with Sera and Brannic',
    'Draft a letter from Odessa',
    "Describe Sera's workshop",
    'Brainstorm three suspects',
    'Suggest a name for the tavern',
    'Rewrite this paragraph',
    'Expand the vault heist',
    'Tell me a story about the Compact',
    'Give me three names for a harbor tavern',
    'Give me five complications for this scene.',
    'List five ways Sera could escape',
    'And write the confrontation',
    'So, what should happen next?',
    'How about we cut the flashback?',
    'Could you tighten this line?',
    'Who might betray the Compact?',
    'Help me plot chapter six'
  ])('keeps the request for new text "%s" on the creative path', (prompt) => {
    expect(isEvidenceGatedFactualQuestion(prompt)).toBe(false);
  });

  it('recognizes continuations of the previous turn', () => {
    expect(isContinuationRequest('And his rank?')).toBe(true);
    expect(isContinuationRequest('How about Dess?')).toBe(true);
    expect(isContinuationRequest('Who rules the harbor?')).toBe(false);
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
