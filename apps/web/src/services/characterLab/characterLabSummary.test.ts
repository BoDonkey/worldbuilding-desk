import {describe, expect, it} from 'vitest';
import {countAsConversation} from '../llm/contextBudget';
import {
  buildSummarizedTranscript,
  buildSummaryRequest,
  isSummarized,
  shouldOfferSummary,
  summarizableExchanges,
  validateCharacterLabSummaryText,
  SUMMARY_MAX_CHARS,
  SUMMARY_MAX_WORDS,
  type CharacterLabSummary
} from './characterLabSummary';
import type {CharacterLabExchange} from './characterLabTranscript';
import {buildCharacterVoicePrompt, CONVERSATION_SUMMARY_HEADING} from './characterVoicePrompt';

const talk = (id: string, overrides: Partial<CharacterLabExchange> = {}): CharacterLabExchange => ({
  id,
  mode: 'talk',
  prompt: `Q-${id}`,
  reply: `A-${id}`,
  positionLabel: 'the latest point in the manuscript',
  stopped: false,
  ...overrides
});

const exchanges = [talk('1'), talk('2'), talk('r', {mode: 'reaction'}), talk('3', {stopped: true}), talk('4'), talk('5'), talk('6')];
const summary = (coversThroughId: string): CharacterLabSummary => ({text: 'They argued about the oath.', coversThroughId, coveredCount: 2, edited: false});

describe('summarizableExchanges', () => {
  it('offers complete Talk turns, keeping the two most recent out', () => {
    expect(summarizableExchanges(exchanges, null).map((exchange) => exchange.id)).toEqual(['1', '2', '4']);
  });
  it('starts after what is already summarized, and ignores a summary whose turn is gone', () => {
    expect(summarizableExchanges(exchanges, summary('2')).map((exchange) => exchange.id)).toEqual(['4']);
    expect(summarizableExchanges(exchanges, summary('gone')).map((exchange) => exchange.id)).toEqual(['1', '2', '4']);
    expect(summarizableExchanges(exchanges.slice(-2), null)).toEqual([]);
  });
});

describe('buildSummarizedTranscript', () => {
  it('sends the summary in place of the turns it covers, then the later turns in full', () => {
    const sent = buildSummarizedTranscript(exchanges, summary('2'));
    expect(sent.summary).toBe('They argued about the oath.');
    expect(sent.turns.map((turn) => turn.text)).toEqual(['Q-4', 'A-4', 'Q-5', 'A-5', 'Q-6', 'A-6']);
    expect(isSummarized(exchanges, summary('2'), '1')).toBe(true);
    expect(isSummarized(exchanges, summary('2'), '4')).toBe(false);
    // A reaction test inside the summarized range is not a Talk turn, so not summarized.
    expect(isSummarized(exchanges, summary('4'), 'r')).toBe(false);
  });

  it('sends every turn when the summary is empty or absent', () => {
    expect(buildSummarizedTranscript(exchanges, {...summary('2'), text: '  '}).turns).toHaveLength(10);
    expect(buildSummarizedTranscript(exchanges, null)).toMatchObject({summary: null});
  });

  it('labels the summary in the prompt as a working summary, not canon', () => {
    const sent = buildSummarizedTranscript(exchanges, summary('2'));
    const prompt = buildCharacterVoicePrompt({
      mode: 'talk',
      character: {entityId: 'a', name: 'Aria', position: {kind: 'latest'}, positionLabel: 'now', sections: [], snapshot: null},
      transcript: sent.turns,
      summary: sent.summary,
      message: 'Go on.'
    });
    expect(prompt.systemPrompt).toContain(`${CONVERSATION_SUMMARY_HEADING}\nThey argued about the oath.`);
    expect(CONVERSATION_SUMMARY_HEADING).toContain('not canon');
    expect(JSON.stringify(prompt.messages)).not.toContain('Q-1');
  });
});

describe('shouldOfferSummary', () => {
  it('offers once the conversation takes about a third of the context and something can be summarized', () => {
    expect(shouldOfferSummary({conversationTokens: 1500, contextTokens: 4096, summarizable: 1})).toBe(true);
    expect(shouldOfferSummary({conversationTokens: 1000, contextTokens: 4096, summarizable: 1})).toBe(false);
    expect(shouldOfferSummary({conversationTokens: 3000, contextTokens: 4096, summarizable: 0})).toBe(false);
    expect(shouldOfferSummary({conversationTokens: 3000, contextTokens: null, summarizable: 3})).toBe(false);
  });
});

describe('buildSummaryRequest', () => {
  it('sends only the turns, and extends an earlier summary', () => {
    const request = buildSummaryRequest({characterName: 'Aria', previousSummary: 'Earlier: the oath.', exchanges: [talk('4')]});
    expect(request.systemPrompt).toContain('not canon');
    expect(request.messages[0]!.content).toBe('Summary so far (extend it with the turns below):\nEarlier: the oath.\n\nTurns to summarize:\n\nAuthor: Q-4\nAria: A-4');
    expect(() => buildSummaryRequest({characterName: 'Aria', previousSummary: null, exchanges: []})).toThrow('There are no earlier turns');
  });
});

describe('validateCharacterLabSummaryText', () => {
  it('keeps a bounded summary and rejects model output or edits beyond either limit', () => {
    expect(validateCharacterLabSummaryText('  They argued about the oath.  ')).toBe('  They argued about the oath.  ');
    expect(validateCharacterLabSummaryText(Array.from({length: SUMMARY_MAX_WORDS}, () => 'word').join(' '))).toBeTruthy();
    expect(() => validateCharacterLabSummaryText(Array.from({length: SUMMARY_MAX_WORDS + 1}, () => 'word').join(' '))).toThrow(
      /200 words/
    );
    expect(() => validateCharacterLabSummaryText('x'.repeat(SUMMARY_MAX_CHARS + 1))).toThrow(/2,000 characters/);
    expect(validateCharacterLabSummaryText('   ')).toBe('   ');
  });
});

describe('countAsConversation', () => {
  it('moves the summary from instructions to conversation', () => {
    expect(countAsConversation({instructionsTokens: 100, conversationTokens: 50, sections: [], totalTokens: 150}, 'x'.repeat(30))).toEqual({
      instructionsTokens: 90,
      conversationTokens: 60,
      sections: [],
      totalTokens: 150
    });
  });
});
