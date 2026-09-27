import {describe, expect, it} from 'vitest';
import {
  buildCharacterTalkTranscript,
  formatCharacterLabScratchpadHtml,
  type CharacterLabExchange
} from './characterLabTranscript';

const exchange = (overrides: Partial<CharacterLabExchange>): CharacterLabExchange => ({
  id: crypto.randomUUID(),
  mode: 'talk',
  prompt: 'Where were you?',
  reply: 'Out.',
  positionLabel: 'the opening of "The Vault"',
  stopped: false,
  ...overrides
});

describe('buildCharacterTalkTranscript', () => {
  it('replays completed Talk turns only', () => {
    expect(
      buildCharacterTalkTranscript([
        exchange({prompt: 'One', reply: 'Uno'}),
        exchange({mode: 'reaction', prompt: 'A fire starts', reply: 'She runs.'}),
        exchange({prompt: 'Two', reply: 'Partial', stopped: true}),
        exchange({prompt: 'Three', reply: '  '}),
        exchange({prompt: 'Four', reply: 'Cuatro'})
      ])
    ).toEqual([
      {speaker: 'author', text: 'One'},
      {speaker: 'character', text: 'Uno'},
      {speaker: 'author', text: 'Four'},
      {speaker: 'character', text: 'Cuatro'}
    ]);
  });
});

describe('formatCharacterLabScratchpadHtml', () => {
  it('marks the session as draft, labels positions and speakers, and escapes text', () => {
    const html = formatCharacterLabScratchpadHtml({
      characterName: 'Mira <Hawk>',
      exchanges: [
        exchange({prompt: 'Is it <safe>?', reply: 'No.\n\nNot for you & me.'}),
        exchange({mode: 'reaction', prompt: 'Oren lies', reply: 'She notices.', positionLabel: 'the latest point in the manuscript'}),
        exchange({prompt: 'Why?', reply: 'Because', stopped: true, positionLabel: 'the latest point in the manuscript'})
      ]
    });

    expect(html).toBe(
      '<h3>Character lab: Mira &lt;Hawk&gt;</h3>' +
        '<p><em>Draft from the character lab. Not canon.</em></p>' +
        '<p><em>Story state at the opening of &quot;The Vault&quot;</em></p>' +
        '<p><strong>You:</strong> Is it &lt;safe&gt;?</p>' +
        '<p><strong>Mira &lt;Hawk&gt;:</strong> No.</p><p>Not for you &amp; me.</p>' +
        '<p><em>Story state at the latest point in the manuscript</em></p>' +
        '<p><strong>Reaction test:</strong> Oren lies</p>' +
        '<p>She notices.</p>' +
        '<p><strong>You:</strong> Why?</p>' +
        '<p><strong>Mira &lt;Hawk&gt;:</strong> Because</p>' +
        '<p><em>(Stopped before the reply finished.)</em></p>'
    );
  });
});
