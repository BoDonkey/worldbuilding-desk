import type {LLMMessage} from '../llm/types';
import type {CharacterVoiceContext} from './characterVoiceContext';

/**
 * The shared in-character prompt for the character lab. Every variant carries
 * the same character rules and knowledge disclaimer, and embeds its grounding
 * in the system prompt itself: the local Ollama provider does not render
 * `LLMRequest.context`, and lab runs must behave the same on every provider.
 */
export const CHARACTER_VOICE_RULES =
  'Character rules:\n' +
  '- Stay the character. They may disagree, refuse, hesitate, misunderstand, or change the ' +
  'subject when that is what they would do.\n' +
  '- Do not become agreeable to please the author. Do not flatter them or tell them what they ' +
  'want to hear.\n' +
  '- Do not invent major biography: family, history, relationships, abilities, or past events ' +
  'that the context below does not establish. Small incidental detail is fine.\n' +
  '- When the context does not decide something, say so or let the character be unsure, rather ' +
  'than settling it.\n' +
  '- Never contradict the accepted canon or accepted facts below.';

export const CHARACTER_KNOWLEDGE_DISCLAIMER =
  'About story state: it says what is true in the story at the chosen point, not what any ' +
  'character knows. A character may be unaware of parts of it. Do not assume a character knows ' +
  'something only because it appears there.';

/** The generation reply contract; `parseCharacterProfileReply` enforces it. */
export const CHARACTER_PROFILE_REPLY_FORMAT =
  'Reply with JSON only, in this shape:\n' +
  '{"name": string or null, "stableFacts": [{"factType": one of "alias", "age", "occupation", ' +
  '"membership", "heritage", "appearance", "trait", "ability", "relationship", "goal", ' +
  '"background"; "value": short text; "quote": the exact words from the description that ' +
  'state it}], "suggestedDetails": [short text]}\n' +
  'Use null for the name unless the description gives one. Every quote must be copied ' +
  'exactly from the description; a fact without one is discarded.';

const LAB_OUTPUT_NOTE =
  'Your reply is draft material for the author. It does not change their story, canon, or notes.';

export type CharacterVoiceTurn = {speaker: 'author' | 'character'; text: string};

export type CharacterSceneDirection =
  | {kind: 'directed'; setup: string}
  | {kind: 'surprise'; seeds: string[]};

export type CharacterVoiceRequest =
  | {
      mode: 'talk';
      character: CharacterVoiceContext;
      /** Earlier turns in this session, oldest first. */
      transcript: CharacterVoiceTurn[];
      message: string;
      authorInstructions?: string;
    }
  | {
      mode: 'reaction';
      character: CharacterVoiceContext;
      situation: string;
      authorInstructions?: string;
    }
  | {
      mode: 'scene';
      characters: CharacterVoiceContext[];
      direction: CharacterSceneDirection;
      authorInstructions?: string;
    }
  | {
      mode: 'generation';
      description: string;
      authorInstructions?: string;
    };

export interface CharacterVoicePrompt {
  systemPrompt: string;
  messages: LLMMessage[];
}

const renderContext = (context: CharacterVoiceContext): string =>
  context.sections.map((section) => `[Source: ${section.source}]\n${section.content}`).join('\n\n');

const renderAuthorInstructions = (instructions: string | undefined): string | null => {
  const trimmed = instructions?.trim();
  return trimmed ? `Author's instructions for this run:\n${trimmed}` : null;
};

const joinBlocks = (blocks: Array<string | null>): string =>
  blocks.filter((block): block is string => Boolean(block)).join('\n\n');

const requireText = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is empty.`);
  return trimmed;
};

export function buildCharacterVoicePrompt(request: CharacterVoiceRequest): CharacterVoicePrompt {
  switch (request.mode) {
    case 'talk': {
      const {character} = request;
      return {
        systemPrompt: joinBlocks([
          `You are ${character.name}, a character in the author's story, speaking in the first ` +
            `person. The author is talking with you to learn how you think and speak. Answer as ` +
            `${character.name} would at ${character.positionLabel}, in your own voice.`,
          CHARACTER_VOICE_RULES,
          CHARACTER_KNOWLEDGE_DISCLAIMER,
          LAB_OUTPUT_NOTE,
          renderAuthorInstructions(request.authorInstructions),
          `Context for ${character.name}:\n\n${renderContext(character)}`
        ]),
        messages: [
          ...request.transcript.map((turn) => ({
            role: turn.speaker === 'author' ? ('user' as const) : ('assistant' as const),
            content: turn.text
          })),
          {role: 'user', content: requireText(request.message, 'The message')}
        ]
      };
    }
    case 'reaction': {
      const {character} = request;
      return {
        systemPrompt: joinBlocks([
          `You help the author test how ${character.name}, a character in their story, would ` +
            `react to a situation at ${character.positionLabel}.`,
          CHARACTER_VOICE_RULES,
          CHARACTER_KNOWLEDGE_DISCLAIMER,
          LAB_OUTPUT_NOTE,
          renderAuthorInstructions(request.authorInstructions),
          `Context for ${character.name}:\n\n${renderContext(character)}`
        ]),
        messages: [
          {
            role: 'user',
            content:
              `Situation:\n${requireText(request.situation, 'The situation')}\n\n` +
              `Describe ${character.name}'s likely behavior, the reasoning behind it drawn from ` +
              `the context, and a few lines of what they might say. If the context does not ` +
              `decide how they would react, say what is uncertain and give the most likely ` +
              `options instead of one confident answer.`
          }
        ]
      };
    }
    case 'scene': {
      const {characters} = request;
      if (characters.length < 2 || characters.length > 3) {
        throw new Error('A character scene needs two or three characters.');
      }
      if (new Set(characters.map((character) => character.entityId)).size !== characters.length) {
        throw new Error('Choose different characters for a scene.');
      }
      if (request.direction.kind === 'surprise' && !request.direction.seeds.some((seed) => seed.trim())) {
        throw new Error('A surprise scene needs at least one story thread.');
      }
      const names = characters.map((character) => character.name);
      const direction =
        request.direction.kind === 'directed'
          ? `Scene setup from the author:\n${requireText(request.direction.setup, 'The scene setup')}`
          : `The author asked to be surprised. Build the scene from one of these story threads:\n` +
            request.direction.seeds
              .map((seed) => seed.trim())
              .filter(Boolean)
              .map((seed) => `- ${seed}`)
              .join('\n');
      return {
        systemPrompt: joinBlocks([
          `You write a short draft scene for the author with these characters from their story: ` +
            `${names.join(', ')}. Write prose with dialogue, and name the speaker of every line ` +
            `of dialogue. Each character acts only from their own context below.`,
          CHARACTER_VOICE_RULES,
          CHARACTER_KNOWLEDGE_DISCLAIMER,
          LAB_OUTPUT_NOTE,
          renderAuthorInstructions(request.authorInstructions),
          ...characters.map(
            (character) =>
              `Context for ${character.name} (at ${character.positionLabel}):\n\n${renderContext(character)}`
          )
        ]),
        messages: [{role: 'user', content: direction}]
      };
    }
    case 'generation':
      return {
        systemPrompt: joinBlocks([
          'You help the author turn a rough description into a character profile for their ' +
            'story. Split the profile into stable facts, which the description states or ' +
            'clearly implies, and suggested details, which are your ideas for the author to ' +
            'accept or discard.',
          'Generation rules:\n' +
            '- Do not invent a name the description does not give.\n' +
            '- Do not invent major biography: family, history, relationships, abilities, or ' +
            'past events. Offer those only as suggested details, if at all.\n' +
            '- Keep every stable fact traceable to the description.\n' +
            '- When the description does not decide something, leave it open.',
          'Nothing you return becomes canon. The author reviews every fact and detail.',
          CHARACTER_PROFILE_REPLY_FORMAT,
          renderAuthorInstructions(request.authorInstructions)
        ]),
        messages: [
          {
            role: 'user',
            content: `Rough description:\n${requireText(request.description, 'The description')}`
          }
        ]
      };
  }
}
