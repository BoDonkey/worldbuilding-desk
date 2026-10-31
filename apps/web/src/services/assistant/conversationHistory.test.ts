import {describe, expect, it} from 'vitest';
import {
  assistantHistoryBudget,
  buildAssistantHistory,
  DEFAULT_HISTORY_TOKENS
} from './conversationHistory';

const user = (content: string) => ({role: 'user' as const, content});
const assistant = (content: string, extra: object = {}) => ({role: 'assistant' as const, content, ...extra});

describe('buildAssistantHistory', () => {
  it('sends the preceding question and the options the assistant offered', () => {
    const {messages} = buildAssistantHistory(
      [
        user('How should Mira enter the tavern?'),
        assistant('Three options: 1) through the kitchen, 2) the front door, 3) the roof.')
      ],
      DEFAULT_HISTORY_TOKENS
    );
    expect(messages).toEqual([
      {role: 'user', content: 'How should Mira enter the tavern?'},
      {role: 'assistant', content: 'Three options: 1) through the kitchen, 2) the front door, 3) the roof.'}
    ]);
  });

  it('sends only the reply version shown, never discarded alternatives', () => {
    const {messages} = buildAssistantHistory(
      [
        user('Name the ship.'),
        assistant('The Gull', {
          versions: [{content: 'The Wren'}, {content: 'The Gull'}],
          versionIndex: 1
        })
      ],
      DEFAULT_HISTORY_TOKENS
    );
    expect(messages.map((message) => message.content)).toEqual(['Name the ship.', 'The Gull']);
    expect(JSON.stringify(messages)).not.toContain('Wren');
  });

  it('strips model thinking and skips empty or unanswered turns', () => {
    const {messages} = buildAssistantHistory(
      [
        user('First?'),
        assistant('<think>private reasoning</think>Answer one.'),
        user('Interrupted?'),
        user('Second?'),
        assistant('   ')
      ],
      DEFAULT_HISTORY_TOKENS
    );
    expect(messages).toEqual([
      {role: 'user', content: 'First?'},
      {role: 'assistant', content: 'Answer one.'}
    ]);
  });

  it('keeps the newest whole turns within the budget, dropping the oldest first', () => {
    const turns = Array.from({length: 6}, (_, index) => [
      user(`Question ${index + 1} ${'x'.repeat(90)}`),
      assistant(`Answer ${index + 1} ${'y'.repeat(90)}`)
    ]).flat();
    const {messages, omittedTurns} = buildAssistantHistory(turns, 150);
    expect(messages[0]?.content).toMatch(/^Question [56]/);
    expect(messages.at(-1)?.content).toMatch(/^Answer 6/);
    expect(messages.length % 2).toBe(0);
    expect(omittedTurns).toBe(6 - messages.length / 2);
  });

  it('always sends the latest turn, keeping the end of a long reply where its options are', () => {
    const reply = `${'Background. '.repeat(400)}Pick one: the kitchen or the roof?`;
    const {messages} = buildAssistantHistory([user('Which way in?'), assistant(reply)], 120);
    expect(messages[0]).toEqual({role: 'user', content: 'Which way in?'});
    expect(messages[1]?.content).toMatch(/^\[Earlier part of this reply omitted\.\]/);
    expect(messages[1]?.content).toMatch(/Pick one: the kitchen or the roof\?$/);
    expect(messages[1]!.content.length).toBeLessThan(reply.length);
  });
});

describe('assistantHistoryBudget', () => {
  it('uses a quarter of a known context within bounds', () => {
    expect(assistantHistoryBudget(null)).toBe(DEFAULT_HISTORY_TOKENS);
    expect(assistantHistoryBudget(1_000)).toBe(512);
    expect(assistantHistoryBudget(8_192)).toBe(2_048);
    expect(assistantHistoryBudget(200_000)).toBe(6_000);
  });
});
