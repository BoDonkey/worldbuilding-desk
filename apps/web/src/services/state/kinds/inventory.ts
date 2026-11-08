import type {AppStateKind, AppStateKindRegistry} from './types';
import type {
  InventoryEquipStateMutationCommand,
  InventoryQuantityStateMutationCommand
} from '../../../entityTypes';

interface InventoryLabels {
  form: string;
  composer: string;
  history: string;
}

function quantityAppKind(
  type: InventoryQuantityStateMutationCommand['type'],
  labels: InventoryLabels,
  composerUsesInventoryChoice: boolean
): AppStateKind<InventoryQuantityStateMutationCommand> {
  return {
    sheetForm: {
      label: labels.form,
      fields: [
        {type: 'text', value: 'itemName', label: 'Item name', placeholder: 'Iron Key'},
        {type: 'quantity'}
      ],
      build: ({actorId, itemName, quantity}) =>
        itemName ? {type, actorId, itemName, quantity} : null,
      load: (command) => ({
        itemName: command.itemName,
        quantity: String(command.quantity ?? 1)
      })
    },
    composer: {
      label: labels.composer,
      input: {
        type: 'name',
        label: 'Item',
        inventoryChoice: composerUsesInventoryChoice,
        quantity: true
      },
      build: ({actorId, draft, name, quantity}) =>
        name
          ? {
              type,
              actorId,
              itemName: name,
              quantity,
              sourceEntityId: draft.sourceEntityId,
              definitionId: draft.definitionId
            }
          : null,
      load: (command) => ({
        name: command.itemName,
        quantity: String(command.quantity ?? 1),
        sourceEntityId: command.sourceEntityId,
        definitionId: command.definitionId
      })
    },
    fromObservation: (observation, actorId) =>
      observation.target
        ? {
            type,
            actorId,
            itemName: observation.target,
            quantity:
              typeof observation.amount === 'number' && observation.amount > 0
                ? Math.floor(observation.amount)
                : undefined
          }
        : null,
    historyLabel: (command) =>
      `${labels.history} ${command.itemName}${command.quantity ? ` x${command.quantity}` : ''}`,
    dashboardCategory: 'Inventory'
  };
}

function equipAppKind(
  type: InventoryEquipStateMutationCommand['type'],
  labels: InventoryLabels
): AppStateKind<InventoryEquipStateMutationCommand> {
  return {
    sheetForm: {
      label: labels.form,
      fields: [{type: 'text', value: 'itemName', label: 'Item name', placeholder: 'Iron Key'}],
      build: ({actorId, itemName}) => (itemName ? {type, actorId, itemName} : null),
      load: (command) => ({itemName: command.itemName})
    },
    composer: {
      label: labels.composer,
      input: {type: 'name', label: 'Item', inventoryChoice: true, quantity: false},
      build: ({actorId, draft, name}) =>
        name
          ? {
              type,
              actorId,
              itemName: name,
              sourceEntityId: draft.sourceEntityId,
              definitionId: draft.definitionId
            }
          : null,
      load: (command) => ({
        name: command.itemName,
        sourceEntityId: command.sourceEntityId,
        definitionId: command.definitionId
      })
    },
    fromObservation: (observation, actorId) =>
      observation.target ? {type, actorId, itemName: observation.target} : null,
    historyLabel: (command) => `${labels.history} ${command.itemName}`,
    dashboardCategory: 'Equipment'
  };
}

export const inventoryAppKinds = {
  inventory_add: quantityAppKind(
    'inventory_add',
    {form: 'Add item', composer: 'Add inventory', history: 'Add'},
    false
  ),
  inventory_remove: quantityAppKind(
    'inventory_remove',
    {form: 'Remove item', composer: 'Remove inventory', history: 'Remove'},
    true
  ),
  inventory_consume: quantityAppKind(
    'inventory_consume',
    {form: 'Consume item', composer: 'Consume inventory', history: 'Consume'},
    true
  ),
  inventory_equip: equipAppKind('inventory_equip', {
    form: 'Equip item',
    composer: 'Equip item',
    history: 'Equip'
  }),
  inventory_unequip: equipAppKind('inventory_unequip', {
    form: 'Unequip item',
    composer: 'Unequip item',
    history: 'Unequip'
  })
} satisfies Pick<
  AppStateKindRegistry,
  'inventory_add' | 'inventory_remove' | 'inventory_consume' | 'inventory_equip' | 'inventory_unequip'
>;
