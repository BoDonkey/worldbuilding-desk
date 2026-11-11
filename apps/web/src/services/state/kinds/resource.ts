import type {AppStateKindRegistry, ComposerInput} from './types';
import type {ResourceChangeStateMutationCommand} from '../../../entityTypes';

/** The composer's chosen resource and number, when both are valid. */
function composerResource(input: ComposerInput): {id: string; value: number} | null {
  const {draft, ruleset, value} = input;
  if (
    !draft.definitionId ||
    !ruleset?.resourceDefinitions.some((entry) => entry.id === draft.definitionId) ||
    value === null
  ) {
    return null;
  }
  return {id: draft.definitionId, value};
}

/** The AI review does not observe these kinds yet. */
const noObservation = (): null => null;

export const resourceAppKinds = {
  resource_change: {
    sheetForm: {
      label: 'Change resource by',
      fields: [
        {type: 'definition', source: 'resource'},
        {type: 'number', label: 'Delta'}
      ],
      build: ({actorId, resourceDefinition, numericValue}) =>
        resourceDefinition && Number.isFinite(numericValue)
          ? {
              type: 'resource_change',
              actorId,
              resourceDefinitionId: resourceDefinition.id,
              delta: numericValue
            }
          : null,
      load: (command) => ({
        resourceDefinitionId: command.resourceDefinitionId,
        numberValue: String(command.delta)
      })
    },
    composer: {
      label: 'Change resource',
      input: {
        type: 'definition',
        source: 'resource',
        basicLabel: 'Change by (resource)',
        valueLabel: 'Change',
        valuePlaceholder: '+10 or -10'
      },
      build: (input) => {
        const resource = composerResource(input);
        return resource
          ? {
              type: 'resource_change',
              actorId: input.actorId,
              resourceDefinitionId: resource.id,
              delta: resource.value
            }
          : null;
      },
      load: (command) => ({
        definitionId: command.resourceDefinitionId,
        value: String(command.delta)
      })
    },
    fromObservation: noObservation,
    historyLabel: (command) =>
      `Resource ${command.resourceDefinitionId} ${command.delta >= 0 ? '+' : ''}${command.delta}`,
    dashboardCategory: 'Resources'
  },
  resource_set: {
    sheetForm: {
      label: 'Set resource to',
      fields: [
        {type: 'definition', source: 'resource'},
        {type: 'number', label: 'Value'}
      ],
      build: ({actorId, resourceDefinition, numericValue}) =>
        resourceDefinition && Number.isFinite(numericValue)
          ? {
              type: 'resource_set',
              actorId,
              resourceDefinitionId: resourceDefinition.id,
              value: numericValue
            }
          : null,
      load: (command) => ({
        resourceDefinitionId: command.resourceDefinitionId,
        numberValue: String(command.value)
      })
    },
    composer: {
      label: 'Set resource',
      input: {
        type: 'definition',
        source: 'resource',
        basicLabel: 'Set to (resource)',
        valueLabel: 'New value',
        valuePlaceholder: '20'
      },
      build: (input) => {
        const resource = composerResource(input);
        return resource
          ? {
              type: 'resource_set',
              actorId: input.actorId,
              resourceDefinitionId: resource.id,
              value: resource.value
            }
          : null;
      },
      load: (command) => ({
        definitionId: command.resourceDefinitionId,
        value: String(command.value)
      })
    },
    fromObservation: noObservation,
    historyLabel: (command) => `Resource ${command.resourceDefinitionId} = ${command.value}`,
    dashboardCategory: 'Resources'
  }
} satisfies Pick<AppStateKindRegistry, 'resource_change' | 'resource_set'>;

/** A Compendium consumable's resource effect as a command (negated on expiry). */
export function resourceChangeFromConsumableEffect(params: {
  actorId: string;
  definitionId: string;
  delta: number;
}): ResourceChangeStateMutationCommand {
  return {
    type: 'resource_change',
    actorId: params.actorId,
    resourceDefinitionId: params.definitionId,
    delta: params.delta
  };
}
