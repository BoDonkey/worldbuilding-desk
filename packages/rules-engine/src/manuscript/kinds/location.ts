import {z} from 'zod';
import type {StateMutationActorId} from '../types';
import type {EngineStateKindRegistry} from './types';

export type LocationSetStateMutationCommand = {
  type: 'location_set';
  actorId: StateMutationActorId;
  locationName: string;
};

export const LocationSetStateMutationCommandSchema = z.object({
  type: z.literal('location_set'),
  actorId: z.string().min(1),
  locationName: z.string().min(1)
});

export const locationCommandSchemas = [LocationSetStateMutationCommandSchema] as const;

export const locationKinds = {
  location_set: {
    apply(next, command) {
      next.locationName = command.locationName;
    },
    label: (command) => `Move to ${command.locationName}`,
    summarizeEffects: ({before, after}) => [
      `Location: ${before.locationName || 'unset'} -> ${after.locationName || 'unset'}`
    ]
  }
} satisfies Pick<EngineStateKindRegistry, 'location_set'>;
