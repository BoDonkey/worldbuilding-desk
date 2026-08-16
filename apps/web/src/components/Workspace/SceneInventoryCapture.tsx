import {useState} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';

interface SceneInventoryCaptureProps {
  itemName: string;
  characters: Array<{sheetId: string; name: string}>;
  evidenceText?: string;
  suggestedSheetId?: string;
  exactReusableItem?: {id: string; name: string} | null;
  reusableItemMatches: Array<{id: string; name: string}>;
  canCreateReusableItem: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: {
    sheetId: string;
    itemName: string;
    quantity: number;
    saveReusable: boolean;
    reusableEntityId?: string;
    canonicalName: string;
  }) => void;
}

export function SceneInventoryCapture({
  itemName: initialItemName,
  characters,
  evidenceText,
  suggestedSheetId,
  exactReusableItem,
  reusableItemMatches,
  canCreateReusableItem,
  isSaving,
  onCancel,
  onSave
}: SceneInventoryCaptureProps) {
  const [itemName, setItemName] = useState(initialItemName);
  const [sheetId, setSheetId] = useState(
    suggestedSheetId && characters.some((entry) => entry.sheetId === suggestedSheetId)
      ? suggestedSheetId
      : characters[0]?.sheetId ?? ''
  );
  const [quantity, setQuantity] = useState(1);
  const [saveReusable, setSaveReusable] = useState(false);
  const [canonicalName, setCanonicalName] = useState(initialItemName);
  const [reusableEntityId, setReusableEntityId] = useState(
    exactReusableItem?.id ?? ''
  );
  const needsReusableChoice = saveReusable && !exactReusableItem;
  const canConfirm = Boolean(
    sheetId && itemName.trim() &&
    (!needsReusableChoice || reusableEntityId || canCreateReusableItem)
  );

  return (
    <div className={`${styles.modalCard} ${styles.changeComposerCard}`}>
      <h3 className={styles.modalTitle}>Add item to inventory</h3>
      <p className={styles.modalDescription}>
        Record this pickup at the selected passage in the scene.
      </p>
      {evidenceText && evidenceText.trim() !== initialItemName.trim() && (
        <p className={styles.changeComposerEvidence}>“{evidenceText.trim()}”</p>
      )}
      <div className={styles.changeComposerFields}>
        <label>
          Item
          <input
            type='text'
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
          />
        </label>
        <label>
          Character
          <select value={sheetId} onChange={(event) => setSheetId(event.target.value)}>
            {characters.map((character) => (
              <option key={character.sheetId} value={character.sheetId}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input
            type='number'
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
      </div>
      {exactReusableItem ? (
        <div className={styles.changeComposerPreview}>
          <strong>Reusable item found</strong>
          <p>This pickup will stay linked to {exactReusableItem.name}.</p>
        </div>
      ) : (
        <div className={styles.changeComposerDisclosure}>
          <label>
            <input
              type='checkbox'
              checked={saveReusable}
              onChange={(event) => setSaveReusable(event.target.checked)}
            />
            Save as a reusable world item
          </label>
          {saveReusable && (
            <div className={styles.changeComposerFields}>
              <label>
                Reusable item
                <select
                  value={reusableEntityId}
                  onChange={(event) => setReusableEntityId(event.target.value)}
                >
                  {canCreateReusableItem && <option value=''>Create a new item</option>}
                  {!canCreateReusableItem && <option value=''>Choose an existing item…</option>}
                  {reusableItemMatches.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              {!reusableEntityId && canCreateReusableItem && (
                <label>
                  Canonical name
                  <input
                    type='text'
                    value={canonicalName}
                    onChange={(event) => setCanonicalName(event.target.value)}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
      <div className={styles.modalActions}>
        <button type='button' onClick={onCancel}>Cancel</button>
        <button
          type='button'
          disabled={isSaving || !canConfirm || (saveReusable && !reusableEntityId && !canonicalName.trim())}
          onClick={() => onSave({
            sheetId,
            itemName: itemName.trim(),
            quantity,
            saveReusable,
            reusableEntityId: reusableEntityId || undefined,
            canonicalName: canonicalName.trim()
          })}
        >
          {isSaving ? 'Adding…' : 'Add at selection'}
        </button>
      </div>
    </div>
  );
}
