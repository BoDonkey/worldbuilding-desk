import { z } from 'zod';
import { TriggerTypeSchema, RuleCategorySchema, Formula } from './Common';
import { ConditionSchema, ConditionGroupSchema } from './Condition';
import { EffectSchema } from './Effect';

/**
 * Complete rule definition
 */

export const TriggerDefinitionSchema = z.object({
  type: TriggerTypeSchema,
  
  // Trigger-specific parameters
  interval: z.number().optional(), // For time_elapsed
  itemId: z.string().optional(), // For on_consume_item, on_equip_item
  abilityName: z.string().optional(), // For on_cast_spell
  statusName: z.string().optional(), // For status_active
  damageType: z.string().optional(), // For on_damage_calculation
  actionName: z.string().optional(), // For on_action
  
  // Custom trigger data
  data: z.record(z.unknown()).optional(),
});
export type TriggerDefinition = z.infer<typeof TriggerDefinitionSchema>;

export const DurationDefinitionSchema = z.object({
  type: z.enum(['timed', 'calculated', 'permanent', 'until_condition']),
  
  // For 'timed'
  seconds: z.number().optional(),
  
  // For 'calculated'
  formula: z.string().optional(),
  
  // For 'until_condition'
  endCondition: z.lazy(() => z.union([ConditionSchema, ConditionGroupSchema])).optional(),
});
export type DurationDefinition = z.infer<typeof DurationDefinitionSchema>;

export const GameRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: RuleCategorySchema,
  enabled: z.boolean().default(true),
  priority: z.number().default(100), // Higher = runs first
  tags: z.array(z.string()).default([]),
  
  // How the rule is triggered
  trigger: TriggerDefinitionSchema.optional(),
  
  // When the rule should apply (can be simple array or complex group)
  conditions: z.union([
    z.array(ConditionSchema),
    ConditionGroupSchema,
  ]).optional(),
  
  // What the rule does
  effects: z.array(EffectSchema).default([]),
  
  // Optional formula for complex calculations
  formula: z.string().optional(),
  
  // Duration for time-based effects
  duration: DurationDefinitionSchema.optional(),
  
  // Rule dependencies
  dependencies: z.object({
    applies_after: z.array(z.string()).optional(), // Rule IDs that must run first
    requires_active: z.array(z.string()).optional(), // Rules that must be active
    conflicts_with: z.array(z.string()).optional(), // Rules that can't be active simultaneously
  }).optional(),
  
  // Metadata
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  author: z.string().optional(),
  
  // Custom user data
  custom: z.record(z.unknown()).optional(),
});
export type GameRule = z.infer<typeof GameRuleSchema>;

// Helper to create a basic rule
export function createRule(
  name: string,
  category: z.infer<typeof RuleCategorySchema>,
  effects: z.infer<typeof EffectSchema>[]
): GameRule {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    enabled: true,
    priority: 100,
    tags: [],
    effects,
  };
}

// Helper to create a conditional rule
export function createConditionalRule(
  name: string,
  category: z.infer<typeof RuleCategorySchema>,
  conditions: z.infer<typeof ConditionSchema>[],
  effects: z.infer<typeof EffectSchema>[]
): GameRule {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    enabled: true,
    priority: 100,
    tags: [],
    conditions,
    effects,
  };
}