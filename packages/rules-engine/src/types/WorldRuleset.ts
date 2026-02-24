import {z} from 'zod';

/**
 * Defines the overall world/game system
 */

export const StatDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['number', 'boolean', 'text']),
  defaultValue: z.union([z.number(), z.boolean(), z.string()]),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
  category: z.string().optional() // For grouping in UI
});
export type StatDefinition = z.infer<typeof StatDefinitionSchema>;

export const ResourceDefinitionSchema = StatDefinitionSchema.extend({
  regeneration: z
    .object({
      enabled: z.boolean(),
      rate: z.number(), // Amount per interval
      interval: z.number() // Seconds
    })
    .optional()
});
export type ResourceDefinition = z.infer<typeof ResourceDefinitionSchema>;

export const CompendiumDomainSchema = z.enum([
  'beast',
  'flora',
  'mineral',
  'artifact',
  'recipe',
  'custom'
]);
export type CompendiumDomain = z.infer<typeof CompendiumDomainSchema>;

export const CompendiumActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  points: z.number(),
  repeatable: z.boolean().optional()
});
export type CompendiumAction = z.infer<typeof CompendiumActionSchema>;

export const CompendiumRewardEffectSchema = z.object({
  targetType: z.enum(['stat', 'resource', 'custom']),
  targetId: z.string(),
  operation: z.enum(['add', 'multiply', 'set']),
  value: z.union([z.number(), z.boolean(), z.string()])
});
export type CompendiumRewardEffect = z.infer<typeof CompendiumRewardEffectSchema>;

export const CompendiumMilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pointsRequired: z.number(),
  unlockRecipeIds: z.array(z.string()).default([]),
  permanentEffects: z.array(CompendiumRewardEffectSchema).default([])
});
export type CompendiumMilestone = z.infer<typeof CompendiumMilestoneSchema>;

export const CompendiumConfigSchema = z.object({
  enabled: z.boolean().default(false),
  entryDomains: z.array(CompendiumDomainSchema).default([]),
  milestones: z.array(CompendiumMilestoneSchema).default([])
});
export type CompendiumConfig = z.infer<typeof CompendiumConfigSchema>;

export const WorldRulesetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),

  // User-defined systems
  statDefinitions: z.array(StatDefinitionSchema).default([]),
  resourceDefinitions: z.array(ResourceDefinitionSchema).default([]),

  // Rules will be imported from GameRule.ts
  rules: z.array(z.any()).default([]), // Will type properly after GameRule is defined

  // Templates for common patterns
  itemTemplates: z.array(z.any()).default([]),
  statusTemplates: z.array(z.any()).default([]),
  compendium: CompendiumConfigSchema.optional(),

  // Metadata
  createdAt: z.number(),
  updatedAt: z.number(),

  // Custom user-defined data
  custom: z.record(z.unknown()).optional()
});
export type WorldRuleset = z.infer<typeof WorldRulesetSchema>;

// Helper to create empty ruleset
export function createEmptyRuleset(name: string): WorldRuleset {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    version: '1.0.0',
    statDefinitions: [],
    resourceDefinitions: [],
    rules: [],
    itemTemplates: [],
    statusTemplates: [],
    compendium: {
      enabled: false,
      entryDomains: [],
      milestones: []
    },
    createdAt: now,
    updatedAt: now
  };
}

// Template presets
export const STAT_SYSTEM_PRESETS = {
  dnd: [
    {
      id: 'STR',
      name: 'Strength',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    },
    {
      id: 'DEX',
      name: 'Dexterity',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    },
    {
      id: 'CON',
      name: 'Constitution',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    },
    {
      id: 'INT',
      name: 'Intelligence',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    },
    {
      id: 'WIS',
      name: 'Wisdom',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    },
    {
      id: 'CHA',
      name: 'Charisma',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 20
    }
  ] as StatDefinition[],

  litrpg: [
    {id: 'STR', name: 'STR', type: 'number', defaultValue: 10, min: 1},
    {id: 'AGI', name: 'AGI', type: 'number', defaultValue: 10, min: 1},
    {id: 'VIT', name: 'VIT', type: 'number', defaultValue: 10, min: 1},
    {id: 'INT', name: 'INT', type: 'number', defaultValue: 10, min: 1},
    {id: 'WIS', name: 'WIS', type: 'number', defaultValue: 10, min: 1},
    {id: 'LUK', name: 'LUK', type: 'number', defaultValue: 10, min: 1}
  ] as StatDefinition[],

  simple: [
    {
      id: 'strength',
      name: 'Strength',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 10
    },
    {
      id: 'agility',
      name: 'Agility',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 10
    },
    {
      id: 'intelligence',
      name: 'Intelligence',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 10
    }
  ] as StatDefinition[],

  cultivation: [
    {id: 'qi', name: 'Qi', type: 'number', defaultValue: 100, min: 0},
    {
      id: 'comprehension',
      name: 'Comprehension',
      type: 'number',
      defaultValue: 50,
      min: 0,
      max: 100
    },
    {
      id: 'spirit_root',
      name: 'Spirit Root',
      type: 'text',
      defaultValue: 'Five Elements'
    },
    {
      id: 'realm',
      name: 'Cultivation Realm',
      type: 'text',
      defaultValue: 'Qi Condensation'
    }
  ] as StatDefinition[]
} as const;
