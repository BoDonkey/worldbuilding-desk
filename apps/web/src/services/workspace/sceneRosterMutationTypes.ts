import type {StateMutationEvent} from '../../entityTypes';
import type {StateMutationTextAnchor} from '../state/stateMutationAnchor';
import type {SceneRosterCharacterCard} from './sceneRosterTypes';

export interface PendingPositionedChange {
  character: SceneRosterCharacterCard;
  event?: StateMutationEvent | null;
  initialLabel?: string;
  initialCommands?: StateMutationEvent['commands'];
  consumableEffect?: StateMutationEvent['consumableEffect'];
}

export interface PendingInventoryCapture {
  sceneId: string;
  sourceHash: string;
  itemName: string;
  evidenceText: string;
  suggestedActorId?: string;
  action: 'acquire' | 'consume';
  proposalEventId?: string;
  position: number;
  anchor: StateMutationTextAnchor;
}

export type RosterPlanResult<T> = {
  value: T;
  error?: never;
} | {
  error: string;
  value?: never;
};
