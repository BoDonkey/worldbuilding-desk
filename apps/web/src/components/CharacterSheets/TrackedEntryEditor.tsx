import {useState} from 'react';
import type {CharacterTrackedEntry, CompendiumEntry} from '../../entityTypes';
import type {TrackedEntryTarget} from '../../hooks/useCharacterSheetEditor';
import styles from '../../styles/CharacterSheetsRoute.module.css';

const COPY: Record<TrackedEntryTarget, {
  heading: string;
  quickPlaceholder: string;
  quickButton: string;
  catalogPlaceholder: string;
  catalogButton: string;
}> = {
  inventory: {
    heading: 'Inventory',
    quickPlaceholder: 'Quick add item',
    quickButton: 'Add item',
    catalogPlaceholder: 'Add from Mechanics...',
    catalogButton: 'Add catalog item'
  },
  equipment: {
    heading: 'Equipment',
    quickPlaceholder: 'Quick add equipment',
    quickButton: 'Add equipment',
    catalogPlaceholder: 'Add from Mechanics...',
    catalogButton: 'Add catalog equipment'
  },
  status: {
    heading: 'Statuses',
    quickPlaceholder: 'Quick add status',
    quickButton: 'Add status',
    catalogPlaceholder: 'Add status from Mechanics...',
    catalogButton: 'Add catalog status'
  }
};

interface TrackedEntryEditorProps {
  target: TrackedEntryTarget;
  entries: CharacterTrackedEntry[];
  catalogOptions: CompendiumEntry[];
  /** Returns false when nothing was added, so the input keeps its text. */
  onAddQuick: (name: string, quantity: number) => boolean;
  onAddCatalog: (entryId: string) => boolean;
  onRemove: (entryId: string) => void;
  className?: string;
}

/**
 * One starting-state list on the sheet form (inventory, equipment, or
 * statuses): type an entry, or pick one linked to a Mechanics record.
 * Only inventory entries carry a quantity.
 */
export function TrackedEntryEditor({
  target,
  entries,
  catalogOptions,
  onAddQuick,
  onAddCatalog,
  onRemove,
  className
}: TrackedEntryEditorProps) {
  const copy = COPY[target];
  const withQuantity = target === 'inventory';
  const [quickName, setQuickName] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [catalogId, setCatalogId] = useState('');

  return (
    <div className={className}>
      <strong className={`${styles.inlineDisplayBlock} ${styles.inlineMarginBottom035rem}`}>
        {copy.heading}
      </strong>
      <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
        <input
          type='text'
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          placeholder={copy.quickPlaceholder}
          className={styles.inlineFlex1}
        />
        {withQuantity && (
          <input
            type='number'
            min={1}
            value={quickQuantity}
            onChange={(e) => setQuickQuantity(Math.max(1, Number(e.target.value) || 1))}
            className={styles.inlineWidth5rem}
          />
        )}
        <button
          type='button'
          onClick={() => {
            if (onAddQuick(quickName, withQuantity ? quickQuantity : 1)) {
              setQuickName('');
              setQuickQuantity(1);
            }
          }}
        >
          {copy.quickButton}
        </button>
      </div>
      <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap04rem} ${styles.inlineMarginBottom035rem}`}>
        <select
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value)}
          className={styles.inlineFlex1}
        >
          <option value=''>{copy.catalogPlaceholder}</option>
          {catalogOptions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button
          type='button'
          onClick={() => {
            if (onAddCatalog(catalogId)) {
              setCatalogId('');
            }
          }}
        >
          {copy.catalogButton}
        </button>
      </div>
      {entries.length > 0 && (
        <ul className={`${styles.inlineMargin0} ${styles.inlinePaddingLeft1rem}`}>
          {entries.map((entry) => (
            <li key={entry.id}>
              {entry.name}
              {withQuantity && entry.quantity && entry.quantity > 1 ? ` x${entry.quantity}` : ''}
              {entry.mode === 'cataloged' ? ' (catalog)' : ''}
              <button
                type='button'
                onClick={() => onRemove(entry.id)}
                className={`${styles.inlineMarginLeft045rem} ${styles.inlineFontSize075rem}`}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
