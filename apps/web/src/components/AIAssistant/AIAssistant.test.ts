import {describe, expect, it} from 'vitest';
import {stripAssistantThinking} from './AIAssistant';

describe('stripAssistantThinking', () => {
  it('removes visible thinking markup while preserving the answer', () => {
    expect(
      stripAssistantThinking(
        '<think>Try names.</think><think>Pick five.</think>Here are the names.'
      )
    ).toBe('Here are the names.');
  });

  it('hides incomplete streamed thinking blocks', () => {
    expect(stripAssistantThinking('<think>Still choosing')).toBe('');
  });
});
