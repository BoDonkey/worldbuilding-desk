import {describe, expect, it} from 'vitest';
import {
  getDirectSavedFactAnswer,
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

  it('answers an explicit saved eye-color field without delegating it to the model', () => {
    const result = getDirectSavedFactAnswer("What color are Sera's eyes?", [
      {
        score: 1.5,
        chunk: {
          id: 'sera-0',
          documentId: 'sera',
          documentTitle: 'Sera Kestrel',
          content: 'Sera Kestrel description: A delver. appearance: gray eyes',
          metadata: {type: 'worldbible', tags: ['characters']}
        }
      },
      {
        score: 1,
        chunk: {
          id: 'scene-0',
          documentId: 'scene',
          documentTitle: 'Chapter One',
          content: 'Blue eyes watched Sera from the doorway.',
          metadata: {type: 'scene'}
        }
      }
    ]);

    expect(result?.content).toBe("Sera's eyes are gray.");
    expect(result?.results[0].chunk.documentId).toBe('sera');
  });

  it('answers D-1 from the accepted occupation fact instead of creative context', () => {
    const result = getDirectSavedFactAnswer(
      'What did Sera do before she became a delver?',
      [
        {
          score: 2,
          chunk: {
            id: 'sera-world-0',
            documentId: 'sera',
            documentTitle: 'Sera Kestrel',
            content: 'Sera Kestrel description: Junior delver.',
            metadata: {type: 'worldbible'}
          }
        },
        {
          score: 1.4,
          chunk: {
            id: 'sera-occupation-0',
            documentId: 'canon-fact:occupation',
            documentTitle: 'Sera Kestrel',
            content: 'Sera Kestrel occupation: cartographer',
            metadata: {type: 'canon_fact', tags: ['canon_fact', 'occupation']}
          }
        },
        {
          score: 1.2,
          chunk: {
            id: 'working-notes-0',
            documentId: 'lore:working-notes',
            documentTitle: 'Working Notes',
            content: 'Earlier draft idea: Sera was a smuggler.',
            metadata: {type: 'lore'}
          }
        }
      ]
    );

    expect(result?.content).toBe('Sera was a cartographer before becoming a delver.');
    expect(result?.results.map((entry) => entry.chunk.metadata.type)).toEqual([
      'canon_fact'
    ]);
  });

  it('answers accepted service length and treatment facts deterministically', () => {
    const facts = [
      {
        score: 1.8,
        chunk: {
          id: 'brannic-service-0',
          documentId: 'canon-fact:service',
          documentTitle: 'Brannic Halloway',
          content: 'Brannic Halloway background: Compact service: twenty years',
          metadata: {type: 'canon_fact' as const}
        }
      },
      {
        score: 1.7,
        chunk: {
          id: 'vaultburn-treatment-0',
          documentId: 'canon-fact:treatment',
          documentTitle: 'The Undervault',
          content:
            'The Undervault background: Vaultburn treatment: salt, cedar oil, and whitethorn ash',
          metadata: {type: 'canon_fact' as const}
        }
      }
    ];

    expect(
      getDirectSavedFactAnswer('How long has Brannic served the Compact?', facts)
        ?.content
    ).toBe('Brannic has served the Compact for twenty years.');
    expect(getDirectSavedFactAnswer('What cures Vaultburn?', facts)?.content).toBe(
      'Vaultburn is treated with salt, cedar oil, and whitethorn ash.'
    );
  });

  it('states the manuscript window when citing a superseded fact', () => {
    const result = getDirectSavedFactAnswer('What was Sera\'s occupation?', [{
      score: 2,
      chunk: {
        id: 'occupation-0',
        documentId: 'canon-fact:occupation',
        documentTitle: 'Sera',
        content: 'Sera occupation: cartographer (before Chapter Two)',
        metadata: {type: 'canon_fact'}
      }
    }]);
    expect(result?.content).toBe(
      'Sera\'s accepted occupation is cartographer. This fact applies before Chapter Two.'
    );
  });

  it('fails D-3 closed when no accepted membership fact exists', () => {
    const result = getDirectSavedFactAnswer(
      'Is Tam working for the Hollow Court?',
      [
        {
          score: 2,
          chunk: {
            id: 'speculation-0',
            documentId: 'lore:working-notes',
            documentTitle: 'Working Notes',
            content: 'What if Tam is Hollow Court?',
            metadata: {type: 'lore'}
          }
        }
      ]
    );

    expect(result?.content).toBe(
      "Tam's connection with Hollow Court is not established in accepted canon."
    );
    expect(result?.results).toEqual([]);
  });

  it('reports conflicting accepted facts instead of selecting one', () => {
    const result = getDirectSavedFactAnswer(
      'What did Sera do before she became a delver?',
      ['cartographer', 'smuggler'].map((value, index) => ({
        score: 2 - index,
        chunk: {
          id: `occupation-${index}`,
          documentId: `canon-fact:${index}`,
          documentTitle: 'Sera Kestrel',
          content: `Sera Kestrel occupation: ${value}`,
          metadata: {type: 'canon_fact' as const}
        }
      }))
    );

    expect(result?.content).toContain('conflicting occupation facts');
    expect(result?.content).toContain("won't choose one");
    expect(result?.results).toHaveLength(2);
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

  it('removes leaked silent-system scaffolding from provider output', () => {
    expect(
      stripAssistantThinking(
        '*SILENT SYSTEM MESSAGE*\nEYES_COLOR: SERA_EYES_COLOR\n*END SYSTEM MESSAGE*\n\nSera has gray eyes.'
      )
    ).toBe('Sera has gray eyes.');
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
