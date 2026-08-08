import {describe, expect, it} from 'vitest';
import {
  getMemoryQueryTerms,
  getShodhTrustLabel,
  requiresProjectGrounding,
  selectWorldBibleContextForPrompt,
  stripAssistantThinking
} from './AIAssistant.helpers';

describe('assistant grounding helpers', () => {
  it('requires saved project grounding for named factual questions', () => {
    expect(requiresProjectGrounding('What did Sera do before she became a delver?', false)).toBe(true);
    expect(requiresProjectGrounding('Is Tam working for the Hollow Court?', false)).toBe(true);
    expect(requiresProjectGrounding('what cures vaultburn?', false)).toBe(true);
    expect(requiresProjectGrounding('Can you suggest five faction names?', false)).toBe(false);
    expect(requiresProjectGrounding('Give me five complications for this scene.', false)).toBe(false);
    expect(requiresProjectGrounding('What does this imply?', true)).toBe(false);
  });

  it('matches Shodh memories by meaningful query terms instead of the whole question', () => {
    expect(getMemoryQueryTerms('What did Sera do before she became a delver?')).toEqual([
      'sera',
      'became',
      'delver'
    ]);
  });

  it('labels accepted fact memories at their trust tier', () => {
    expect(getShodhTrustLabel(['canon_fact', 'occupation'])).toBe('Accepted canon fact');
    expect(getShodhTrustLabel(['scene'])).toBe('Scene draft');
  });
});

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
