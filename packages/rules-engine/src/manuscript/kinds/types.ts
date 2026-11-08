import type {
  CharacterReplayState,
  ManuscriptRuleset,
  StateMutationCommand
} from '../types';

export type StateMutationCommandType = StateMutationCommand['type'];

/**
 * The command shape for one `type`. A family such as status shares one shape
 * across several types, so a plain `Extract` on the type would miss it.
 */
export type StateMutationCommandOf<T extends StateMutationCommandType> =
  StateMutationCommand extends infer C
    ? C extends {type: infer U}
      ? T extends U
        ? C
        : never
      : never
    : never;

export interface StateMutationLabelMaps {
  resourceDefinitionNameById?: Map<string, string>;
  statDefinitionNameById?: Map<string, string>;
}

/**
 * Everything the engine knows about one kind of state change. Kind modules
 * build and describe commands; they never decide whether a command is
 * proposed or applied, and never read scene fields.
 */
export interface EngineStateKind<C extends StateMutationCommand> {
  /** Replay step. Changes `next`, a fresh copy replay made for this command. */
  apply(next: CharacterReplayState, command: C): void;
  /** Problems that applying the command to `state` would cause. */
  validateAgainstState?(state: CharacterReplayState, command: C): string[];
  /** Unknown ruleset definition ids the command refers to. */
  validateIds?(command: C, ruleset: ManuscriptRuleset): string[];
  /** Values whose type does not match the ruleset definition. */
  validateValueTypes?(command: C, ruleset: ManuscriptRuleset): string[];
  /** One-line description, such as "Health +5". */
  label(command: C, labels?: StateMutationLabelMaps): string;
  /** Before → after lines for a preview. */
  summarizeEffects(params: {
    before: CharacterReplayState;
    after: CharacterReplayState;
    command: C;
    labels?: StateMutationLabelMaps;
  }): string[];
}

export type EngineStateKindRegistry = {
  [T in StateMutationCommandType]: EngineStateKind<StateMutationCommandOf<T>>;
};

/** Result of turning a rules-engine `Effect` into a ledger command. */
export type EffectTranslation =
  | {ok: true; command: StateMutationCommand}
  | {ok: false; reason: string};
