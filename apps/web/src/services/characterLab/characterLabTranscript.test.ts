import {describe, expect, it} from 'vitest';
import {
  buildCharacterTalkTranscript,
  dropShownVersion,
  exchangeVersionCount,
  formatCharacterLabScratchpadHtml,
  keepShownVersion,
  showExchangeVersion,
  startExchangeVersion,
  updateShownVersion,
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

describe('reply versions (4.73)', () => {
  const base: CharacterLabExchange = {
    id: 'e1',
    mode: 'talk',
    prompt: 'Who do you serve?',
    reply: 'The Ember Court.',
    positionLabel: 'the latest point in the manuscript',
    stopped: false
  };

  it('adds versions, keeps reply in step with the version shown, and steps between them', () => {
    let exchange = startExchangeVersion(base);
    expect(exchange).toMatchObject({reply: '', versionIndex: 1, versions: [{reply: 'The Ember Court.'}, {reply: ''}]});
    exchange = updateShownVersion(exchange, {reply: 'No one.', stopped: true});
    expect(exchange).toMatchObject({reply: 'No one.', stopped: true});
    expect(exchange.versions?.[1]).toEqual({reply: 'No one.', stopped: true});
    expect(exchangeVersionCount(exchange)).toBe(2);

    exchange = showExchangeVersion(exchange, 0);
    expect(exchange).toMatchObject({reply: 'The Ember Court.', stopped: false, versionIndex: 0});
    expect(showExchangeVersion(exchange, 7)).toBe(exchange);
    // Without versions, updating just sets the reply.
    expect(updateShownVersion(base, {reply: 'x'}).reply).toBe('x');
  });

  it('keeps only the version shown, and only it reaches the transcript and the Scratchpad', () => {
    const chosen = showExchangeVersion(updateShownVersion(startExchangeVersion(base), {reply: 'UNKEPT'}), 0);
    const kept = keepShownVersion(chosen);
    expect(kept).toEqual(base);
    expect(JSON.stringify(buildCharacterTalkTranscript([chosen]))).not.toContain('UNKEPT');
    expect(formatCharacterLabScratchpadHtml({characterName: 'Aria', exchanges: [chosen]})).not.toContain('UNKEPT');
  });

  it('drops a failed version and goes back to the one before', () => {
    const failed = startExchangeVersion(base);
    expect(dropShownVersion(failed)).toEqual(base);
    const three = startExchangeVersion(updateShownVersion(startExchangeVersion(base), {reply: 'Second.'}));
    expect(dropShownVersion(three)).toMatchObject({reply: 'Second.', versionIndex: 1, versions: [{reply: 'The Ember Court.'}, {reply: 'Second.'}]});
    expect(dropShownVersion(base)).toBe(base);
  });
});
