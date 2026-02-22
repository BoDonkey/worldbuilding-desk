import { z } from 'zod';
import { StatValue } from './Common';

/**
 * Runtime state for a character/entity
 */

export const InventoryItemSchema = z.object({
  id: z.string(),
  itemId: z.string(), // Reference to item template
  name: z.string(),
  quantity: z.number().default(1),
  
  // Item-specific state
  durability: z.number().optional(),
  maxDurability: z.number().optional(),
  charges: z.number().optional(),
  quality: z.number().optional(),
  purity: z.number().optional(),

  // Durability and legacy progression
  usageCount: z.number().default(0),
  breakCount: z.number().default(0),
  legacyTier: z.number().default(0),
  legacyName: z.string().optional(),
  yieldBonusPercent: z.number().default(0),
  
  // Custom properties
  properties: z.record(z.unknown()).optional(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const ActiveStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceRuleId: z.string(), // Which rule applied this
  appliedAt: z.number(), // Timestamp
  expiresAt: z.number().optional(), // Timestamp when it expires
  
  // Status-specific data (e.g., buff strength, debuff type)
  data: z.record(z.unknown()).optional(),
});
export type ActiveStatus = z.infer<typeof ActiveStatusSchema>;

export const ModifierSchema = z.object({
  id: z.string(),
  stat: z.string(), // Which stat this modifies
  operation: z.enum(['add', 'multiply', 'set']),
  value: z.number(),
  sourceRuleId: z.string(),
  priority: z.number().default(100),
});
export type Modifier = z.infer<typeof ModifierSchema>;

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

export const CharacterStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  rulesetId: z.string(), // Which ruleset this character uses
  
  // Core stats (flexible - defined by ruleset)
  stats: z.record(z.union([z.number(), z.string(), z.boolean()])),
  
  // Resources (health, mana, etc.)
  resources: z.object({
    current: z.record(z.number()),
    max: z.record(z.number()),
  }),
  
  // Inventory system
  inventory: z.object({
    items: z.array(InventoryItemSchema),
    capacity: z.number().default(100),
    essences: z.record(z.number()).optional(), // For crafting
  }),
  
  // Equipment (flexible slots)
  equipment: z.record(InventoryItemSchema.nullable()),
  
  // Active effects and statuses
  statuses: z.array(ActiveStatusSchema).default([]),
  
  // Active modifiers to stats
  modifiers: z.array(ModifierSchema).default([]),
  
  // Time tracking
  timers: z.object({
    lastUpdate: z.number(),
    activeEffects: z.record(EffectTimerSchema),
  }),

  // Environmental exposure tracking (used for ailments like cave lung)
  environment: z.object({
    exposures: z.record(ExposureTrackerSchema).default({})
  }).default({exposures: {}}),
  
  // Custom fields (user-defined data)
  custom: z.record(z.unknown()).optional(),
  
  // Metadata
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

// Helper to create empty character state
export function createEmptyCharacterState(
  name: string,
  rulesetId: string,
  stats: Record<string, StatValue>,
  resources: { current: Record<string, number>; max: Record<string, number> }
): CharacterState {
  const now = Date.now();
  
  return {
    id: crypto.randomUUID(),
    name,
    rulesetId,
    stats,
    resources,
    inventory: {
      items: [],
      capacity: 100,
    },
    equipment: {},
    statuses: [],
    modifiers: [],
    timers: {
      lastUpdate: now,
      activeEffects: {},
    },
    environment: {
      exposures: {}
    },
    createdAt: now,
    updatedAt: now,
  };
}

// Helper to calculate effective stat value (base + modifiers)
export function calculateEffectiveStat(
  state: CharacterState,
  statName: string
): number {
  const baseStat = state.stats[statName];
  if (typeof baseStat !== 'number') return 0;
  
  const relevantModifiers = state.modifiers
    .filter(m => m.stat === statName)
    .sort((a, b) => b.priority - a.priority); // Higher priority first
  
  let result = baseStat;
  
  for (const modifier of relevantModifiers) {
    switch (modifier.operation) {
      case 'add':
        result += modifier.value;
        break;
      case 'multiply':
        result *= modifier.value;
        break;
      case 'set':
        result = modifier.value;
        break;
    }
  }
  
  return result;
}
