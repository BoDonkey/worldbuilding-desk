import { z } from 'zod';
import { EffectOperationSchema, FieldPath, Formula } from './Common';

/**
 * Effects define what happens when a rule fires
 */

export const EffectSchema = z.object({
  target: z.string(), // Field path: "character.health"
  operation: EffectOperationSchema,
  value: z.union([
    z.string(),  // Could be a formula
    z.number(),
    z.boolean(),
    z.record(z.any()), // For complex objects
  ]),
  
  // Optional constraints
  min: z.number().optional(),
  max: z.number().optional(),
  
  // Description for debugging/logging
  description: z.string().optional(),
  
  // Reference to another rule to trigger
  triggersRule: z.string().optional(),
});
export type Effect = z.infer<typeof EffectSchema>;

// Helper to create effects
export function createEffect(
  target: FieldPath,
  operation: z.infer<typeof EffectOperationSchema>,
  value: any
): Effect {
  return { target, operation, value };
}

export function createFormulaEffect(
  target: FieldPath,
  formula: Formula,
  options?: { min?: number; max?: number; description?: string }
): Effect {
  return {
    target,
    operation: 'set',
    value: formula,
    ...options,
  };
}