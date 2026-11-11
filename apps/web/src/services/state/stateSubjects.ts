import {
  buildDescriptiveReplaySheet,
  isDescriptiveStateCommand,
  type ReplaySheet
} from '@worldbuilding-desk/rules-engine';
import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity
} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {
  replayCharacterState,
  type CharacterReplayState,
  type ReplayableCharacterTarget
} from './stateReplay';

/**
 * A character whose manuscript state the app tracks (4.27). Characters with
 * a sheet carry every kind of change; World Bible characters without one
 * carry descriptive state only (location and items held).
 */
export interface StateSubject {
  /** World Bible character id; new commands for this subject use it. */
  actorId: string;
  name: string;
  sheet: CharacterSheet | null;
  /**
   * A sheet not yet linked to a World Bible character. Review can still show
   * its changes, but nothing records new ones for it until it is linked.
   */
  legacy: boolean;
}

/**
 * One subject per sheet, then one per World Bible character without a sheet.
 */
export function buildStateSubjects(params: {
  characterSheets: CharacterSheet[];
  characterEntities: Array<Pick<WorldEntity, 'id' | 'name'>>;
}): StateSubject[] {
  const sheeted = params.characterSheets.map((sheet): StateSubject => ({
    actorId: sheet.characterEntityId ?? sheet.characterId ?? sheet.id,
    name: sheet.name,
    sheet,
    legacy: !sheet.characterEntityId
  }));
  const sheetedIds = new Set(sheeted.map((subject) => subject.actorId));
  const sheetless = params.characterEntities
    .filter((entity) => !sheetedIds.has(entity.id))
    .map((entity): StateSubject => ({actorId: entity.id, name: entity.name, sheet: null, legacy: false}));
  return [...sheeted, ...sheetless];
}

/** Subjects that may receive new changes from prose or review. */
export const recordableStateSubjects = (subjects: StateSubject[]): StateSubject[] =>
  subjects.filter((subject) => !subject.legacy);

/** Every id an older command may use for this subject. */
export function stateSubjectIds(subject: StateSubject): string[] {
  return [subject.actorId, subject.sheet?.characterId, subject.sheet?.id]
    .filter((id): id is string => Boolean(id));
}

export function findStateSubject(
  actor: string | undefined,
  subjects: StateSubject[]
): StateSubject | null {
  if (!actor) return null;
  return subjects.find((subject) => stateSubjectIds(subject).includes(actor)) ?? null;
}

export function stateSubjectReplaySheet(subject: StateSubject): ReplaySheet {
  return subject.sheet ??
    buildDescriptiveReplaySheet({entityId: subject.actorId, name: subject.name});
}

export function stateSubjectReplayTarget(subject: StateSubject): ReplayableCharacterTarget {
  return {
    actorId: subject.actorId,
    characterId: subject.sheet?.characterId,
    sheetId: subject.sheet?.id,
    actorName: subject.name
  };
}

/** Characters without a sheet take location and item changes only. */
export function stateSubjectAccepts(
  subject: StateSubject,
  command: Pick<StateMutationCommand, 'type'>
): boolean {
  return subject.sheet !== null || isDescriptiveStateCommand(command);
}

/**
 * Replays a subject's state. A character without a sheet ignores the
 * ruleset, so it never picks up default stats or resources.
 */
export function replayStateSubject(params: {
  subject: StateSubject;
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  actorResolutions?: ActorResolution[];
  upToSceneOrder?: number;
  upToScenePosition?: number;
}): CharacterReplayState {
  return replayCharacterState({
    sheet: stateSubjectReplaySheet(params.subject),
    ruleset: params.subject.sheet ? params.ruleset : null,
    events: params.events,
    target: stateSubjectReplayTarget(params.subject),
    actorResolutions: params.actorResolutions,
    upToSceneOrder: params.upToSceneOrder,
    upToScenePosition: params.upToScenePosition
  });
}

/** Every id a command may use, including resolved legacy ids, mapped to its subject. */
export function buildStateSubjectLookup(
  subjects: StateSubject[],
  actorResolutions?: ActorResolution[]
): Map<string, StateSubject> {
  const lookup = new Map<string, StateSubject>();
  subjects.forEach((subject) => {
    stateSubjectIds(subject).forEach((id) => lookup.set(id, subject));
  });
  actorResolutions?.forEach((resolution) => {
    const subject = lookup.get(resolution.entityId);
    if (subject) lookup.set(resolution.legacyActorId, subject);
  });
  return lookup;
}

/**
 * Replay inputs for previewing a command recorded under `actorId`, which may
 * be a legacy id for this subject.
 */
export function stateSubjectPreviewInputs(
  subject: StateSubject,
  ruleset: StoredRuleset | null,
  actorId: string
): {sheet: ReplaySheet; ruleset: StoredRuleset | null; target: ReplayableCharacterTarget} {
  return {
    sheet: stateSubjectReplaySheet(subject),
    ruleset: subject.sheet ? ruleset : null,
    target: {...stateSubjectReplayTarget(subject), actorId}
  };
}
