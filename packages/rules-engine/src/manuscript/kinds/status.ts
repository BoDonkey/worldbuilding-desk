import {z} from 'zod';
import type {StateMutationActorId} from '../types';
import type {EngineStateKind, EngineStateKindRegistry} from './types';

export type StatusStateMutationCommand = {
  type: 'status_apply' | 'status_remove';
  actorId: StateMutationActorId;
  statusName: string;
};

export const StatusStateMutationCommandSchema = z.object({
  type: z.enum(['status_apply', 'status_remove']),
  actorId: z.string().min(1),
  statusName: z.string().min(1)
});

export const statusCommandSchemas = [StatusStateMutationCommandSchema] as const;

const summarizeEffects: EngineStateKind<StatusStateMutationCommand>['summarizeEffects'] = ({
  after
}) => [`Statuses: ${after.statuses.join(', ') || 'none'}`];

export const statusKinds = {
  status_apply: {
    apply(next, command) {
      if (!next.statuses.includes(command.statusName)) {
        next.statuses.push(command.statusName);
      }
    },
    label: (command) => `Apply status ${command.statusName}`,
    summarizeEffects
  },
  status_remove: {
    apply(next, command) {
      next.statuses = next.statuses.filter((status) => status !== command.statusName);
    },
    label: (command) => `Remove status ${command.statusName}`,
    summarizeEffects
  }
} satisfies Pick<EngineStateKindRegistry, 'status_apply' | 'status_remove'>;
