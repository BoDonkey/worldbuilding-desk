import type {CharacterSheet, StoredRuleset} from '../../entityTypes';
import {hashString} from '../../services/characters/characterSheetDefaults';
import type {CharacterSheetSceneChanges} from '../../hooks/useCharacterSheetSceneChanges';
import {MutationForm} from './MutationForm';
import {SceneChangeHistory} from './SceneChangeHistory';
import styles from '../../styles/CharacterSheetsRoute.module.css';

interface SceneChangePanelProps {
  sceneChanges: CharacterSheetSceneChanges;
  sheets: CharacterSheet[];
  ruleset: StoredRuleset;
  placeNames: string[];
  hidden: boolean;
}

/**
 * "Record scene changes": draft a detailed change against a sheet and scene,
 * preview it and the replayed state, then record it.
 */
export function SceneChangePanel({sceneChanges, sheets, ruleset, placeNames, hidden}: SceneChangePanelProps) {
  const {
    editingMutationEventId, mutationTargetSheetId, setMutationTargetSheetId,
    mutationSceneId, setMutationSceneId, orderedDocuments, mutationType, setMutationType,
    mutationResourceDefinitionId, setMutationResourceDefinitionId,
    mutationStatDefinitionId, setMutationStatDefinitionId,
    mutationNumberValue, setMutationNumberValue, mutationTextValue, setMutationTextValue,
    mutationBooleanValue, setMutationBooleanValue, mutationStatusName, setMutationStatusName,
    mutationItemName, setMutationItemName, mutationQuantity, setMutationQuantity,
    mutationLocationName, setMutationLocationName, selectedMutationStatDefinition,
    selectedMutationValueSummary, selectedMutationScene, mutationPreviewIssues,
    replayedStateAtSelectedScene, isSavingMutation, handleSaveMutation, resetMutationForm
  } = sceneChanges;

  return (
    <section className={`${styles.historyPanel} ${hidden ? styles.hidden : ''}`}>
      <MutationForm
        editingMutationEventId={editingMutationEventId}
        mutationTargetSheetId={mutationTargetSheetId}
        setMutationTargetSheetId={setMutationTargetSheetId}
        sheets={sheets}
        mutationSceneId={mutationSceneId}
        setMutationSceneId={setMutationSceneId}
        orderedDocuments={orderedDocuments}
        mutationType={mutationType}
        setMutationType={setMutationType}
        mutationResourceDefinitionId={mutationResourceDefinitionId}
        setMutationResourceDefinitionId={setMutationResourceDefinitionId}
        mutationStatDefinitionId={mutationStatDefinitionId}
        setMutationStatDefinitionId={setMutationStatDefinitionId}
        mutationNumberValue={mutationNumberValue}
        setMutationNumberValue={setMutationNumberValue}
        mutationTextValue={mutationTextValue}
        setMutationTextValue={setMutationTextValue}
        mutationBooleanValue={mutationBooleanValue}
        setMutationBooleanValue={setMutationBooleanValue}
        mutationStatusName={mutationStatusName}
        setMutationStatusName={setMutationStatusName}
        mutationItemName={mutationItemName}
        setMutationItemName={setMutationItemName}
        mutationQuantity={mutationQuantity}
        setMutationQuantity={setMutationQuantity}
        mutationLocationName={mutationLocationName}
        setMutationLocationName={setMutationLocationName}
        ruleset={ruleset}
        selectedMutationStatDefinition={selectedMutationStatDefinition}
        placeNames={placeNames}
      />
      <div
        className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgPrimary} ${styles.inlineBorder1pxSolidVarColorBorder} ${styles.inlineFontSize09rem}`}
      >
        <strong>Preview</strong>
        <div className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary}`}>
          {selectedMutationValueSummary ||
            'Select a sheet, scene, and change details to preview the mutation.'}
        </div>
        {selectedMutationScene && (
          <div
            className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary} ${styles.inlineFontSize082rem}`}
          >
            Scene revision source: {selectedMutationScene.updatedAt} · hash{' '}
            {hashString(selectedMutationScene.content)}
          </div>
        )}
      </div>

      {mutationPreviewIssues.length > 0 && (
        <div
          role='alert'
          className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBorder1pxSolidVarColorErrorSoftBorder} ${styles.inlineBackgroundColorVarColorErrorSoftBg} ${styles.inlineColorVarColorError} ${styles.inlineFontSize09rem}`}
        >
          <strong>Change needs attention</strong>
          <ul className={`${styles.inlineMargin05rem001rem} ${styles.inlinePadding0}`}>
            {mutationPreviewIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding075rem} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgPrimary} ${styles.inlineBorder1pxSolidVarColorBorder} ${styles.inlineFontSize09rem}`}
      >
        <strong>Replayed state at end of selected scene</strong>
        {!replayedStateAtSelectedScene ? (
          <div className={`${styles.inlineMarginTop035rem} ${styles.inlineColorVarColorTextSecondary}`}>
            Select a sheet and scene to inspect the replayed state timeline.
          </div>
        ) : (
          <>
            <div className={styles.inlineMarginTop04rem}>
              <strong>Stats:</strong>
              <div
                className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumnsRepeat2Minmax01fr} ${styles.inlineGap025rem} ${styles.inlineMarginTop025rem}`}
              >
                {Object.entries(replayedStateAtSelectedScene.stats).map(
                  ([key, value]) => (
                    <span key={key}>
                      {key}: {String(value)}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className={styles.inlineMarginTop06rem}>
              <strong>Resources:</strong>
              <div
                className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumnsRepeat2Minmax01fr} ${styles.inlineGap025rem} ${styles.inlineMarginTop025rem}`}
              >
                {Object.entries(replayedStateAtSelectedScene.resources.current).map(
                  ([key, current]) => (
                    <span key={key}>
                      {key}: {current}/
                      {replayedStateAtSelectedScene.resources.max[key] ?? current}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className={styles.inlineMarginTop06rem}>
              <strong>Statuses:</strong>{' '}
              {replayedStateAtSelectedScene.statuses.join(', ') || 'none'}
            </div>

            <div className={styles.inlineMarginTop06rem}>
              <strong>Inventory:</strong>{' '}
              {replayedStateAtSelectedScene.inventory.items.length > 0
                ? replayedStateAtSelectedScene.inventory.items
                    .map((item) =>
                      item.quantity > 1
                        ? `${item.name} x${item.quantity}`
                        : item.name
                    )
                    .join(', ')
                : 'none'}
            </div>

            <div className={styles.inlineMarginTop06rem}>
              <strong>Equipped:</strong>{' '}
              {replayedStateAtSelectedScene.inventory.equipped.join(', ') ||
                'none'}
            </div>

            <div className={styles.inlineMarginTop06rem}>
              <strong>Location:</strong>{' '}
              {replayedStateAtSelectedScene.locationName || 'unset'}
            </div>
          </>
        )}
      </div>

      <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap075rem}`}>
        <button
          type='button'
          onClick={() => void handleSaveMutation()}
          disabled={
            isSavingMutation || !mutationTargetSheetId || !mutationSceneId
          }
        >
          {isSavingMutation
            ? 'Saving…'
            : editingMutationEventId
              ? 'Update State Change'
              : 'Record State Change'}
        </button>
        <button type='button' onClick={() => resetMutationForm()}>
          {editingMutationEventId ? 'Cancel Edit' : 'Reset Change'}
        </button>
      </div>

      <SceneChangeHistory sceneChanges={sceneChanges} />
    </section>
  );
}
