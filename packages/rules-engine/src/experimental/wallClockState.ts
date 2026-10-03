import {z} from 'zod';
import type {StatValue} from '../types/Common';
import {CharacterStateSchema, createEmptyCharacterState} from '../types/CharacterState';

/**
 * Wall-clock character state used only by the experimental StateManager.
 *
 * The product orders state by manuscript position, not elapsed seconds, so
 * timers, regeneration intervals, and exposure durations are kept here as
 * reference until they are rebuilt on manuscript time. Nothing in the app may
 * import this path (rules-engine plan, Decision 3).
 */

export const EffectTimerSchema = z.object({
  ruleId: z.string(),
  startedAt: z.number(),
  duration: z.number(), // Seconds
  remainingTime: z.number(), // Seconds
  isPaused: z.boolean().default(false),
});
export type EffectTimer = z.infer<typeof EffectTimerSchema>;

export const ExposureTrackerSchema = z.object({
  seconds: z.number().default(0),
  lastUpdated: z.number(),
  lastAppliedAt: z.number().optional()
});
export type ExposureTracker = z.infer<typeof ExposureTrackerSchema>;

export const ExperimentalCharacterStateSchema = CharacterStateSchema.extend({
  timers: z.object({
    lastUpdate: z.number(),
    activeEffects: z.record(EffectTimerSchema),
  }),
  // Environmental exposure tracking (used for ailments like cave lung)
  environment: z.object({
    exposures: z.record(ExposureTrackerSchema).default({})
  }).default({exposures: {}}),
});
export type ExperimentalCharacterState = z.infer<typeof ExperimentalCharacterStateSchema>;

export function createEmptyExperimentalCharacterState(
  name: string,
  rulesetId: string,
  stats: Record<string, StatValue>,
  resources: {current: Record<string, number>; max: Record<string, number>}
): ExperimentalCharacterState {
  const base = createEmptyCharacterState(name, rulesetId, stats, resources);
  return {
    ...base,
    timers: {lastUpdate: base.createdAt, activeEffects: {}},
    environment: {exposures: {}}
  };
}
