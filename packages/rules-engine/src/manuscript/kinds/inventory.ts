import {z} from 'zod';
import type {
  CharacterReplayState,
  StateMutationActorId,
  StateMutationInventoryQuantity
} from '../types';
import type {EngineStateKind, EngineStateKindRegistry} from './types';

export type InventoryQuantityStateMutationCommand = {
  type: 'inventory_add' | 'inventory_remove' | 'inventory_consume';
  actorId: StateMutationActorId;
  itemName: string;
  quantity?: StateMutationInventoryQuantity;
  sourceEntityId?: string;
  definitionId?: string;
};

export type InventoryEquipStateMutationCommand = {
  type: 'inventory_equip' | 'inventory_unequip';
  actorId: StateMutationActorId;
  itemName: string;
  sourceEntityId?: string;
  definitionId?: string;
};

export const InventoryQuantityStateMutationCommandSchema = z.object({
  type: z.enum(['inventory_add', 'inventory_remove', 'inventory_consume']),
  actorId: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  sourceEntityId: z.string().min(1).optional(),
  definitionId: z.string().min(1).optional()
});

export const InventoryEquipStateMutationCommandSchema = z.object({
  type: z.enum(['inventory_equip', 'inventory_unequip']),
  actorId: z.string().min(1),
  itemName: z.string().min(1),
  sourceEntityId: z.string().min(1).optional(),
  definitionId: z.string().min(1).optional()
});

export const inventoryCommandSchemas = [
  InventoryQuantityStateMutationCommandSchema,
  InventoryEquipStateMutationCommandSchema
] as const;

type InventoryItems = CharacterReplayState['inventory']['items'];

/** Finds an item by Compendium definition, then source entity, then name. */
function findInventoryItemIndex(
  items: InventoryItems,
  reference: {itemName: string; sourceEntityId?: string; definitionId?: string}
): number {
  if (reference.definitionId) {
    const definitionMatch = items.findIndex(
      (item) => item.definitionId === reference.definitionId
    );
    if (definitionMatch >= 0) return definitionMatch;
  }
  if (reference.sourceEntityId) {
    const entityMatch = items.findIndex(
      (item) => item.sourceEntityId === reference.sourceEntityId
    );
    if (entityMatch >= 0) return entityMatch;
  }
  return items.findIndex((item) =>
    item.name.trim().toLowerCase() === reference.itemName.trim().toLowerCase()
  );
}

/** Quantity held by name only, as previews have always shown it. */
function quantityByName(state: CharacterReplayState, itemName: string): number {
  return (
    state.inventory.items.find(
      (item) => item.name.trim().toLowerCase() === itemName.trim().toLowerCase()
    )?.quantity ?? 0
  );
}

function takeFromInventory(next: CharacterReplayState, command: InventoryQuantityStateMutationCommand): void {
  const existingIndex = findInventoryItemIndex(next.inventory.items, command);
  if (existingIndex < 0) {
    return;
  }
  const quantity = command.quantity ?? 1;
  const remaining = next.inventory.items[existingIndex].quantity - quantity;
  if (remaining > 0) {
    next.inventory.items[existingIndex].quantity = remaining;
  } else {
    next.inventory.items.splice(existingIndex, 1);
  }
  if (command.type === 'inventory_remove') {
    next.inventory.equipped = next.inventory.equipped.filter(
      (name) => name !== command.itemName
    );
  }
}

const validateTake: EngineStateKind<InventoryQuantityStateMutationCommand>['validateAgainstState'] = (
  state,
  command
) => {
  const existingIndex = findInventoryItemIndex(state.inventory.items, command);
  const existing = existingIndex >= 0 ? state.inventory.items[existingIndex] : undefined;
  const quantity = command.quantity ?? 1;
  if (!existing) {
    return [`Item "${command.itemName}" is not present in inventory.`];
  }
  if (existing.quantity < quantity) {
    return [
      `Item "${command.itemName}" only has quantity ${existing.quantity}, cannot remove ${quantity}.`
    ];
  }
  return [];
};

const summarizeQuantity: EngineStateKind<InventoryQuantityStateMutationCommand>['summarizeEffects'] = ({
  before,
  after,
  command
}) => [
  `${command.itemName}: ${quantityByName(before, command.itemName)} -> ${quantityByName(after, command.itemName)}`
];

const summarizeEquip: EngineStateKind<InventoryEquipStateMutationCommand>['summarizeEffects'] = ({
  after,
  command
}) => [
  `${command.itemName}: ${
    after.inventory.equipped.includes(command.itemName) ? 'equipped' : 'unequipped'
  }`
];

export const inventoryKinds = {
  inventory_add: {
    apply(next, command) {
      const existingIndex = findInventoryItemIndex(next.inventory.items, command);
      const quantity = command.quantity ?? 1;
      if (existingIndex >= 0) {
        next.inventory.items[existingIndex].quantity += quantity;
        next.inventory.items[existingIndex].sourceEntityId ??= command.sourceEntityId;
        next.inventory.items[existingIndex].definitionId ??= command.definitionId;
      } else {
        next.inventory.items.push({
          name: command.itemName,
          quantity,
          sourceEntityId: command.sourceEntityId,
          definitionId: command.definitionId
        });
      }
    },
    label: (command) => `Add ${command.itemName} x${command.quantity ?? 1}`,
    summarizeEffects: summarizeQuantity
  },
  inventory_remove: {
    apply: takeFromInventory,
    validateAgainstState: validateTake,
    label: (command) => `Remove ${command.itemName} x${command.quantity ?? 1}`,
    summarizeEffects: summarizeQuantity
  },
  inventory_consume: {
    apply: takeFromInventory,
    validateAgainstState: validateTake,
    label: (command) => `Consume ${command.itemName} x${command.quantity ?? 1}`,
    summarizeEffects: summarizeQuantity
  },
  inventory_equip: {
    apply(next, command) {
      if (!next.inventory.equipped.includes(command.itemName)) {
        next.inventory.equipped.push(command.itemName);
      }
    },
    validateAgainstState(state, command) {
      const existingIndex = findInventoryItemIndex(state.inventory.items, command);
      return existingIndex >= 0 ? [] : [`Item "${command.itemName}" is not present in inventory.`];
    },
    label: (command) => `Equip ${command.itemName}`,
    summarizeEffects: summarizeEquip
  },
  inventory_unequip: {
    apply(next, command) {
      next.inventory.equipped = next.inventory.equipped.filter(
        (name) => name !== command.itemName
      );
    },
    label: (command) => `Unequip ${command.itemName}`,
    summarizeEffects: summarizeEquip
  }
} satisfies Pick<
  EngineStateKindRegistry,
  'inventory_add' | 'inventory_remove' | 'inventory_consume' | 'inventory_equip' | 'inventory_unequip'
>;
