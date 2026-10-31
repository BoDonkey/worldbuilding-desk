import {describe, expect, it} from 'vitest';
import {
  buildLatestReplyTranscript,
  formatReplyTranscript,
  getLatestTurn,
  getReaderTurn,
  getReplyTurn
} from './conversationTranscript';

const user = (content: string) => ({role: 'user' as const, content});
const assistant = (content: string, extra: object = {}) => ({role: 'assistant' as const, content, ...extra});

const conversation = [
  user('How should Mira enter the tavern?'),
  assistant('Three options: the kitchen, the front door, or the roof.'),
  user('Option 1'),
  assistant('<think>kitchen it is</think>Through the kitchen, past the cook.')
];

describe('conversation transcript (5.17)', () => {
  it('pairs a reply with the question it answered, without model thinking', () => {
    expect(getReplyTurn(conversation, 3)).toEqual({
      replyIndex: 3,
      question: 'Option 1',
      reply: 'Through the kitchen, past the cook.'
    });
    expect(getReplyTurn(conversation, 1)?.question).toBe('How should Mira enter the tavern?');
    expect(getReplyTurn(conversation, 0)).toBeNull();
  });

  it('formats the question and the shown reply for the author to review', () => {
    expect(buildLatestReplyTranscript(conversation)).toBe(
      'Question: Option 1\n\nAnswer:\nThrough the kitchen, past the cook.'
    );
    expect(formatReplyTranscript({question: null, reply: 'Just the reply.'})).toBe('Just the reply.');
  });

  it('saves only the reply version shown, never discarded alternatives', () => {
    const transcript = buildLatestReplyTranscript([
      user('Name the ship.'),
      assistant('The Gull', {versions: [{content: 'The Wren'}, {content: 'The Gull'}], versionIndex: 1})
    ]);
    expect(transcript).toBe('Question: Name the ship.\n\nAnswer:\nThe Gull');
    expect(transcript).not.toContain('Wren');
  });

  it('has nothing to save before a reply exists', () => {
    expect(buildLatestReplyTranscript([user('Hello?')])).toBeNull();
    expect(buildLatestReplyTranscript([user('Hello?'), assistant('  ')])).toBeNull();
  });

  it('follows the newest turn, including a reply still being written', () => {
    expect(getLatestTurn([...conversation, user('And then?')])).toEqual({
      replyIndex: null,
      question: 'And then?',
      reply: ''
    });
    expect(getLatestTurn([...conversation, user('And then?'), assistant('The cook')])).toEqual({
      replyIndex: 5,
      question: 'And then?',
      reply: 'The cook'
    });
    expect(getReaderTurn(conversation, 'latest')?.replyIndex).toBe(3);
    expect(getReaderTurn(conversation, 1)?.reply).toMatch(/^Three options/);
    expect(getReaderTurn(conversation, null)).toBeNull();
  });
});
