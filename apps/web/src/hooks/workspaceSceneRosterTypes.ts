import type {Dispatch, SetStateAction} from 'react';
import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  EntityCategory,
  Project,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {ActorResolution} from '../services/characters/characterIdentity';
import type {ConsistencyAlias} from '../services/consistency';
import type {CharacterRuntimeModifiers} from '../services/compendium';
import type {EditorTextSnapshot, StateMutationTextAnchor} from '../services/state/stateMutationAnchor';
import type {SceneRosterOverrides} from '../services/workspace/sceneRoster';
import type {PendingPositionedChange, PendingInventoryCapture} from '../services/workspace/sceneRosterMutationTypes';
import type {ConfirmRequest} from './useConfirmDialog';

interface WorkspaceSceneFeedback {
  tone: 'success' | 'error';
  message: string;
}

export interface UseWorkspaceSceneRosterOptions {
  activeProject: Project | null;
  selectedDocument: WritingDocument | null;
  documents: WritingDocument[];
  content: string;
  categories: EntityCategory[];
  characters: Character[];
  entities: WorldEntity[];
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  aliases: ConsistencyAlias[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  compendiumEntries: CompendiumEntry[];
  getSceneRosterOverrides: (sceneId: string | null) => SceneRosterOverrides;
  updateSceneRosterOverride: (
    sceneId: string,
    candidateKey: string,
    action: 'pin' | 'hide' | 'reset'
  ) => void;
  sceneRosterStateMoment: 'opening' | 'cursor' | 'ending';
  setSceneRosterStateMoment: Dispatch<
    SetStateAction<'opening' | 'cursor' | 'ending'>
  >;
  sceneCursorPosition: number;
  setSceneCursorPosition: Dispatch<SetStateAction<number>>;
  sceneCursorSnapshot: EditorTextSnapshot;
  setSceneCursorAnchor: Dispatch<SetStateAction<StateMutationTextAnchor>>;
  sceneCursorAnchor: StateMutationTextAnchor;
  pendingPositionedChange: PendingPositionedChange | null;
  setPendingPositionedChange: Dispatch<
    SetStateAction<PendingPositionedChange | null>
  >;
  setSavingPositionedChange: Dispatch<SetStateAction<boolean>>;
  pendingInventoryCapture: PendingInventoryCapture | null;
  setPendingInventoryCapture: Dispatch<
    SetStateAction<PendingInventoryCapture | null>
  >;
  setSavingInventoryCapture: Dispatch<SetStateAction<boolean>>;
  setFeedback: (feedback: WorkspaceSceneFeedback) => void;
  requestConfirm: (request: ConfirmRequest) => void;
}

