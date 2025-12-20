import { z } from 'zod';
import { OperatorSchema, FieldPath } from './Common';

/**
 * Conditions determine when a rule should fire
 */

export const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_or_equal',
    'less_or_equal',
    'contains',
    'not_contains',
    'in',
    'not_in'
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any())])
});
export type Condition = z.infer<typeof ConditionSchema>;

export type ConditionGroup = {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: Array<Condition | ConditionGroup>;
};

// Condition groups for complex logic
export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.object({
  operator: z.enum(['AND', 'OR', 'NOT']),
  conditions: z.array(z.lazy(() => z.union([ConditionSchema, ConditionGroupSchema])))
});

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
  const operatorMap = {
    all: 'AND' as const,
    any: 'OR' as const,
    none: 'NOT' as const,
  };
  return { operator: operatorMap[operator], conditions };
}