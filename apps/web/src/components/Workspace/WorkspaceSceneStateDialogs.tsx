import {useCallback, useMemo, useRef} from 'react';
import type {CompendiumEntry, EntityCategory, StoredRuleset, WorldEntity} from '../../entityTypes';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import type {useWorkspaceSceneCursor} from '../../hooks/useWorkspaceSceneCursor';
import type {useWorkspaceSceneRoster} from '../../hooks/useWorkspaceSceneRoster';
import {resolveReusableItem} from '../../services/state/itemStateAuthoringService';
import {isItemCategory} from '../../services/worldBible/worldBibleSummary';
import styles from '../../styles/WorkspaceRoute.module.css';
import {PositionedStateChangeComposer} from './PositionedStateChangeComposer';
import {SceneConsumptionCapture} from './SceneConsumptionCapture';
import {SceneInventoryCapture} from './SceneInventoryCapture';

type SceneRoster = ReturnType<typeof useWorkspaceSceneRoster>;

interface WorkspaceSceneStateDialogsProps {
  sceneRoster: SceneRoster;
  /** The cursor position and the pending dialogs. */
  sceneCursor: ReturnType<typeof useWorkspaceSceneCursor>;
  sceneTitle: string;
  ruleset: StoredRuleset | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  compendiumEntries: CompendiumEntry[];
}

/**
 * The two dialogs that record a scene state change from the editor: a
 * change at the cursor for one character, and an item picked up or used
 * from selected text (matched against reusable World Bible items and
 * compendium entries first). Each closes on Escape and keeps focus inside.
 */
export function WorkspaceSceneStateDialogs({
  sceneRoster,
  sceneCursor,
  sceneTitle,
  ruleset,
  categories,
  entities,
  compendiumEntries
}: WorkspaceSceneStateDialogsProps) {
  const {
    sceneCursorPosition,
    pendingPositionedChange,
    setPendingPositionedChange,
    isSavingPositionedChange,
    pendingInventoryCapture,
    setPendingInventoryCapture,
    isSavingInventoryCapture
  } = sceneCursor;
  const {
    pendingPositionedSheet,
    positionedChangeBefore,
    savePositionedChange,
    inventoryCaptureCharacters,
    inventoryCaptureContexts,
    saveSelectionInventoryCapture,
    saveSelectionConsumptionCapture
  } = sceneRoster;
  const positionedChangeDialogRef = useRef<HTMLDivElement | null>(null);
  const inventoryCaptureDialogRef = useRef<HTMLDivElement | null>(null);

  const pendingInventoryResolution = useMemo(
    () => pendingInventoryCapture
      ? resolveReusableItem({
          itemName: pendingInventoryCapture.itemName,
          categories,
          entities,
          compendiumEntries
        })
      : null,
    [categories, compendiumEntries, entities, pendingInventoryCapture]
  );
  const exactReusableInventoryEntity = pendingInventoryResolution?.status === 'exact' &&
    pendingInventoryResolution.sourceEntityId
    ? entities.find(
        (entity) => entity.id === pendingInventoryResolution.sourceEntityId
      ) ?? null
    : null;
  const pendingConsumableEntry = pendingInventoryResolution?.status === 'exact' &&
    pendingInventoryResolution.definitionId
    ? compendiumEntries.find(
        (entry) => entry.id === pendingInventoryResolution.definitionId
      ) ?? null
    : null;

  const isPositionedChangeDialogOpen = Boolean(
    pendingPositionedChange && pendingPositionedSheet && positionedChangeBefore
  );
  const closePositionedChangeDialog = useCallback(() => {
    setPendingPositionedChange(null);
  }, [setPendingPositionedChange]);

  const isInventoryCaptureDialogOpen = Boolean(pendingInventoryCapture);
  const closeInventoryCaptureDialog = useCallback(() => {
    setPendingInventoryCapture(null);
  }, [setPendingInventoryCapture]);

  useEscapeToClose(closePositionedChangeDialog, isPositionedChangeDialogOpen);
  useFocusTrap(positionedChangeDialogRef, isPositionedChangeDialogOpen);

  useEscapeToClose(closeInventoryCaptureDialog, isInventoryCaptureDialogOpen);
  useFocusTrap(inventoryCaptureDialogRef, isInventoryCaptureDialogOpen);

  return (
    <>
      {pendingPositionedChange && pendingPositionedSheet && positionedChangeBefore && (
        <div
          ref={positionedChangeDialogRef}
          role='dialog'
          aria-modal='true'
          aria-label='Record positioned state change'
          onClick={() => setPendingPositionedChange(null)}
          className={styles.modalOverlay}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <PositionedStateChangeComposer
              key={pendingPositionedChange.event?.id ?? `new-${sceneCursorPosition}`}
              characterName={pendingPositionedChange.character.name}
              sceneTitle={sceneTitle}
              cursorPosition={pendingPositionedChange.event?.scenePosition ?? sceneCursorPosition}
              actorId={pendingPositionedSheet.characterEntityId ?? ''}
              ruleset={ruleset}
              before={positionedChangeBefore}
              existingEvent={pendingPositionedChange.event}
              initialLabel={pendingPositionedChange.initialLabel}
              initialCommands={pendingPositionedChange.initialCommands}
              isSaving={isSavingPositionedChange}
              onCancel={() => setPendingPositionedChange(null)}
              onSave={(input) => void savePositionedChange(input)}
            />
          </div>
        </div>
      )}

      {pendingInventoryCapture && (
        <div
          ref={inventoryCaptureDialogRef}
          role='dialog'
          aria-modal='true'
          aria-label={pendingInventoryCapture.action === 'consume'
            ? 'Record selected item use'
            : 'Add selected item to inventory'}
          onClick={() => setPendingInventoryCapture(null)}
          className={styles.modalOverlay}
        >
          <div onClick={(event) => event.stopPropagation()}>
            {pendingInventoryCapture.action === 'consume' ? (
              <SceneConsumptionCapture
                key={`consume:${pendingInventoryCapture.position}:${pendingInventoryCapture.itemName}`}
                itemName={pendingInventoryCapture.itemName}
                evidenceText={pendingInventoryCapture.evidenceText}
                contexts={inventoryCaptureContexts}
                suggestedSheetId={pendingInventoryCapture.suggestedSheetId}
                ruleset={ruleset}
                approvedEntry={pendingConsumableEntry}
                itemReference={{
                  sourceEntityId: pendingInventoryResolution?.status === 'exact'
                    ? pendingInventoryResolution.sourceEntityId
                    : undefined,
                  definitionId: pendingInventoryResolution?.status === 'exact'
                    ? pendingInventoryResolution.definitionId
                    : undefined
                }}
                exactReusableItem={exactReusableInventoryEntity}
                reusableItemMatches={pendingInventoryResolution?.entityMatches ?? []}
                canCreateReusableItem={categories.some(isItemCategory)}
                isSaving={isSavingInventoryCapture}
                onCancel={() => setPendingInventoryCapture(null)}
                onSave={(input) => void saveSelectionConsumptionCapture(input)}
              />
            ) : (
              <SceneInventoryCapture
                key={`acquire:${pendingInventoryCapture.position}:${pendingInventoryCapture.itemName}`}
                itemName={pendingInventoryCapture.itemName}
                characters={inventoryCaptureCharacters}
                evidenceText={pendingInventoryCapture.evidenceText}
                suggestedSheetId={pendingInventoryCapture.suggestedSheetId}
                exactReusableItem={exactReusableInventoryEntity}
                reusableItemMatches={pendingInventoryResolution?.entityMatches ?? []}
                canCreateReusableItem={categories.some(isItemCategory)}
                isSaving={isSavingInventoryCapture}
                onCancel={() => setPendingInventoryCapture(null)}
                onSave={(input) => void saveSelectionInventoryCapture(input)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
