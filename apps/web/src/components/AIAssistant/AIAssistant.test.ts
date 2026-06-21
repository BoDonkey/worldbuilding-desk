import {describe, expect, it} from 'vitest';
import {selectWorldBibleContextForPrompt, stripAssistantThinking} from './AIAssistant';

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

describe('selectWorldBibleContextForPrompt', () => {
  const context = [
    'Category: Races',
    'Current name: The Sireneans',
    'Editable fields:',
    '',
    'Field: Interaction with Other Races',
    'Key: interaction_with_other_races',
    'Current content:',
    'Humans mistrust them. Other races vary.',
    '',
    '---',
    '',
    'Field: Broader Implications',
    'Key: broader_implications',
    'Current content:',
    'Their treatment raises questions about ethics and power.',
    '',
    '---',
    '',
    'Field: Description',
    'Key: description',
    'Current content:',
    'The Sireneans are known for supernatural singing.'
  ].join('\n');

  it('keeps only the requested World Bible field body when a heading is named', () => {
    const selected = selectWorldBibleContextForPrompt(
      context,
      'Can you expand and improve the text in the broader implications section?'
    );

    expect(selected).toContain('Field: Broader Implications');
    expect(selected).toContain('Their treatment raises questions');
    expect(selected).toContain('Available fields:');
    expect(selected).not.toContain('Humans mistrust them');
    expect(selected).not.toContain('supernatural singing');
  });

  it('does not include field bodies when no exact heading is named', () => {
    const selected = selectWorldBibleContextForPrompt(
      context,
      'What should I work on next?'
    );

    expect(selected).toContain('Available fields:');
    expect(selected).toContain('No exact field heading was matched');
    expect(selected).not.toContain('Humans mistrust them');
    expect(selected).not.toContain('Their treatment raises questions');
  });
});
