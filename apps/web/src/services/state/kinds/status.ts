import type {AppStateKind, AppStateKindRegistry} from './types';
import type {StatusStateMutationCommand} from '../../../entityTypes';

type StatusType = StatusStateMutationCommand['type'];

function statusAppKind(
  type: StatusType,
  labels: {form: string; composer: string; history: string}
): AppStateKind<StatusStateMutationCommand> {
  return {
    sheetForm: {
      label: labels.form,
      fields: [{type: 'text', value: 'statusName', label: 'Status name', placeholder: 'Poisoned'}],
      build: ({actorId, statusName}) => (statusName ? {type, actorId, statusName} : null),
      load: (command) => ({statusName: command.statusName})
    },
    composer: {
      label: labels.composer,
      input: {type: 'name', label: 'Status', inventoryChoice: false, quantity: false},
      build: ({actorId, name}) => (name ? {type, actorId, statusName: name} : null),
      load: (command) => ({name: command.statusName})
    },
    fromObservation: (observation, actorId) =>
      observation.target ? {type, actorId, statusName: observation.target} : null,
    historyLabel: (command) => `${labels.history} ${command.statusName}`,
    dashboardCategory: 'Statuses'
  };
}

export const statusAppKinds = {
  status_apply: statusAppKind('status_apply', {
    form: 'Add status',
    composer: 'Apply status',
    history: 'Apply status'
  }),
  status_remove: statusAppKind('status_remove', {
    form: 'Remove status',
    composer: 'Remove status',
    history: 'Remove status'
  })
} satisfies Pick<AppStateKindRegistry, 'status_apply' | 'status_remove'>;
