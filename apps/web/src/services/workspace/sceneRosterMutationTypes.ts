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
  suggestedSheetId?: string;
  action: 'acquire' | 'consume';
  proposalEventId?: string;
  position: number;
  anchor: StateMutationTextAnchor;
}

export const hashSceneContent = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

export type RosterPlanResult<T> = {
  value: T;
  error?: never;
} | {
  error: string;
  value?: never;
};
