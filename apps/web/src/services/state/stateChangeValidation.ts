import type {StateMutationEvent, StoredRuleset} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {validateStateMutationEvent} from './stateMutationSchemas';
import {
  applyStateMutationCommand,
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset,
  type CharacterReplayState
} from './stateReplay';
import {
  buildStateSubjectLookup,
  stateSubjectPreviewInputs,
  type StateSubject
} from './stateSubjects';

/**
 * The checks every state change passes before it is saved (slice 3.40):
 * its shape, its ids and values against the ruleset, and each command
 * against the character's replayed state at that point in the story.
 */

/**
 * The character's state just before the change: one state when every command
 * is for the same character, or a lookup by the command's actor id that
 * returns null when that character cannot be found.
 */
export type StateBeforeChange =
  | CharacterReplayState
  | ((actorId: string) => CharacterReplayState | null);

export const MISSING_SUBJECT_ISSUE =
  'The character for this change is no longer in the project.';

/**
 * Ruleset and state problems, for an event whose shape is already valid.
 * Commands are checked in order, each against the state the earlier ones
 * leave. Without `before`, only the ruleset is checked.
 */
export function findStateChangeIssues(params: {
  event: StateMutationEvent;
  ruleset: StoredRuleset | null;
  before?: StateBeforeChange;
}): string[] {
  const {event, before} = params;
  const rulesetIssues = validateStateMutationEventForRuleset({event, ruleset: params.ruleset});
  if (rulesetIssues.length > 0 || before === undefined) return rulesetIssues;

  const issues = new Set<string>();
  const current = new Map<CharacterReplayState, CharacterReplayState>();
  event.commands.forEach((command) => {
    const start = typeof before === 'function' ? before(command.actorId) : before;
    if (!start) {
      issues.add(MISSING_SUBJECT_ISSUE);
      return;
    }
    const state = current.get(start) ?? start;
    validateStateMutationCommandAgainstState({state, command})
      .forEach((issue) => issues.add(issue));
    current.set(start, applyStateMutationCommand(state, command));
  });
  return [...issues];
}

/** Throws when the change fails its shape, ruleset, or state checks. */
export function assertStateChangeValid(params: {
  event: StateMutationEvent;
  ruleset: StoredRuleset | null;
  before?: StateBeforeChange;
}): void {
  validateStateMutationEvent(params.event);
  const issues = findStateChangeIssues(params);
  if (issues.length > 0) throw new Error(issues.join(' '));
}

/**
 * Checks a suggested change against the story as it stands now. `events` is
 * the project's ledger; only its accepted changes count. Review uses the
 * result to say whether a suggestion can be accepted, and accepting runs the
 * same check again on freshly loaded data.
 */
export function findStateChangeAcceptanceIssues(params: {
  event: StateMutationEvent;
  events: StateMutationEvent[];
  stateSubjects: StateSubject[];
  actorResolutions?: ActorResolution[];
  ruleset: StoredRuleset | null;
}): string[] {
  const {event} = params;
  try {
    validateStateMutationEvent(event);
  } catch {
    return ['This change is not in a form that can be saved.'];
  }
  if (event.commands.length === 0) return ['This change has nothing to apply.'];
  const subjectByActorId = buildStateSubjectLookup(params.stateSubjects, params.actorResolutions);
  const acceptedEvents = params.events.filter(
    (entry) => entry.status === 'accepted' && entry.id !== event.id
  );
  const beforeBySubject = new Map<StateSubject, CharacterReplayState>();
  return findStateChangeIssues({
    event,
    ruleset: params.ruleset,
    before: (actorId) => {
      const subject = subjectByActorId.get(actorId);
      if (!subject) return null;
      let before = beforeBySubject.get(subject);
      if (!before) {
        before = replayCharacterState({
          ...stateSubjectPreviewInputs(subject, params.ruleset, actorId),
          events: acceptedEvents,
          actorResolutions: params.actorResolutions,
          upToSceneOrder: event.sceneOrder ?? Number.MAX_SAFE_INTEGER
        });
        beforeBySubject.set(subject, before);
      }
      return before;
    }
  });
}
