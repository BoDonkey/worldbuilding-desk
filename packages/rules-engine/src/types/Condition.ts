import { z } from 'zod';
import { OperatorSchema, FieldPath } from './Common';

/**
 * Conditions determine when a rule should fire
 */

export const ConditionSchema = z.object({
  field: z.string(), // Field path: "character.stats.STR"
  operator: OperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]),
  
  // Optional modifiers
  negate: z.boolean().optional(), // Invert the condition
});
export type Condition = z.infer<typeof ConditionSchema>;

// Condition groups for complex logic
export const ConditionGroupSchema = z.object({
  operator: z.enum(['all', 'any', 'none']), // AND, OR, NOR
  conditions: z.array(z.lazy(() => z.union([ConditionSchema, ConditionGroupSchema]))),
});
export type ConditionGroup = z.infer<typeof ConditionGroupSchema>;

// Helper functions
export function createCondition(
  field: FieldPath,
  operator: z.infer<typeof OperatorSchema>,
  value: any
): Condition {
  return { field, operator, value };
}

export function createConditionGroup(
  operator: 'all' | 'any' | 'none',
  conditions: (Condition | ConditionGroup)[]
): ConditionGroup {
  return { operator, conditions };
}