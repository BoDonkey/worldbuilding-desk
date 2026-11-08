import {z} from 'zod';
import {getStateMutationKind, StateMutationCommandSchema} from './kinds';
import type {ManuscriptRuleset, StateMutationEvent} from './types';

export const StateMutationEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  sceneTitle: z.string().optional(),
  sceneOrder: z.number().int().optional(),
  sceneSequence: z.number().int().positive().optional(),
  scenePosition: z.number().int().nonnegative().optional(),
  sceneAnchor: z.object({before: z.string(), after: z.string()}).optional(),
  label: z.string().optional(),
  sourceType: z.enum(['manual', 'deterministic-review']).optional(),
  sourceRevision: z.number().int().nonnegative(),
  sourceHash: z.string().min(1),
  status: z.enum(['proposed', 'accepted', 'invalidated']),
  commands: z.array(StateMutationCommandSchema),
  consumableEffect: z.object({
    definitionId: z.string().min(1),
    itemName: z.string().min(1),
    durationLabel: z.string().optional(),
    phase: z.enum(['consume', 'expire']),
    sourceEventId: z.string().min(1).optional()
  }).optional(),
  createdAt: z.number().int().nonnegative(),
  invalidatedAt: z.number().int().nonnegative().optional(),
  invalidationReason: z.string().optional()
});

export type StateMutationCommandInput = z.input<typeof StateMutationCommandSchema>;

export function validateStateMutationEvent(event: StateMutationEvent): StateMutationEvent {
  return StateMutationEventSchema.parse(event);
}

export function validateStateMutationCommandIds(params: {
  command: z.infer<typeof StateMutationCommandSchema>;
  ruleset: ManuscriptRuleset | null;
}): string[] {
  const {command, ruleset} = params;
  if (!ruleset) {
    return [];
  }
  return getStateMutationKind(command.type).validateIds?.(command, ruleset) ?? [];
}

export function validateStateMutationCommandValueTypes(params: {
  command: z.infer<typeof StateMutationCommandSchema>;
  ruleset: ManuscriptRuleset | null;
}): string[] {
  const {command, ruleset} = params;
  if (!ruleset) {
    return [];
  }
  return getStateMutationKind(command.type).validateValueTypes?.(command, ruleset) ?? [];
}

export function validateStateMutationEventForRuleset(params: {
  event: StateMutationEvent;
  ruleset: ManuscriptRuleset | null;
}): string[] {
  const errors: string[] = [];
  for (const command of params.event.commands) {
    errors.push(...validateStateMutationCommandIds({
      command,
      ruleset: params.ruleset
    }));
    errors.push(...validateStateMutationCommandValueTypes({
      command,
      ruleset: params.ruleset
    }));
  }
  return errors;
}
