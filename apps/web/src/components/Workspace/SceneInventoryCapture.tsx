import {useState} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';

interface SceneInventoryCaptureProps {
  itemName: string;
  characters: Array<{sheetId: string; name: string}>;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: {sheetId: string; itemName: string; quantity: number}) => void;
}

export function SceneInventoryCapture({
  itemName: initialItemName,
  characters,
  isSaving,
  onCancel,
  onSave
}: SceneInventoryCaptureProps) {
  const [itemName, setItemName] = useState(initialItemName);
  const [sheetId, setSheetId] = useState(characters[0]?.sheetId ?? '');
  const [quantity, setQuantity] = useState(1);

  return (
    <div className={`${styles.modalCard} ${styles.changeComposerCard}`}>
      <h3 className={styles.modalTitle}>Add item to inventory</h3>
      <p className={styles.modalDescription}>
        Record this pickup at the selected passage in the scene.
      </p>
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
      <div className={styles.modalActions}>
        <button type='button' onClick={onCancel}>Cancel</button>
        <button
          type='button'
          disabled={isSaving || !sheetId || !itemName.trim()}
          onClick={() => onSave({sheetId, itemName: itemName.trim(), quantity})}
        >
          {isSaving ? 'Adding…' : 'Add at selection'}
        </button>
      </div>
    </div>
  );
}
