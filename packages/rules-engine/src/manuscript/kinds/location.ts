import {z} from 'zod';
import type {StateMutationActorId} from '../types';
import type {EngineStateKindRegistry} from './types';

export type LocationSetStateMutationCommand = {
  type: 'location_set';
  actorId: StateMutationActorId;
  /** The text the author wrote; label and fallback when there is no record. */
  locationName: string;
  /** The World Bible place record this position refers to (slice 4.77). */
  placeId?: string;
};

export const LocationSetStateMutationCommandSchema = z.object({
  type: z.literal('location_set'),
  actorId: z.string().min(1),
  locationName: z.string().min(1),
  placeId: z.string().min(1).optional()
});

export const locationCommandSchemas = [LocationSetStateMutationCommandSchema] as const;

export const locationKinds = {
  location_set: {
    apply(next, command) {
      next.locationName = command.locationName;
      next.locationPlaceId = command.placeId;
    },
    label: (command) => `Move to ${command.locationName}`,
    summarizeEffects: ({before, after}) => [
      `Location: ${before.locationName || 'unset'} -> ${after.locationName || 'unset'}`
    ]
  }
} satisfies Pick<EngineStateKindRegistry, 'location_set'>;
