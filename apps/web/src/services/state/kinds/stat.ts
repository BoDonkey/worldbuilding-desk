import type {
  AppStateKindRegistry,
  ComposerInput,
  SheetFormInput,
  SheetFormValues
} from './types';
import type {
  StatChangeStateMutationCommand,
  StatSetStateMutationCommand
} from '../../../entityTypes';

type StatCommand = StatChangeStateMutationCommand | StatSetStateMutationCommand;
type StatValue = StatCommand extends infer C ? C extends {delta: infer V} ? V : never : never;

/** The form's value for the chosen stat, read by the stat's type. */
function sheetFormStat(input: SheetFormInput): {id: string; value: StatValue} | null {
  const {statDefinition, numericValue, booleanValue, textValue} = input;
  if (!statDefinition) return null;
  if (statDefinition.type === 'number' && Number.isFinite(numericValue)) {
    return {id: statDefinition.id, value: numericValue};
  }
  if (statDefinition.type === 'boolean') {
    return {id: statDefinition.id, value: booleanValue};
  }
  return {id: statDefinition.id, value: textValue};
}

/** Form values that show an existing stat value in the right input. */
function loadStatValue(value: StatValue): Partial<SheetFormValues> {
  if (typeof value === 'boolean') {
    return {booleanValue: value, textValue: '', numberValue: '0'};
  }
  if (typeof value === 'number') {
    return {numberValue: String(value), textValue: ''};
  }
  return {textValue: value, numberValue: '0'};
}

/** The composer's chosen stat and value, read by the stat's type. */
function composerStat(input: ComposerInput): {id: string; value: StatValue} | null {
  const {draft, ruleset, value} = input;
  const definition = ruleset?.statDefinitions.find(
    (entry) => entry.id === draft.definitionId
  );
  if (!definition || !draft.definitionId) return null;
  const rawValue =
    definition.type === 'number'
      ? value
      : definition.type === 'boolean'
        ? draft.value !== 'false'
        : draft.value ?? '';
  if (rawValue === null || rawValue === '') return null;
  return {id: draft.definitionId, value: rawValue};
}

/** The AI review does not observe these kinds yet. */
const noObservation = (): null => null;

export const statAppKinds = {
  stat_change: {
    sheetForm: {
      label: 'Change stat by',
      fields: [
        {type: 'definition', source: 'stat'},
        {type: 'statValue', numberLabel: 'Delta', textLabel: 'Delta text'}
      ],
      build: (input) => {
        const stat = sheetFormStat(input);
        return stat
          ? {type: 'stat_change', actorId: input.actorId, statDefinitionId: stat.id, delta: stat.value}
          : null;
      },
      load: (command) => ({
        statDefinitionId: command.statDefinitionId,
        ...loadStatValue(command.delta)
      })
    },
    composer: {
      label: 'Change stat',
      input: {
        type: 'definition',
        source: 'stat',
        basicLabel: 'Change by (stat)',
        valueLabel: 'Change',
        valuePlaceholder: '+10 or -10'
      },
      build: (input) => {
        const stat = composerStat(input);
        return stat
          ? {type: 'stat_change', actorId: input.actorId, statDefinitionId: stat.id, delta: stat.value}
          : null;
      },
      load: (command) => ({
        definitionId: command.statDefinitionId,
        value: String(command.delta)
      })
    },
    fromObservation: noObservation,
    historyLabel: (command) =>
      `Stat ${command.statDefinitionId} -> delta ${String(command.delta)}`,
    dashboardCategory: 'Attributes'
  },
  stat_set: {
    sheetForm: {
      label: 'Set stat to',
      fields: [
        {type: 'definition', source: 'stat'},
        {type: 'statValue', numberLabel: 'Value', textLabel: 'Value'}
      ],
      build: (input) => {
        const stat = sheetFormStat(input);
        return stat
          ? {type: 'stat_set', actorId: input.actorId, statDefinitionId: stat.id, value: stat.value}
          : null;
      },
      load: (command) => ({
        statDefinitionId: command.statDefinitionId,
        ...loadStatValue(command.value)
      })
    },
    composer: {
      label: 'Set stat',
      input: {
        type: 'definition',
        source: 'stat',
        basicLabel: 'Set to (stat)',
        valueLabel: 'New value',
        valuePlaceholder: '20'
      },
      build: (input) => {
        const stat = composerStat(input);
        return stat
          ? {type: 'stat_set', actorId: input.actorId, statDefinitionId: stat.id, value: stat.value}
          : null;
      },
      load: (command) => ({
        definitionId: command.statDefinitionId,
        value: String(command.value)
      })
    },
    fromObservation: noObservation,
    historyLabel: (command) => `Stat ${command.statDefinitionId} = ${String(command.value)}`,
    dashboardCategory: 'Attributes'
  }
} satisfies Pick<AppStateKindRegistry, 'stat_change' | 'stat_set'>;

/** A Compendium consumable's stat effect as a command (negated on expiry). */
export function statChangeFromConsumableEffect(params: {
  actorId: string;
  definitionId: string;
  delta: number;
}): StatChangeStateMutationCommand {
  return {
    type: 'stat_change',
    actorId: params.actorId,
    statDefinitionId: params.definitionId,
    delta: params.delta
  };
}
