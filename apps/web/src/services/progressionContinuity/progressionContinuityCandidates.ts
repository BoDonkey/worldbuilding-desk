import type {
  CanonicalFact,
  Character,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {ADVANCEMENT_NAME} from '../dashboard/storyDashboard';
import {isCanonicalFactValidAtScene} from '../lore/canonicalFactValidity';

/**
 * Two overlapping craft-and-canon-consistency observations (research:
 * docs/research-litrpg-craft-failures.md §B2, P11/P12). Both are
 * deterministic *shortlists* only: absence of an explicit or lexical
 * reference is computable, but whether an ability would plainly resolve a
 * scene's situation, or whether a method was narratively abandoned without
 * reason, requires interpretation — that judgment is left to the
 * author-triggered model consultation, never decided here.
 */
export type ProgressionContinuityCandidateKind = 'unused_solution' | 'abandoned_progression_method';

export interface ProgressionContinuityCandidate {
  /** Stable across recomputation so a dismissed candidate stays dismissed. */
  key: string;
  kind: ProgressionContinuityCandidateKind;
  subjectLabel: string;
  detailText: string;
  sourceSceneIds: string[];
}

/**
 * The abilities the research names as needing the most care: movement,
 * teleportation, and anything time-related. Restricting the shortlist to
 * these keeps it small and high-value rather than flagging every ability
 * fact, most of which are never "plainly resolves this scene" candidates.
 *
 * Each stem is followed by `\w*` so a fact phrased as "Teleportation" and
 * prose phrased as "she teleported" both match the same root — the same
 * pattern is used to both qualify the fact and search scene text for it.
 */
const PRIORITY_ABILITY_STEMS = [
  'teleport', 'blink', 'flight', 'flying', 'fly', 'super\\s?speed', 'haste', 'dash',
  'time\\s?stop', 'time\\s?loop', 'time\\s?rewind', 'time\\s?travel', 'chronal',
  'temporal', 'precognition', 'clairvoyance'
];

/** Which single stem (if any) qualifies this ability text as a priority ability. */
function matchPriorityAbilityStem(text: string): RegExp | null {
  for (const stem of PRIORITY_ABILITY_STEMS) {
    const pattern = new RegExp(`\\b${stem}\\w*`, 'i');
    if (pattern.test(text)) return pattern;
  }
  return null;
}

const MIN_APPEARANCE_SCENES = 3;
const MIN_TRAILING_SCENES = 2;
const MAX_CITED_SCENES = 6;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTermPattern(terms: string[]): RegExp | null {
  const cleaned = terms.map((term) => term.trim()).filter((term) => term.length > 1);
  if (cleaned.length === 0) return null;
  return new RegExp(`\\b(${cleaned.map(escapeRegExp).join('|')})\\b`, 'i');
}

function factValueText(value: CanonicalFact['value']): string {
  return typeof value === 'string' ? value : `${value.label} ${value.value}`;
}

/**
 * A character with an established priority ability who appears in several
 * scenes (enough for the omission to be meaningful) with zero lexical
 * mention of that ability anywhere in those scenes.
 */
export function buildUnusedSolutionCandidates(params: {
  canonicalFacts: CanonicalFact[];
  characters: Character[];
  characterAliasesById: Map<string, string[]>;
  documents: WritingDocument[];
}): ProgressionContinuityCandidate[] {
  const {canonicalFacts, characters, characterAliasesById, documents} = params;
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const candidates: ProgressionContinuityCandidate[] = [];

  const candidateFacts = canonicalFacts.flatMap((fact) => {
    if (fact.factType !== 'ability' || fact.targetType !== 'character') return [];
    const stemPattern = matchPriorityAbilityStem(factValueText(fact.value));
    return stemPattern ? [{fact, stemPattern}] : [];
  });

  for (const {fact, stemPattern} of candidateFacts) {
    const character = charactersById.get(fact.targetId);
    if (!character) continue;

    const namePattern = buildTermPattern([character.name, ...(characterAliasesById.get(character.id) ?? [])]);
    if (!namePattern) continue;

    const appearanceScenes = documents.filter((document) =>
      isCanonicalFactValidAtScene(fact, document.id, documents) &&
      namePattern.test(document.content)
    );
    if (appearanceScenes.length < MIN_APPEARANCE_SCENES) continue;

    const abilityText = factValueText(fact.value);
    const abilityMentioned = appearanceScenes.some((document) => stemPattern.test(document.content));
    if (abilityMentioned) continue;

    candidates.push({
      key: `unused_solution:${fact.targetId}:${fact.id}`,
      kind: 'unused_solution',
      subjectLabel: character.name,
      detailText: abilityText,
      sourceSceneIds: appearanceScenes.slice(0, MAX_CITED_SCENES).map((document) => document.id)
    });
  }

  return candidates;
}

function commandTargetsAdvancementAxis(
  command: StateMutationCommand,
  resourceNameById: Map<string, string>,
  statNameById: Map<string, string>
): boolean {
  if (command.type === 'resource_change' || command.type === 'resource_set') {
    return ADVANCEMENT_NAME.test(resourceNameById.get(command.resourceDefinitionId) ?? command.resourceDefinitionId);
  }
  if (command.type === 'stat_change' || command.type === 'stat_set') {
    return ADVANCEMENT_NAME.test(statNameById.get(command.statDefinitionId) ?? command.statDefinitionId);
  }
  return false;
}

/**
 * A named, rapid-advancement method (from an accepted event's own
 * author-written label) whose only mention anywhere in the manuscript is
 * the scene that established it, with room afterward for it to have
 * recurred. This depends on advancement events carrying a descriptive
 * label — a real coverage limit, not a guess about the author's intent.
 */
export function buildAbandonedProgressionMethodCandidates(params: {
  acceptedStateMutationEvents: StateMutationEvent[];
  documents: WritingDocument[];
  ruleset: StoredRuleset | null;
}): ProgressionContinuityCandidate[] {
  const {acceptedStateMutationEvents, documents, ruleset} = params;
  if (documents.length === 0 || !ruleset) return [];

  const resourceNameById = new Map(ruleset.resourceDefinitions.map((definition) => [definition.id, definition.name]));
  const statNameById = new Map(ruleset.statDefinitions.map((definition) => [definition.id, definition.name]));
  const documentIndexById = new Map(documents.map((document, index) => [document.id, index]));

  const eventsByLabel = new Map<string, Array<{event: StateMutationEvent; sceneIndex: number}>>();
  for (const event of acceptedStateMutationEvents) {
    const label = event.label?.trim();
    if (!label || label.length < 4) continue;
    if (!event.commands.some((command) => commandTargetsAdvancementAxis(command, resourceNameById, statNameById))) {
      continue;
    }
    const sceneIndex = documentIndexById.get(event.sceneId);
    if (sceneIndex === undefined) continue;
    const key = label.toLowerCase();
    const list = eventsByLabel.get(key) ?? [];
    list.push({event, sceneIndex});
    eventsByLabel.set(key, list);
  }

  const candidates: ProgressionContinuityCandidate[] = [];
  for (const events of eventsByLabel.values()) {
    events.sort((left, right) => left.sceneIndex - right.sceneIndex);
    const first = events[0]!;
    const label = first.event.label!.trim();
    const trailingScenes = documents.slice(first.sceneIndex + 1);
    if (trailingScenes.length < MIN_TRAILING_SCENES) continue;

    const labelPattern = buildTermPattern([label]);
    if (!labelPattern) continue;
    const mentionedAgain = trailingScenes.some((document) => labelPattern.test(document.content));
    if (mentionedAgain) continue;

    candidates.push({
      key: `abandoned_progression_method:${label.toLowerCase()}`,
      kind: 'abandoned_progression_method',
      subjectLabel: label,
      detailText: label,
      sourceSceneIds: [first.event.sceneId]
    });
  }

  return candidates;
}
