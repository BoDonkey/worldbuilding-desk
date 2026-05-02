import {z} from 'zod';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';

const statValueSchema = z.union([z.number(), z.boolean(), z.string()]);

export const ResourceChangeStateMutationCommandSchema = z.object({
  type: z.literal('resource_change'),
  actorId: z.string().min(1),
  resourceDefinitionId: z.string().min(1),
  delta: z.number()
});

export const ResourceSetStateMutationCommandSchema = z.object({
  type: z.literal('resource_set'),
  actorId: z.string().min(1),
  resourceDefinitionId: z.string().min(1),
  value: z.number()
});

export const StatChangeStateMutationCommandSchema = z.object({
  type: z.literal('stat_change'),
  actorId: z.string().min(1),
  statDefinitionId: z.string().min(1),
  delta: statValueSchema
});

export const StatSetStateMutationCommandSchema = z.object({
  type: z.literal('stat_set'),
  actorId: z.string().min(1),
  statDefinitionId: z.string().min(1),
  value: statValueSchema
});

export const StatusStateMutationCommandSchema = z.object({
  type: z.enum(['status_apply', 'status_remove']),
  actorId: z.string().min(1),
  statusName: z.string().min(1)
});

export const InventoryQuantityStateMutationCommandSchema = z.object({
  type: z.enum(['inventory_add', 'inventory_remove', 'inventory_consume']),
  actorId: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive().optional()
});

export const InventoryEquipStateMutationCommandSchema = z.object({
  type: z.enum(['inventory_equip', 'inventory_unequip']),
  actorId: z.string().min(1),
  itemName: z.string().min(1)
});

export const LocationSetStateMutationCommandSchema = z.object({
  type: z.literal('location_set'),
  actorId: z.string().min(1),
  locationName: z.string().min(1)
});

export const StateMutationCommandSchema = z.discriminatedUnion('type', [
  ResourceChangeStateMutationCommandSchema,
  ResourceSetStateMutationCommandSchema,
  StatChangeStateMutationCommandSchema,
  StatSetStateMutationCommandSchema,
  StatusStateMutationCommandSchema,
  InventoryQuantityStateMutationCommandSchema,
  InventoryEquipStateMutationCommandSchema,
  LocationSetStateMutationCommandSchema
]);

export const StateMutationEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  sceneTitle: z.string().optional(),
  sceneOrder: z.number().int().optional(),
  sceneSequence: z.number().int().positive().optional(),
  sourceType: z.enum(['manual', 'deterministic-review']).optional(),
  sourceRevision: z.number().int().nonnegative(),
  sourceHash: z.string().min(1),
  status: z.enum(['proposed', 'accepted', 'invalidated']),
  commands: z.array(StateMutationCommandSchema),
  createdAt: z.number().int().nonnegative(),
  invalidatedAt: z.number().int().nonnegative().optional(),
  invalidationReason: z.string().optional()
});

export type StateMutationCommandInput = z.input<typeof StateMutationCommandSchema>;

const FIELD_KIND_BY_COMMAND_TYPE = {
  resource_change: 'resource',
  resource_set: 'resource',
  stat_change: 'stat',
  stat_set: 'stat'
} as const;

export type TrackedFieldKind = (typeof FIELD_KIND_BY_COMMAND_TYPE)[keyof typeof FIELD_KIND_BY_COMMAND_TYPE];

export function validateStateMutationEvent(event: StateMutationEvent): StateMutationEvent {
  return StateMutationEventSchema.parse(event);
}

export function validateStateMutationCommandIds(params: {
  command: z.infer<typeof StateMutationCommandSchema>;
  ruleset: StoredRuleset | null;
}): string[] {
  const {command, ruleset} = params;
  if (!ruleset) {
    return [];
  }

  const statIds = new Set(ruleset.statDefinitions.map((definition) => definition.id));
  const resourceIds = new Set(
    ruleset.resourceDefinitions.map((definition) => definition.id)
  );
  const errors: string[] = [];

  if (command.type === 'stat_change' || command.type === 'stat_set') {
    if (!statIds.has(command.statDefinitionId)) {
      errors.push(`Unknown stat definition "${command.statDefinitionId}".`);
    }
  }

  if (command.type === 'resource_change' || command.type === 'resource_set') {
    if (!resourceIds.has(command.resourceDefinitionId)) {
      errors.push(`Unknown resource definition "${command.resourceDefinitionId}".`);
    }
  }

  return errors;
}

export function validateStateMutationCommandValueTypes(params: {
  command: z.infer<typeof StateMutationCommandSchema>;
  ruleset: StoredRuleset | null;
}): string[] {
  const {command, ruleset} = params;
  if (!ruleset) {
    return [];
  }

  if (command.type !== 'stat_change' && command.type !== 'stat_set') {
    return [];
  }

  const statDefinition = ruleset.statDefinitions.find(
    (definition) => definition.id === command.statDefinitionId
  );
  if (!statDefinition) {
    return [];
  }

  const fieldValue = command.type === 'stat_change' ? command.delta : command.value;
  const actualType =
    typeof fieldValue === 'boolean'
      ? 'boolean'
      : typeof fieldValue === 'number'
        ? 'number'
        : 'text';

  return actualType === statDefinition.type
    ? []
    : [
        `Stat "${statDefinition.id}" expects ${statDefinition.type} but received ${actualType}.`
      ];
}

export interface CharacterStateReplayBaseline {
  actorId: string;
  actorName: string;
  stats: Record<string, number | boolean | string>;
  resources: {
    current: Record<string, number>;
    max: Record<string, number>;
  };
  inventory: {
    items: Array<{name: string; quantity: number}>;
    equipped: string[];
  };
  statuses: string[];
  locationName?: string;
}

export function buildCharacterReplayBaseline(params: {
  sheet: CharacterSheet;
  ruleset: StoredRuleset | null;
}): CharacterStateReplayBaseline {
  const {sheet, ruleset} = params;

  const stats: Record<string, number | boolean | string> = {};
  const current: Record<string, number> = {};
  const max: Record<string, number> = {};

  ruleset?.statDefinitions.forEach((definition) => {
    stats[definition.id] = definition.defaultValue;
  });
  ruleset?.resourceDefinitions.forEach((definition) => {
    const currentValue =
      typeof definition.defaultValue === 'number' ? definition.defaultValue : 0;
    current[definition.id] = currentValue;
    max[definition.id] =
      typeof definition.max === 'number' ? definition.max : currentValue;
  });

  sheet.stats.forEach((stat) => {
    stats[stat.definitionId] = stat.value;
  });

  sheet.resources.forEach((resource) => {
    current[resource.definitionId] = resource.current;
    max[resource.definitionId] = resource.max;
  });

  const inventoryItems =
    sheet.inventoryEntries?.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity ?? 1
    })) ?? [];
  const equipped = sheet.equipmentEntries?.map((entry) => entry.name) ?? [];
  const statuses =
    sheet.statusEntries?.map((entry) => entry.name) ??
    sheet.statuses?.filter(Boolean) ??
    [];

  return {
    actorId: sheet.characterId ?? sheet.id,
    actorName: sheet.name,
    stats,
    resources: {
      current,
      max
    },
    inventory: {
      items: inventoryItems,
      equipped
    },
    statuses,
    locationName: undefined
  };
}
