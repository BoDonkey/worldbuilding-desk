import {z} from 'zod';
import type {LevelThreshold} from '../../types/WorldRuleset';
import type {CharacterProgressionState, StateMutationActorId} from '../types';
import type {EngineStateKindRegistry} from './types';

export type XpGainStateMutationCommand = {
  type: 'xp_gain';
  actorId: StateMutationActorId;
  /** XP earned in the scene. A negative amount corrects an earlier gain. */
  amount: number;
  reason?: string;
};

export const XpGainStateMutationCommandSchema = z.object({
  type: z.literal('xp_gain'),
  actorId: z.string().min(1),
  amount: z.number(),
  reason: z.string().min(1).optional()
});

export const progressionCommandSchemas = [XpGainStateMutationCommandSchema] as const;

/**
 * The usable rows of a level table, lowest XP first. Rulesets can arrive by
 * import without schema checks, so rows that are not whole levels of 2 or
 * more with a finite, non-negative XP amount are skipped.
 */
export function normalizeLevelTable(table: readonly unknown[] | undefined): LevelThreshold[] {
  if (!Array.isArray(table)) return [];
  return table
    .filter((row): row is LevelThreshold => {
      if (!row || typeof row !== 'object') return false;
      const {level, experience} = row as Partial<LevelThreshold>;
      return (
        Number.isInteger(level) &&
        (level as number) >= 2 &&
        typeof experience === 'number' &&
        Number.isFinite(experience) &&
        experience >= 0
      );
    })
    .map((row) => ({level: row.level, experience: row.experience}))
    .sort((a, b) => a.experience - b.experience || a.level - b.level);
}

/**
 * The level for a character's progression. Without a table, the level is the
 * starting level the author set. With one, it is the highest level whose XP
 * the character has reached, but never below the starting level.
 */
export function deriveLevel(progression: Omit<CharacterProgressionState, 'level'>): number {
  let level = progression.startingLevel;
  for (const row of progression.levelTable) {
    if (row.experience > progression.experience) break;
    level = Math.max(level, row.level);
  }
  return level;
}

const formatAmount = (amount: number): string => `${amount >= 0 ? '+' : ''}${amount}`;

export const progressionKinds = {
  xp_gain: {
    apply(next, command) {
      const experience = next.progression.experience + command.amount;
      next.progression = {
        ...next.progression,
        experience,
        level: deriveLevel({...next.progression, experience})
      };
    },
    validateAgainstState(state, command) {
      const nextValue = state.progression.experience + command.amount;
      return nextValue < 0
        ? [`Experience would drop below zero (${state.progression.experience} ${formatAmount(command.amount)}).`]
        : [];
    },
    label: (command) =>
      `${formatAmount(command.amount)} XP${command.reason ? ` (${command.reason})` : ''}`,
    summarizeEffects: ({before, after}) => [
      `Experience: ${before.progression.experience} -> ${after.progression.experience}`,
      ...(before.progression.level !== after.progression.level
        ? [`Level: ${before.progression.level} -> ${after.progression.level}`]
        : [])
    ]
  }
} satisfies Pick<EngineStateKindRegistry, 'xp_gain'>;
