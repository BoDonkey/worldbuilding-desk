import { z } from 'zod';

/**
 * Common types used across the rules engine
 */

// Value types that can be stored in stats/resources
export type StatValue = number | string | boolean;

// Operators for conditions
export const OperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'contains',
  'not_contains',
  'in',
  'not_in',
]);
export type Operator = z.infer<typeof OperatorSchema>;

// Operations for effects
export const EffectOperationSchema = z.enum([
  'set',
  'add',
  'subtract',
  'multiply',
  'divide',
  'append',
  'remove',
]);
export type EffectOperation = z.infer<typeof EffectOperationSchema>;

// Trigger types
export const TriggerTypeSchema = z.enum([
  'on_action',           // When specific action occurs
  'on_consume_item',     // When item is consumed
  'on_equip_item',       // When item is equipped
  'on_damage_calculation', // During damage calculation
  'on_cast_spell',       // When casting spell
  'time_elapsed',        // After time passes
  'status_active',       // While status is active
  'passive',             // Always active
  'manual',              // Manually triggered
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

// Rule categories
export const RuleCategorySchema = z.enum([
  'combat',
  'magic',
  'crafting',
  'time',
  'passive',
  'custom',
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

// Field paths for accessing nested properties
export type FieldPath = string; // e.g., "character.stats.STR" or "item.durability"

// Formula string for calculations
export type Formula = string; // e.g., "baseCost * (1 - (INT * 0.05))"