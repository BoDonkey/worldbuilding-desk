import type {
  CanonicalFact,
  ProjectAISettings,
  SelectionAction,
  SelectionActionOutput,
  WorldEntity
} from '../../entityTypes';
import type {ConsultationFeature} from '../editor/inspectorBudgetService';
import type {LLMMessage} from '../llm/types';
import {readAISwitches} from '../llm/aiSwitches';
import {findLinkedRecords} from '../characterLab/characterVoiceContext';
import {canonCheckSceneText} from '../consistency/modelCanonCheck';
import {buildWorldBibleEntityContent} from '../worldBible/worldBibleEntityHelpers';
import type {ConsistencyAlias} from '../storage';

/**
 * Custom AI actions (Slice 5.19): one-shot tasks the author runs on selected text from the
 * selection menu. Prompt tools are standing instructions for the chat and do not apply here.
 *
 * Trust boundary: author-invoked only. A `replace` result goes to the scene revision preview and
 * changes the scene only on Confirm; a `note` result is read-only. Nothing writes canon or
 * mechanics.
 */

/** Shipped examples. All start switched off; once installed they are ordinary, editable actions. */
export const SELECTION_ACTION_PRESETS: readonly SelectionAction[] = [
  {
    id: 'preset-tighten',
    presetId: 'tighten',
    name: 'Tighten',
    instructions:
      "Cut filler words and redundant phrases. Keep the meaning, voice and tense. Don't add anything new.",
    includeScene: false,
    includeWorldBible: false,
    output: 'replace',
    enabled: false
  },
  {
    id: 'preset-expand-beat',
    presetId: 'expand-beat',
    name: 'Expand this beat',
    instructions:
      'Expand this beat into a fuller moment: slow down, add action and interiority that fit the scene. Keep the voice, tense and point of view. Do not move the plot past where the passage ends.',
    includeScene: true,
    includeWorldBible: true,
    output: 'replace',
    enabled: false
  },
  {
    id: 'preset-sensory-detail',
    presetId: 'sensory-detail',
    name: 'Add sensory detail',
    instructions:
      'Weave in concrete sensory detail (sound, smell, touch, light) that fits the setting. Keep every existing event and line of dialogue, and keep the voice and tense.',
    includeScene: true,
    includeWorldBible: true,
    output: 'replace',
    enabled: false
  },
  {
    id: 'preset-sentence-rhythm',
    presetId: 'sentence-rhythm',
    name: 'Vary sentence rhythm',
    instructions:
      'Vary sentence length and structure so the passage reads less monotonously. Keep the wording where you can, and keep the meaning, voice and tense.',
    includeScene: false,
    includeWorldBible: false,
    output: 'replace',
    enabled: false
  },
  {
    id: 'preset-check-canon',
    presetId: 'check-canon',
    name: 'Check against canon',
    instructions:
      'List anything in this passage that contradicts accepted facts, citing each fact. If nothing contradicts them, say so.',
    includeScene: false,
    includeWorldBible: true,
    output: 'note',
    enabled: false
  }
];

export const SELECTION_ACTION_OUTPUT_LABELS: Record<SelectionActionOutput, string> = {
  replace: 'Rewrite the selection',
  note: 'Write a note (no edit)'
};

/** A project that has never saved its own list gets the presets, all switched off. */
export function readSelectionActions(
  settings: Pick<ProjectAISettings, 'selectionActions'> | null | undefined
): SelectionAction[] {
  return settings?.selectionActions ?? SELECTION_ACTION_PRESETS.map((preset) => ({...preset}));
}

/** The AI switch an action's output needs: notes are coaching, rewrites are prose (5.18). */
export const selectionActionFeature = (output: SelectionActionOutput): ConsultationFeature =>
  output === 'replace' ? 'ai-action-replace' : 'ai-action-note';

const switchAllows = (
  settings: Pick<ProjectAISettings, 'aiCoaching' | 'aiProse'> | null | undefined,
  output: SelectionActionOutput
): boolean => {
  const switches = readAISwitches(settings);
  return output === 'replace' ? switches.prose : switches.coaching;
};

/** Actions whose AI switch is on; the others are hidden from Settings' list and the menu. */
export function actionsAllowedBySwitches(settings: ProjectAISettings | null | undefined): SelectionAction[] {
  return readSelectionActions(settings).filter((action) => switchAllows(settings, action.output));
}

/** What the selection menu lists: switched-on actions whose AI switch is on. */
export function menuSelectionActions(settings: ProjectAISettings | null | undefined): SelectionAction[] {
  return actionsAllowedBySwitches(settings).filter(
    (action) => action.enabled && action.name.trim() && action.instructions.trim()
  );
}

/**
 * Re-adds presets that are missing. An installed preset keeps its `presetId` after edits, so an
 * edited preset counts as present and is left alone.
 */
export function installMissingPresets(actions: SelectionAction[]): {
  actions: SelectionAction[];
  added: number;
} {
  const presentPresetIds = new Set(actions.map((action) => action.presetId).filter(Boolean));
  const usedIds = new Set(actions.map((action) => action.id));
  const additions = SELECTION_ACTION_PRESETS.filter(
    (preset) => !presentPresetIds.has(preset.presetId)
  ).map((preset) => ({...preset, id: usedIds.has(preset.id) ? crypto.randomUUID() : preset.id}));
  return {actions: [...actions, ...additions], added: additions.length};
}

/** At most this many records named in the selection go with an action. */
export const MAX_ACTION_RECORDS = 6;

export interface SelectionActionRecord {
  name: string;
  content: string;
  facts: string[];
  /** The named record this one is linked to, when it came from the 4.71 linked-record pull-in. */
  linkedTo?: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namedIn = (text: string, surface: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(surface)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
const factText = (fact: CanonicalFact) =>
  `${fact.factType.replace(/_/g, ' ')}: ${typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`}`;

/**
 * The World Bible records the selection names (by name or entity alias), with their accepted
 * facts, plus, when the project includes linked records (4.71), the records one hop from each.
 * `facts` must already be accepted and valid at the scene.
 */
export function selectActionRecords(params: {
  selectedText: string;
  entities: WorldEntity[];
  characters: Array<{id: string; entityId?: string}>;
  aliases: ConsistencyAlias[];
  facts: CanonicalFact[];
  includeLinkedRecords: boolean;
}): SelectionActionRecord[] {
  const entityIdForCharacter = new Map(
    params.characters.filter((character) => character.entityId).map((character) => [character.id, character.entityId!])
  );
  const factOwner = (fact: CanonicalFact) =>
    fact.targetType === 'character' ? entityIdForCharacter.get(fact.targetId) ?? fact.targetId : fact.targetId;
  const factsFor = (entity: WorldEntity) => params.facts.filter((fact) => factOwner(fact) === entity.id);
  const entityAliases = (entity: WorldEntity) =>
    params.aliases
      .filter((alias) => (alias.targetType ?? 'entity') === 'entity' && alias.targetId === entity.id)
      .map((alias) => alias.alias);

  const named = params.entities
    .filter((entity) =>
      [entity.name, ...entityAliases(entity)]
        .map((surface) => surface.trim())
        .some((surface) => surface.length >= 2 && namedIn(params.selectedText, surface))
    )
    .slice(0, MAX_ACTION_RECORDS);

  const records: SelectionActionRecord[] = [];
  const seen = new Set<string>();
  const add = (entity: WorldEntity, linkedTo?: string) => {
    if (seen.has(entity.id)) return;
    seen.add(entity.id);
    records.push({
      name: entity.name,
      content: buildWorldBibleEntityContent(entity),
      facts: factsFor(entity).map(factText),
      ...(linkedTo ? {linkedTo} : {})
    });
  };
  named.forEach((entity) => add(entity));
  if (params.includeLinkedRecords) {
    named.forEach((entity) =>
      findLinkedRecords({entity, facts: factsFor(entity), entities: params.entities, aliases: params.aliases})
        .forEach((record) => add(record, entity.name))
    );
  }
  return records;
}

export interface SelectionActionPromptInput {
  action: Pick<SelectionAction, 'name' | 'instructions' | 'output'>;
  selectedText: string;
  /** Plain scene text, when the action includes the scene. */
  scene?: {title: string; text: string} | null;
  /** Records the selection names, when the action includes the World Bible. */
  records?: SelectionActionRecord[] | null;
}

const REPLACE_RULES =
  'You rewrite one passage of a novel by following the author\'s instructions. Reply with the ' +
  'rewritten passage only: no title, no quotation marks around it, no notes or explanation. ' +
  'Separate paragraphs with a blank line. Anything besides the passage is for reference only; ' +
  'rewrite only the passage.';

const NOTE_RULES =
  'You help a novelist with one passage by following the author\'s instructions. Reply with a ' +
  'short note to the author. Nothing you write is put into the story. When you rely on a World ' +
  'Bible record or an accepted fact, name it.';

export function buildSelectionActionPrompt(input: SelectionActionPromptInput): {
  systemPrompt: string;
  messages: LLMMessage[];
  /** True when the scene was cut short to fit. */
  sceneTruncated: boolean;
} {
  const parts: string[] = [`Instructions (${input.action.name.trim()}):\n${input.action.instructions.trim()}`];
  if (input.records) {
    parts.push(
      input.records.length > 0
        ? 'World Bible records the passage names (accepted canon):\n\n' +
            input.records
              .map((record) =>
                [
                  `### ${record.name}${record.linkedTo ? ` (linked to ${record.linkedTo})` : ''}`,
                  record.content,
                  record.facts.length > 0 ? `Accepted facts:\n${record.facts.map((fact) => `- ${fact}`).join('\n')}` : null
                ]
                  .filter(Boolean)
                  .join('\n')
              )
              .join('\n\n')
        : 'World Bible records the passage names: none.'
    );
  }
  let sceneTruncated = false;
  if (input.scene) {
    const checked = canonCheckSceneText(input.scene.text);
    sceneTruncated = checked.truncated;
    parts.push(
      `The scene the passage is from, "${input.scene.title || 'Untitled scene'}" (for reference${
        checked.truncated ? '; cut short' : ''
      }):\n${checked.text}`
    );
  }
  parts.push(`The passage:\n<<<\n${input.selectedText.trim()}\n>>>`);
  return {
    systemPrompt: input.action.output === 'replace' ? REPLACE_RULES : NOTE_RULES,
    messages: [{role: 'user', content: parts.join('\n\n')}],
    sceneTruncated
  };
}

/** Removes wrappers models add around a rewrite (code fences, the passage markers, quotes). */
export function cleanReplaceResult(answer: string): string {
  let text = answer.trim();
  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fenced) text = fenced[1].trim();
  text = text.replace(/^<<<\s*\n?/, '').replace(/\n?\s*>>>$/, '').trim();
  const quoted = text.match(/^["“]([\s\S]*)["”]$/);
  if (quoted && !/["“”]/.test(quoted[1])) text = quoted[1].trim();
  return text.replace(/\n{3,}/g, '\n\n');
}
