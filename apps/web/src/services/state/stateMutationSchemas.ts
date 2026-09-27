// The command schemas, ruleset validation, and replay baseline live in the
// rules engine (Slice 3.10); this module keeps the app's import path.
export {
  ResourceChangeStateMutationCommandSchema,
  ResourceSetStateMutationCommandSchema,
  StatChangeStateMutationCommandSchema,
  StatSetStateMutationCommandSchema,
  StatusStateMutationCommandSchema,
  InventoryQuantityStateMutationCommandSchema,
  InventoryEquipStateMutationCommandSchema,
  LocationSetStateMutationCommandSchema,
  StateMutationCommandSchema,
  StateMutationEventSchema,
  validateStateMutationEvent,
  validateStateMutationCommandIds,
  validateStateMutationCommandValueTypes,
  buildCharacterReplayBaseline
} from '@worldbuilding-desk/rules-engine';
export type {
  StateMutationCommandInput,
  CharacterStateReplayBaseline
} from '@worldbuilding-desk/rules-engine';

export type TrackedFieldKind = 'resource' | 'stat';
