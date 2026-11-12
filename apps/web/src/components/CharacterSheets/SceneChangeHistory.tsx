import {summarizeMutationCommand} from '../../services/state/kinds';
import type {CharacterSheetSceneChanges} from '../../hooks/useCharacterSheetSceneChanges';
import styles from '../../styles/CharacterSheetsRoute.module.css';

/** Recorded scene changes for the selected sheet, with edit, reorder, and invalidate. */
export function SceneChangeHistory({sceneChanges}: {sceneChanges: CharacterSheetSceneChanges}) {
  const {
    mutationTargetSheetId, selectedSheetMutationHistory, reorderingMutationEventId,
    invalidatingMutationEventId, loadMutationEventIntoForm, handleMoveMutationEvent,
    handleInvalidateMutationEvent
  } = sceneChanges;

  return (
    <div className={styles.inlineMarginTop1rem}>
      <h3 className={styles.inlineMarginBottom05rem}>Recorded scene changes</h3>
      {!mutationTargetSheetId ? (
        <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
          Select a character to inspect recorded scene changes.
        </p>
      ) : selectedSheetMutationHistory.length === 0 ? (
        <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
          No recorded scene changes yet for this character.
        </p>
      ) : (
        <ul className={`${styles.inlineListStyleNone} ${styles.inlinePadding0} ${styles.inlineMargin0}`}>
          {selectedSheetMutationHistory.map(
            ({event, canMoveUp, canMoveDown, staleness, stalenessLabel, progressionLabel}) => (
            <li
              key={event.id}
              className={`${styles.mutationEvent} ${
                event.status === 'invalidated'
                  ? styles.mutationEventInvalidated
                  : ''
              }`}
            >
              <div
                className={`${styles.inlineDisplayFlex} ${styles.inlineJustifyContentSpaceBetween} ${styles.inlineGap075rem} ${styles.inlineAlignItemsFlexStart}`}
              >
                <div className={styles.inlineFlex1}>
                  <div className={`${styles.inlineFontSize092rem} ${styles.inlineFontWeight600}`}>
                    {event.sceneOrder ? `${event.sceneOrder}. ` : ''}
                    {event.sceneTitle || 'Untitled scene'}
                    {event.sceneSequence ? ` · Step ${event.sceneSequence}` : ''}
                  </div>
                  <div
                    className={`${styles.inlineMarginTop025rem} ${styles.inlineFontSize082rem} ${styles.inlineColorVarColorTextSecondary}`}
                  >
                    Status: {event.status}
                    {event.invalidationReason
                      ? ` · ${event.invalidationReason}`
                      : ''}
                  </div>
                  {stalenessLabel && event.status !== 'invalidated' && (
                    <div
                      className={`${styles.inlineMarginTop03rem} ${styles.inlineDisplayInlineBlock} ${styles.inlineFontSize078rem} ${styles.inlineColorVarColorWarning} ${styles.inlineBackgroundColorVarColorWarningSoftBg} ${styles.inlineBorder1pxSolidVarColorWarningSoftBorder} ${styles.inlineBorderRadius999px} ${styles.inlinePadding01rem045rem}`}
                    >
                      Stale: {stalenessLabel}
                    </div>
                  )}
                  <ul
                    className={`${styles.inlineMargin05rem000} ${styles.inlinePaddingLeft1rem} ${styles.inlineFontSize09rem}`}
                  >
                    {event.commands.map((command, index) => (
                      <li key={`${event.id}-${index}`}>
                        {summarizeMutationCommand(command)}
                      </li>
                    ))}
                    {progressionLabel && <li>{progressionLabel}</li>}
                  </ul>
                </div>
                <div>
                  <button
                    type='button'
                    onClick={() => loadMutationEventIntoForm(event)}
                    className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
                    disabled={event.status === 'invalidated'}
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleMoveMutationEvent(event, -1)}
                    className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
                    disabled={
                      !canMoveUp ||
                      event.status === 'invalidated' ||
                      reorderingMutationEventId === event.id
                    }
                  >
                    Up
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleMoveMutationEvent(event, 1)}
                    className={`${styles.inlineFontSize08rem} ${styles.inlineMarginRight035rem}`}
                    disabled={
                      !canMoveDown ||
                      event.status === 'invalidated' ||
                      reorderingMutationEventId === event.id
                    }
                  >
                    Down
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleInvalidateMutationEvent(event)}
                    disabled={
                      event.status === 'invalidated' ||
                      invalidatingMutationEventId === event.id
                    }
                    className={styles.inlineFontSize08rem}
                  >
                    {invalidatingMutationEventId === event.id
                      ? 'Invalidating...'
                      : event.status === 'invalidated'
                        ? 'Invalidated'
                        : staleness.isStale
                          ? 'Invalidate stale'
                          : 'Invalidate'}
                  </button>
                </div>
              </div>
            </li>
          )
          )}
        </ul>
      )}
    </div>
  );
}
