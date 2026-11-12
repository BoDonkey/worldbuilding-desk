import {useCallback, useState} from 'react';
import {useNavigate} from 'react-router';
import type {CharacterSheet} from '../entityTypes';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import {CharacterSheetList} from '../components/CharacterSheets/CharacterSheetList';
import {BasicCharacterStatePanel} from '../components/CharacterSheets/BasicCharacterStatePanel';
import {CharacterSheetEditorForm} from '../components/CharacterSheets/CharacterSheetEditorForm';
import {SceneChangePanel} from '../components/CharacterSheets/SceneChangePanel';
import {RulesetReferencePanel} from '../components/CharacterSheets/RulesetReferencePanel';
import styles from '../styles/CharacterSheetsRoute.module.css';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {
  useCharacterSheetsData,
  type CharacterSheetsFeedback
} from '../hooks/useCharacterSheetsData';
import {useCharacterSheetEditor} from '../hooks/useCharacterSheetEditor';
import {useCharacterSheetOpenRequests} from '../hooks/useCharacterSheetOpenRequests';
import {useCharacterSheetSceneChanges} from '../hooks/useCharacterSheetSceneChanges';
import {useCharacterSheetRulesetMemory} from '../hooks/useCharacterSheetRulesetMemory';
import {RouteFeedback} from '../components/common';

interface CharacterSheetsRouteProps {
  embedded?: boolean;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
  autoCreateSheetCharacterId?: string | null;
  onAutoCreateConsumed?: () => void;
  prefillSheetId?: string | null;
  prefillSceneId?: string | null;
  initialTaskView?: 'setup' | 'scene-history';
  initialShowAdvanced?: boolean;
}

function CharacterSheetsRoute({
  embedded = false,
  prefillCharacterId,
  onPrefillConsumed,
  autoCreateSheetCharacterId,
  onAutoCreateConsumed,
  prefillSheetId,
  prefillSceneId,
  initialTaskView,
  initialShowAdvanced = false
}: CharacterSheetsRouteProps) {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const navigate = useNavigate();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const capabilities = getProjectCapabilities(projectSettings);
  const [taskView, setTaskView] = useState<'setup' | 'scene-history'>(initialTaskView ?? 'setup');
  const [showAdvancedSheetState, setShowAdvancedSheetState] = useState(initialShowAdvanced);
  const [feedback, setFeedback] = useState<CharacterSheetsFeedback>(null);
  const showSceneHistory = useCallback(() => setTaskView('scene-history'), []);

  const data = useCharacterSheetsData({activeProject, setFeedback});
  const {sheets, setSheets, ruleset, characters, compendiumEntries, isLoaded, runtimeModifiers} = data;
  const sceneChanges = useCharacterSheetSceneChanges({
    activeProject,
    isLoaded,
    sheets,
    ruleset,
    documents: data.documents,
    stateMutationEvents: data.stateMutationEvents,
    setStateMutationEvents: data.setStateMutationEvents,
    actorResolutions: data.actorResolutions,
    setFeedback,
    showSceneHistory,
    prefillSheetId,
    prefillSceneId
  });
  const editor = useCharacterSheetEditor({
    activeProject, ruleset, sheets, setSheets, characters, compendiumEntries,
    setFeedback, requestConfirm
  });
  useCharacterSheetOpenRequests({
    activeProject,
    isLoaded,
    ruleset,
    characters,
    sheets,
    setSheets,
    editingId: editor.editingId,
    openSheet: editor.openSheet,
    startSheetForCharacter: editor.startSheetForCharacter,
    setMutationTargetSheetId: sceneChanges.setMutationTargetSheetId,
    setFeedback,
    prefillCharacterId,
    onPrefillConsumed,
    autoCreateSheetCharacterId,
    onAutoCreateConsumed
  });
  const rulesetMemory = useCharacterSheetRulesetMemory({
    activeProject, ruleset, shodhService: data.shodhService
  });

  const handleEdit = (sheet: CharacterSheet) => {
    setTaskView('setup');
    editor.openSheet(sheet);
  };

  if (!activeProject) {
    return (
      <p>
        Go to <strong>Projects</strong> to create or open a project first.
      </p>
    );
  }

  if (!ruleset) {
    return (
      <div>
        {!embedded && <h1>Character Sheets</h1>}
        {capabilities.canUseRuleAuthoring ? (
          <>
            <p>
              This project doesn't have a ruleset yet. Character sheets require a
              ruleset to define stats and resources.
            </p>
            <p>
              Without a ruleset, you will not see base stats like Strength or
              dynamic resources like Mana.
            </p>
            <button type='button' onClick={() => navigate('/ruleset')}>
              Open Ruleset
            </button>
          </>
        ) : (
          <p>
            Character sheets are disabled for this project mode. Use the roster
            for story-facing character canon.
          </p>
        )}
      </div>
    );
  }

  if (!showAdvancedSheetState) {
    return (
      <BasicCharacterStatePanel
        sheets={sheets}
        ruleset={ruleset}
        documents={sceneChanges.orderedDocuments}
        sheetId={sceneChanges.mutationTargetSheetId}
        sceneId={sceneChanges.mutationSceneId}
        mutationType={sceneChanges.mutationType}
        statDefinitionId={sceneChanges.mutationStatDefinitionId}
        resourceDefinitionId={sceneChanges.mutationResourceDefinitionId}
        numberValue={sceneChanges.mutationNumberValue}
        previewSummary={sceneChanges.selectedMutationValueSummary}
        previewIssues={sceneChanges.mutationPreviewIssues}
        feedback={feedback}
        isSaving={sceneChanges.isSavingMutation}
        onSheetChange={sceneChanges.setMutationTargetSheetId}
        onSceneChange={sceneChanges.setMutationSceneId}
        onTrackedValueChange={sceneChanges.selectTrackedValue}
        onOperationChange={sceneChanges.selectOperation}
        onNumberValueChange={sceneChanges.setMutationNumberValue}
        onConfirm={() => void sceneChanges.handleSaveMutation()}
        onOpenAdvancedSetup={() => {
          setTaskView('setup');
          setShowAdvancedSheetState(true);
        }}
        onOpenDetailedChanges={() => {
          setTaskView('scene-history');
          setShowAdvancedSheetState(true);
        }}
        onOpenWorldBible={() => navigate('/world-bible')}
      />
    );
  }

  const content = (
    <>
      {!embedded && <h1>Advanced sheet and state</h1>}
      <button type='button' onClick={() => setShowAdvancedSheetState(false)}>
        Return to simple scene changes
      </button>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />

      <RulesetReferencePanel
        activeProject={activeProject}
        ruleset={ruleset}
        memory={rulesetMemory}
      />

      <div className={styles.taskSwitch} aria-label='Character sheet task'>
        <button
          type='button'
          onClick={() => setTaskView('setup')}
          className={taskView === 'setup' ? styles.taskSwitchActive : ''}
        >
          Build character sheet
        </button>
        <button
          type='button'
          onClick={() => setTaskView('scene-history')}
          className={taskView === 'scene-history' ? styles.taskSwitchActive : ''}
        >
          Record scene changes
        </button>
      </div>
      <p className={styles.taskHint}>
        {taskView === 'setup'
          ? 'Set the character’s baseline level, attributes, resources, and optional equipment.'
          : 'Record or repair a detailed accepted change tied to a manuscript scene.'}
      </p>

      <div className={styles.workspace}>
        <CharacterSheetEditorForm
          editor={editor}
          ruleset={ruleset}
          runtimeModifiers={runtimeModifiers}
          compendiumEntries={compendiumEntries}
          hidden={taskView !== 'setup'}
        />
        <SceneChangePanel
          sceneChanges={sceneChanges}
          sheets={sheets}
          ruleset={ruleset}
          placeNames={data.placeNames}
          hidden={taskView !== 'scene-history'}
        />
        <CharacterSheetList
          taskView={taskView}
          sheets={sheets}
          ruleset={ruleset}
          runtimeModifiers={runtimeModifiers}
          deletingSheetId={editor.deletingSheetId}
          onEdit={handleEdit}
          onDelete={editor.handleDelete}
        />
      </div>
    </>
  );

  return embedded ? (
    <>
      {content}
      {confirmDialog}
    </>
  ) : (
    <section>
      {content}
      {confirmDialog}
    </section>
  );
}

export default CharacterSheetsRoute;
