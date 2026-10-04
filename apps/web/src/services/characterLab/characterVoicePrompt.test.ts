import {describe, expect, it} from 'vitest';
import type {CharacterVoiceContext} from './characterVoiceContext';
import {
  buildCharacterVoicePrompt,
  CHARACTER_KNOWLEDGE_DISCLAIMER,
  CHARACTER_VOICE_RULES,
  type CharacterVoicePrompt,
  type CharacterVoiceRequest
} from './characterVoicePrompt';

const context = (name: string): CharacterVoiceContext => ({
  entityId: `entity-${name.toLowerCase()}`,
  name,
  position: {kind: 'scene', sceneId: 'scene-2', moment: 'opening'},
  positionLabel: 'the opening of "The Vault"',
  snapshot: null,
  sections: [
    {
      kind: 'canon-record',
      source: `Accepted canon: World Bible record - ${name}`,
      content: `${name}\nnotes: ${name.toUpperCase()}-RECORD`,
      provenance: []
    },
    {
      kind: 'accepted-facts',
      source: `Accepted canon facts - ${name}`,
      content: `- trait: ${name.toUpperCase()}-FACT`,
      provenance: []
    },
    {
      kind: 'dialogue-style',
      source: `Assigned dialogue style - ${name}`,
      content: `Dialogue style: ${name.toUpperCase()}-STYLE`,
      provenance: []
    },
    {
      kind: 'story-state',
      source: `Story state at the opening of "The Vault" - ${name}`,
      content: `Location: ${name.toUpperCase()}-LOCATION`,
      provenance: []
    }
  ]
});

const mira = context('Mira');
const oren = context('Oren');
const tess = context('Tess');

const assembled = (prompt: CharacterVoicePrompt): string =>
  [prompt.systemPrompt, ...prompt.messages.map((message) => message.content)].join('\n');

const expectContext = (text: string, character: CharacterVoiceContext) => {
  character.sections.forEach((section) => {
    expect(text).toContain(`[Source: ${section.source}]\n${section.content}`);
  });
};

const requests: Record<CharacterVoiceRequest['mode'], CharacterVoiceRequest> = {
  talk: {
    mode: 'talk',
    character: mira,
    transcript: [
      {speaker: 'author', text: 'TURN-AUTHOR-1'},
      {speaker: 'character', text: 'TURN-CHARACTER-1'}
    ],
    message: 'TALK-MESSAGE',
    authorInstructions: 'SETTING-INSTRUCTIONS-TALK'
  },
  reaction: {
    mode: 'reaction',
    character: mira,
    situation: 'REACTION-SITUATION',
    authorInstructions: 'SETTING-INSTRUCTIONS-REACTION'
  },
  scene: {
    mode: 'scene',
    characters: [mira, oren],
    direction: {kind: 'directed', setup: 'SCENE-SETUP'},
    authorInstructions: 'SETTING-INSTRUCTIONS-SCENE'
  },
  generation: {
    mode: 'generation',
    description: 'GENERATION-DESCRIPTION',
    authorInstructions: 'SETTING-INSTRUCTIONS-GENERATION'
  }
};

describe('buildCharacterVoicePrompt', () => {
  it('includes every author-supplied setting in the assembled prompt for each variant', () => {
    const talk = buildCharacterVoicePrompt(requests.talk);
    expect(assembled(talk)).toContain('SETTING-INSTRUCTIONS-TALK');
    expect(talk.messages).toEqual([
      {role: 'user', content: 'TURN-AUTHOR-1'},
      {role: 'assistant', content: 'TURN-CHARACTER-1'},
      {role: 'user', content: 'TALK-MESSAGE'}
    ]);
    expectContext(talk.systemPrompt, mira);

    const reaction = assembled(buildCharacterVoicePrompt(requests.reaction));
    expect(reaction).toContain('SETTING-INSTRUCTIONS-REACTION');
    expect(reaction).toContain('REACTION-SITUATION');
    expectContext(reaction, mira);

    const scene = assembled(buildCharacterVoicePrompt(requests.scene));
    expect(scene).toContain('SETTING-INSTRUCTIONS-SCENE');
    expect(scene).toContain('SCENE-SETUP');

    const surprise = assembled(
      buildCharacterVoicePrompt({
        mode: 'scene',
        characters: [mira, oren],
        direction: {kind: 'surprise', seeds: ['SEED-THREAD', 'SEED-CARD']}
      })
    );
    expect(surprise).toContain('- SEED-THREAD');
    expect(surprise).toContain('- SEED-CARD');

    const generation = assembled(buildCharacterVoicePrompt(requests.generation));
    expect(generation).toContain('SETTING-INSTRUCTIONS-GENERATION');
    expect(generation).toContain('GENERATION-DESCRIPTION');
  });

  it('carries the character rules to every in-character variant, and the knowledge disclaimer with story state', () => {
    (['talk', 'reaction', 'scene'] as const).forEach((mode) => {
      const {systemPrompt} = buildCharacterVoicePrompt(requests[mode]);
      expect(systemPrompt).toContain(CHARACTER_VOICE_RULES);
      expect(systemPrompt).toContain(CHARACTER_KNOWLEDGE_DISCLAIMER);
      expect(systemPrompt).toContain('the opening of "The Vault"');
    });
    const generation = buildCharacterVoicePrompt(requests.generation).systemPrompt;
    expect(generation).toContain('Do not invent a name');
    expect(generation).toContain('Appearance:');
    expect(generation).toContain('Biography:');
    expect(generation).toContain('never a stable fact');
    expect(generation).toContain('Nothing you return becomes canon.');
  });

  it('includes each selected character in a scene and no one else', () => {
    const text = assembled(buildCharacterVoicePrompt({...requests.scene, characters: [mira, tess]} as CharacterVoiceRequest));

    expectContext(text, mira);
    expectContext(text, tess);
    expect(text).not.toContain('OREN-');
  });

  it('rejects empty input and invalid scene casts instead of sending them', () => {
    expect(() => buildCharacterVoicePrompt({...requests.talk, message: '  '} as CharacterVoiceRequest)).toThrow('empty');
    expect(() => buildCharacterVoicePrompt({...requests.reaction, situation: ''} as CharacterVoiceRequest)).toThrow('empty');
    expect(() => buildCharacterVoicePrompt({...requests.generation, description: ''} as CharacterVoiceRequest)).toThrow('empty');
    expect(() => buildCharacterVoicePrompt({...requests.scene, characters: [mira]} as CharacterVoiceRequest)).toThrow('two or three');
    expect(() =>
      buildCharacterVoicePrompt({...requests.scene, characters: [mira, oren, tess, context('Ula')]} as CharacterVoiceRequest)
    ).toThrow('two or three');
    expect(() => buildCharacterVoicePrompt({...requests.scene, characters: [mira, mira]} as CharacterVoiceRequest)).toThrow('different');
    expect(() =>
      buildCharacterVoicePrompt({mode: 'scene', characters: [mira, oren], direction: {kind: 'surprise', seeds: [' ']}})
    ).toThrow('story thread');
  });

  it('omits the instructions block when the author gave none', () => {
    const {systemPrompt} = buildCharacterVoicePrompt({...requests.reaction, authorInstructions: '  '} as CharacterVoiceRequest);
    expect(systemPrompt).not.toContain("Author's instructions");
  });
});
