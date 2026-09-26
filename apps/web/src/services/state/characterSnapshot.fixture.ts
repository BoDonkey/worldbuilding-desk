import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  EntityCategory,
  StateMutationCommand,
  StateMutationEvent,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import type {CharacterRuntimeModifiers} from '../compendium';

// Shared fixture for the character snapshot service and the scene roster that
// renders it: two scenes of accepted state changes (positions within a scene,
// consumables, linked items, equipment, statuses, location), runtime
// modifiers, and one character without a mechanics sheet.

const projectId = 'project-snapshot';

const scene = (id: string, order: number, title: string, content: string): WritingDocument => ({
  id,
  projectId,
  title,
  content,
  order,
  createdAt: order,
  updatedAt: order
});

export const snapshotScenes: WritingDocument[] = [
  scene('scene-1', 1, 'The Descent', '<p>Mira and Oren descend. Mira drinks a potion.</p>'),
  scene('scene-2', 2, 'The Vault', '<p>Mira draws the Ember Blade. Oren waits.</p>'),
  scene('scene-3', 3, 'Aftermath', '<p>Mira rests.</p>')
];

export const snapshotCategories: EntityCategory[] = [
  {
    id: 'characters',
    projectId,
    kind: 'character',
    name: 'Characters',
    slug: 'characters',
    fieldSchema: [],
    createdAt: 1
  },
  {
    id: 'items',
    projectId,
    kind: 'general',
    name: 'Items',
    slug: 'items',
    fieldSchema: [],
    createdAt: 1
  }
];

export const snapshotCharacters: Character[] = [
  {id: 'character-mira', projectId, name: 'Mira', fields: {role: 'Scout'}, createdAt: 1, updatedAt: 1},
  {id: 'character-oren', projectId, name: 'Oren', fields: {role: 'Guide'}, createdAt: 1, updatedAt: 1}
];

export const snapshotEntities: WorldEntity[] = [
  {
    id: 'entity-mira',
    projectId,
    categoryId: 'characters',
    name: 'Mira',
    fields: {},
    links: [],
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'entity-ember-blade',
    projectId,
    categoryId: 'items',
    name: 'Ember Blade',
    fields: {},
    links: [],
    createdAt: 1,
    updatedAt: 1
  }
];

export const snapshotSheet: CharacterSheet = {
  id: 'sheet-mira',
  projectId,
  characterId: 'character-mira',
  name: 'Mira',
  level: 3,
  experience: 0,
  stats: [
    {definitionId: 'strength', value: 12},
    {definitionId: 'agility', value: 15}
  ],
  resources: [
    {definitionId: 'hp', current: 30, max: 40},
    {definitionId: 'mana', current: 10, max: 10}
  ],
  inventory: [],
  inventoryEntries: [{id: 'entry-rope', mode: 'quick', name: 'Rope'}],
  statuses: ['Rested'],
  createdAt: 1,
  updatedAt: 1
};

export const snapshotCompendiumEntries: CompendiumEntry[] = [
  {
    id: 'compendium-potion',
    projectId,
    name: 'Healing Potion',
    domain: 'flora',
    consumable: {durationLabel: 'one scene', effects: []},
    actions: [],
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'compendium-blade',
    projectId,
    name: 'Blade entry',
    domain: 'artifact',
    sourceEntityId: 'entity-ember-blade',
    actions: [],
    createdAt: 1,
    updatedAt: 1
  }
];

type CommandWithoutActor = StateMutationCommand extends infer Command
  ? Command extends StateMutationCommand
    ? Omit<Command, 'actorId'>
    : never
  : never;

let eventCounter = 0;
const accepted = (
  sceneId: string,
  sceneOrder: number,
  scenePosition: number | undefined,
  commands: CommandWithoutActor[]
): StateMutationEvent => {
  eventCounter += 1;
  return {
    id: `event-${eventCounter}`,
    projectId,
    sceneId,
    sceneOrder,
    scenePosition,
    sourceRevision: 1,
    sourceHash: `hash-${eventCounter}`,
    status: 'accepted',
    commands: commands.map((command) => ({...command, actorId: snapshotSheet.id}) as StateMutationCommand),
    createdAt: eventCounter
  };
};

export const snapshotEvents: StateMutationEvent[] = [
  accepted('scene-1', 1, 10, [
    {type: 'resource_change', resourceDefinitionId: 'hp', delta: -18},
    {type: 'location_set', locationName: 'The Stair'}
  ]),
  accepted('scene-1', 1, 30, [
    {type: 'inventory_add', itemName: 'Healing Potion', quantity: 2, definitionId: 'compendium-potion'},
    {type: 'inventory_consume', itemName: 'Healing Potion', quantity: 1, definitionId: 'compendium-potion'},
    {type: 'resource_change', resourceDefinitionId: 'hp', delta: 12},
    {type: 'status_apply', statusName: 'Invigorated'}
  ]),
  accepted('scene-2', 2, 5, [
    {type: 'inventory_add', itemName: 'blade', sourceEntityId: 'entity-ember-blade'},
    {type: 'inventory_equip', itemName: 'blade'},
    {type: 'stat_change', statDefinitionId: 'strength', delta: 2},
    {type: 'status_remove', statusName: 'Rested'},
    {type: 'location_set', locationName: 'The Vault'}
  ]),
  accepted('scene-2', 2, 40, [
    {type: 'resource_set', resourceDefinitionId: 'mana', value: 3},
    {type: 'stat_set', statDefinitionId: 'agility', value: 16}
  ]),
  {
    ...accepted('scene-2', 2, 50, [{type: 'resource_set', resourceDefinitionId: 'hp', value: 1}]),
    status: 'proposed'
  },
  accepted('scene-3', 3, undefined, [
    {type: 'inventory_unequip', itemName: 'blade'},
    {type: 'inventory_remove', itemName: 'Rope'}
  ])
];

export const snapshotRuntimeModifiers: CharacterRuntimeModifiers = {
  statModifiers: {agility: {add: 1, multiply: 1}},
  resourceModifiers: {hp: {add: 5, multiply: 1}},
  levelBonus: 1,
  notes: ['Party synergy grants +1 effective level.']
};

export const snapshotStatNames = new Map([
  ['strength', 'Strength'],
  ['agility', 'Agility']
]);

export const snapshotResourceNames = new Map([
  ['hp', 'Health'],
  ['mana', 'Mana']
]);
