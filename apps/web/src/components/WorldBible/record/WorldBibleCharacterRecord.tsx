import {useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {NavigateFunction} from 'react-router';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  StoredRuleset,
  WritingDocument
} from '../../../entityTypes';
import {useAppStore} from '../../../store/appStore';
import {createFirstCharacterMechanics} from '../../../services/characters';
import {describeError} from '../../../services/errors';
import type {MemoryEntry} from '../../../services/shodh/ShodhMemoryService';
import {
  CHARACTER_AUTHORING_FIELD_KEYS,
  CHARACTER_IDENTITY_FIELD_KEYS,
  CHARACTER_NOTES_FIELD
} from '../../../services/worldBible/worldBibleSummary';
import styles from './WorldBibleCharacterRecord.module.css';
import {EntityFieldEditor} from '../EntityFieldEditor';
import {WorldBibleCharacterSections} from '../WorldBibleCharacterSections';
import {CharacterCardExportButton} from '../CharacterCardExportButton';
import {WorldBibleDialogueStyleControl} from '../WorldBibleDialogueStyleControl';
import {WorldBibleLinkedSourceNote} from '../WorldBibleLinkedSourceNote';
import {WorldBibleCharacterHealth} from '../WorldBibleCharacterHealth';
import {WorldBibleMechanicsPanel} from '../WorldBibleMechanicsPanel';
import type {WorldBibleRecordDraft} from './useWorldBibleRecordDraft';
import type {
  OpenRecord,
  RecordAuthoring,
  RecordEntityActions,
  RecordResolution,
  RecordSelection,
  SetRecordFeedback
} from './recordTypes';
import {RecordNamesSection} from './RecordNamesSection';
import {RecordSectionBuilder} from './RecordSectionBuilder';

type CategoryField = EntityCategory['fieldSchema'][number];

export interface WorldBibleCharacterRecordProps {
  activeProject: Project;
  projectSettings: ProjectSettings | null;
  category: EntityCategory;
  categories: EntityCategory[];
  writingDocuments: WritingDocument[];
  draft: WorldBibleRecordDraft;
  selection: RecordSelection;
  authoring: RecordAuthoring;
  resolution: RecordResolution;
  entityActions: RecordEntityActions;
  currentEntityMemories: MemoryEntry[];
  canProbe: boolean;
  canUseMechanics: boolean;
  aiCoaching: boolean;
  ruleset: StoredRuleset | null;
  hasRuleset: boolean;
  setRuleset: (ruleset: StoredRuleset) => void;
  setCharacterSheets: Dispatch<SetStateAction<CharacterSheet[]>>;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setFeedback: SetRecordFeedback;
  onEdit: OpenRecord;
  onOpenLab: (entityId: string) => void;
  navigate: NavigateFunction;
}

/**
 * A character's canonical home in World Bible: canon and aliases, notes,
 * continuity, optional mechanics, and writing aids, each in its own tab.
 */
export function WorldBibleCharacterRecord({
  activeProject,
  projectSettings,
  category,
  categories,
  writingDocuments,
  draft,
  selection,
  authoring,
  resolution,
  entityActions,
  currentEntityMemories,
  canProbe,
  canUseMechanics,
  aiCoaching,
  ruleset,
  hasRuleset,
  setRuleset,
  setCharacterSheets,
  setCharacters,
  setFeedback,
  onEdit,
  onOpenLab,
  navigate
}: WorldBibleCharacterRecordProps) {
  const [isCreatingFirstMechanics, setIsCreatingFirstMechanics] = useState(false);
  const {
    selectedEntity,
    selectedEntityCharacterExtension,
    selectedEntityCharacterSheet,
    linkedLoreDocumentByEntityId,
    linkedLoreDocumentsForSelectedEntity,
    selectedEntityAliases,
    selectedEntityFacts,
    selectedEntitySceneMentions,
    selectedEntityStateEvents,
    selectedEntityCurrentState,
    selectedEntityAcceptedStateEventCount,
    selectedEntityProposedStateEventCount,
    characterHealthProbeResults,
    characterHealthProbeRunning,
    handleCharacterHealthProbe,
    linkingLoreEntityId,
    handleOpenOrCreateLinkedLoreDocument
  } = selection;
  const {
    exportingCharacterEntityId,
    importingCharacterEntityId,
    handleExportCharacter,
    handleImportEntityToCharacters
  } = entityActions;

  const findField = (key: string) =>
    category.fieldSchema.find((field) => field.key === key) ?? null;
  const descriptionField = findField('description');
  const notesField = findField(CHARACTER_NOTES_FIELD);
  const identityFields = CHARACTER_IDENTITY_FIELD_KEYS.map((key) => findField(key))
    .filter((field): field is CategoryField => Boolean(field));
  const customFields = category.fieldSchema.filter(
    (field) => !CHARACTER_AUTHORING_FIELD_KEYS.has(field.key)
  );
  const renderEntityField = (field: CategoryField) => (
    <EntityFieldEditor
      key={field.key}
      field={field}
      fieldValues={draft.fieldValues}
      variant='character'
      onFieldValuesChange={draft.setFieldValues}
    />
  );

  return (
    <WorldBibleCharacterSections
      activeSection={draft.characterDetailSection}
      onSectionChange={draft.setCharacterDetailSection}
      isSaved={Boolean(selectedEntity)}
      characterName={draft.name.trim() || selectedEntity?.name || 'New character'}
      canUseMechanics={canUseMechanics}
      characterExtension={selectedEntityCharacterExtension}
      characterSheet={selectedEntityCharacterSheet}
      linkedNoteCount={linkedLoreDocumentsForSelectedEntity.length}
      sceneMentionCount={selectedEntitySceneMentions.length}
      stateEventCount={selectedEntityStateEvents.length}
      isExporting={Boolean(selectedEntity && exportingCharacterEntityId === selectedEntity.id)}
      onExport={() => {
        if (selectedEntity) void handleExportCharacter(selectedEntity);
      }}
      cardExportAction={
        selectedEntity ? <CharacterCardExportButton projectId={activeProject.id} entityId={selectedEntity.id} /> : null
      }
      labAction={
        selectedEntity && aiCoaching ? (
          <button type='button' onClick={() => onOpenLab(selectedEntity.id)}>
            Talk to {selectedEntity.name}
          </button>
        ) : null
      }
      dialogueStyleContent={
        selectedEntity ? (
          <WorldBibleDialogueStyleControl
            entity={selectedEntity}
            characterExtension={selectedEntityCharacterExtension}
            characterStyles={projectSettings?.characterStyles ?? []}
            onSaved={(character, message) => {
              setCharacters((current) => current.some((entry) => entry.id === character.id)
                ? current.map((entry) => entry.id === character.id ? character : entry)
                : [...current, character]);
              setFeedback({tone: 'success', message});
            }}
            onManageStyles={() => navigate('/settings')}
          />
        ) : null
      }
      canonContent={
        <>
          <RecordNamesSection
            variant='character'
            recordLabel={authoring.activeCategoryRecordLabel}
            currentCharacterLabel={authoring.currentCharacterLabel}
            category={category}
            categories={categories}
            showNameInput
            draft={draft}
            selectedEntity={selectedEntity}
            selectedEntityAliases={selectedEntityAliases}
            resolution={resolution}
            entityActions={entityActions}
            onEdit={onEdit}
          />

          {identityFields.length > 0 && (
            <div className={styles.identityGrid}>
              {identityFields.map(renderEntityField)}
            </div>
          )}

          {descriptionField && renderEntityField(descriptionField)}
          {customFields.map(renderEntityField)}

          <RecordSectionBuilder variant='character' authoring={authoring} />
        </>
      }
      notesContent={
        <>
          {notesField && renderEntityField(notesField)}

          {selectedEntity && (
            <WorldBibleLinkedSourceNote
              entity={selectedEntity}
              linkedDocument={linkedLoreDocumentByEntityId.get(selectedEntity.id) ?? null}
              isOpening={linkingLoreEntityId === selectedEntity.id}
              compactCopy
              onOpen={(entity) => void handleOpenOrCreateLinkedLoreDocument(entity)}
            />
          )}
        </>
      }
      continuityContent={
        <WorldBibleCharacterHealth
          selectedEntity={selectedEntity}
          selectedEntityAliases={selectedEntityAliases}
          selectedEntityFacts={selectedEntityFacts}
          linkedLoreDocumentsForSelectedEntity={linkedLoreDocumentsForSelectedEntity}
          selectedEntitySceneMentions={selectedEntitySceneMentions}
          selectedEntityStateEvents={selectedEntityStateEvents}
          selectedEntityCurrentState={selectedEntityCurrentState}
          selectedEntityAcceptedStateEventCount={selectedEntityAcceptedStateEventCount}
          selectedEntityProposedStateEventCount={selectedEntityProposedStateEventCount}
          characterHealthProbeResults={characterHealthProbeResults}
          characterHealthProbeRunning={characterHealthProbeRunning}
          currentEntityMemories={currentEntityMemories}
          documents={writingDocuments}
          canProbe={canProbe}
          handleCharacterHealthProbe={handleCharacterHealthProbe}
          onOpenScene={(sceneId) => navigate('/workspace', {state: {focusDocumentId: sceneId}})}
        />
      }
      mechanicsContent={
        selectedEntity ? (
          <WorldBibleMechanicsPanel
            key={selectedEntity.id}
            characterSheet={selectedEntityCharacterSheet}
            ruleset={ruleset}
            hasRuleset={hasRuleset}
            stateEventCount={selectedEntityStateEvents.length}
            stateEvents={selectedEntityStateEvents}
            isSaving={isCreatingFirstMechanics}
            isOpeningSheet={Boolean(selectedEntity && importingCharacterEntityId === selectedEntity.id)}
            onCreate={async (input) => {
              setIsCreatingFirstMechanics(true);
              setFeedback(null);
              try {
                const created = await createFirstCharacterMechanics({
                  project: activeProject,
                  character: selectedEntity,
                  ...input
                });
                useAppStore.setState({activeProject: created.project});
                setRuleset({...created.ruleset, projectId: activeProject.id});
                setCharacterSheets((current) => [...current, created.sheet]);
                setFeedback({tone: 'success', message: `${input.name} is now tracked for ${selectedEntity.name}.`});
              } catch (error) {
                setFeedback({tone: 'error', message: describeError(error, 'Unable to enable mechanics tracking.')});
              } finally {
                setIsCreatingFirstMechanics(false);
              }
            }}
            onRecordChange={() => navigate('/sheets', {state: {
              prefillSheetId: selectedEntityCharacterSheet?.id,
              initialTaskView: 'scene-history'
            }})}
            onOpenAdvanced={() => navigate('/sheets', {state: {
              prefillSheetId: selectedEntityCharacterSheet?.id,
              showAdvanced: true
            }})}
            onAddSheet={() => void handleImportEntityToCharacters(selectedEntity, {autoCreateSheet: true})}
            projectId={activeProject.id}
            entityId={selectedEntity.id}
          />
        ) : null
      }
    />
  );
}
