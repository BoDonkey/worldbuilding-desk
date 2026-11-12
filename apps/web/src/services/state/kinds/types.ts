import type {
  StateMutationCommandOf,
  StateMutationCommandType
} from '@worldbuilding-desk/rules-engine';
import type {StateMutationCommand, StoredRuleset} from '../../../entityTypes';
import type {ObservationProposal} from '../../worldEngine/types';

export type StateDeltaObservation = Extract<
  ObservationProposal,
  {type: 'state_delta_candidate'}
>;

export type StateChangeCategory =
  | 'Attributes'
  | 'Resources'
  | 'Inventory'
  | 'Equipment'
  | 'Statuses'
  | 'Locations'
  | 'Progression';

type StatDefinition = StoredRuleset['statDefinitions'][number];
type ResourceDefinition = StoredRuleset['resourceDefinitions'][number];

/** The Character Sheets form's values, as the form holds them. */
export interface SheetFormValues {
  resourceDefinitionId: string;
  statDefinitionId: string;
  numberValue: string;
  textValue: string;
  booleanValue: boolean;
  statusName: string;
  itemName: string;
  quantity: string;
  locationName: string;
}

/** The form's values after the shared parsing every kind relies on. */
export interface SheetFormInput {
  actorId: string;
  statDefinition: StatDefinition | null;
  resourceDefinition: ResourceDefinition | null;
  numericValue: number;
  textValue: string;
  booleanValue: boolean;
  quantity: number;
  statusName: string;
  itemName: string;
  locationName: string;
}

/** One input on the Character Sheets form, in display order. */
export type SheetFormField =
  | {type: 'definition'; source: 'resource' | 'stat'}
  | {type: 'number'; label: string}
  | {type: 'statValue'; numberLabel: string; textLabel: string}
  | {
      type: 'text';
      value: 'statusName' | 'itemName' | 'locationName' | 'textValue';
      label: string;
      placeholder: string;
      /** Suggest World Bible place names while typing (slice 4.77). */
      suggest?: 'places';
    }
  | {type: 'quantity'};

/** One row of the Workspace change composer. */
export interface PositionedChangeDraft {
  id: string;
  kind: StateMutationCommandType;
  definitionId?: string;
  value?: string;
  name?: string;
  quantity?: string;
  sourceEntityId?: string;
}

export type ComposerDraftValues = Omit<PositionedChangeDraft, 'id' | 'kind'>;

/** A composer row after the shared parsing every kind relies on. */
export interface ComposerInput {
  actorId: string;
  draft: PositionedChangeDraft;
  ruleset: StoredRuleset | null;
  value: number | null;
  quantity: number;
  name: string;
}

/** Which inputs a composer row shows for a kind. */
export type ComposerInputSpec =
  | {
      type: 'definition';
      source: 'stat' | 'resource';
      /** Label in the composer's basic (stats and resources only) view. */
      basicLabel: string;
      valueLabel: string;
      valuePlaceholder: string;
    }
  | {
      type: 'name';
      label: string;
      inventoryChoice: boolean;
      quantity: boolean;
      /** Suggest World Bible place names while typing (slice 4.77). */
      suggest?: 'places';
    }
  | {
      /** A number in `value` plus an optional note in `name`. */
      type: 'amount';
      valueLabel: string;
      valuePlaceholder: string;
      noteLabel: string;
      notePlaceholder: string;
    };

/**
 * The app's side of one kind of state change: how authors enter it and how
 * AI observations map onto it. Like the engine side, it builds commands and
 * never decides whether they are proposed or applied.
 */
export interface AppStateKind<C extends StateMutationCommand> {
  sheetForm: {
    label: string;
    fields: SheetFormField[];
    build(input: SheetFormInput): C | null;
    /** Form values to show when editing an existing command. */
    load(command: C): Partial<SheetFormValues>;
  };
  composer: {
    label: string;
    input: ComposerInputSpec;
    build(input: ComposerInput): C | null;
    load(command: C): ComposerDraftValues;
  };
  fromObservation(observation: StateDeltaObservation, actorId: string): C | null;
  /** Short technical line in the Character Sheets history. */
  historyLabel(command: C): string;
  dashboardCategory: StateChangeCategory;
}

export type AppStateKindRegistry = {
  [T in StateMutationCommandType]: AppStateKind<StateMutationCommandOf<T>>;
};
