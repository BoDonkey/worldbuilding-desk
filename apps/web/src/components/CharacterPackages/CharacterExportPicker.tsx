import {useMemo, useState} from 'react';
import {filterCharacterExportChoices} from '../../services/characters/characterExportChoices';
import routeStyles from '../../styles/CharactersRoute.module.css';
import styles from './CharacterExportPicker.module.css';
import {useCharacterExportChoices} from './useCharacterExportChoices';

interface CharacterExportPickerProps {
  projectId: string;
  keptSeparateKeys?: string[];
  canTransferSheets: boolean;
  /** Exports exactly these World Bible character ids. */
  onExport: (entityIds: string[], includeSheets: boolean) => Promise<void>;
}

/**
 * Pick which World Bible characters to export (Slice 4.87). Records in the
 * Needs canon link queue are listed without a checkbox: they are not World
 * Bible characters yet, so a selected export cannot carry them.
 */
export function CharacterExportPicker({projectId, keptSeparateKeys, canTransferSheets, onExport}: CharacterExportPickerProps) {
  const {status, data} = useCharacterExportChoices(projectId, keptSeparateKeys);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isExporting, setIsExporting] = useState(false);
  const shown = useMemo(() => filterCharacterExportChoices(data.choices, query), [data.choices, query]);
  // A character deleted while ticked drops out of the selection.
  const selectedIds = data.choices.filter((choice) => selected.has(choice.entityId)).map((choice) => choice.entityId);

  const toggle = (entityId: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(entityId)) next.delete(entityId);
    else next.add(entityId);
    return next;
  });
  const exportSelected = async (includeSheets: boolean) => {
    if (selectedIds.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      await onExport(selectedIds, includeSheets);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className={styles.picker} aria-labelledby='character-export-picker-title'>
      <h2 id='character-export-picker-title' className={styles.heading}>Choose characters to export</h2>
      {status === 'loading' && <p className={routeStyles.lead}>Loading characters…</p>}
      {status === 'error' && <p className={routeStyles.notice} role='alert'>Characters could not be loaded.</p>}
      {status === 'ready' && data.choices.length === 0 && (
        <p className={routeStyles.lead}>This project has no World Bible characters yet.</p>
      )}
      {status === 'ready' && data.choices.length > 0 && (
        <>
          <label className={routeStyles.fieldLabel}>
            Search characters
            <input
              type='search'
              className={routeStyles.softInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Name or alias'
            />
          </label>
          <div className={routeStyles.toolbar}>
            <button
              type='button'
              onClick={() => setSelected((previous) => new Set([...previous, ...shown.map((choice) => choice.entityId)]))}
              disabled={shown.length === 0}
            >
              {query.trim() ? 'Select all shown' : 'Select all'}
            </button>
            <button type='button' onClick={() => setSelected(new Set())} disabled={selectedIds.length === 0}>
              Clear
            </button>
            <span className={styles.count} role='status'>
              {selectedIds.length} of {data.choices.length} selected
            </span>
          </div>
          {shown.length === 0 ? (
            <p className={routeStyles.lead}>No characters match “{query.trim()}”.</p>
          ) : (
            <ul className={styles.list} aria-label='World Bible characters'>
              {shown.map((choice) => (
                <li key={choice.entityId}>
                  <label className={styles.choice}>
                    <input
                      type='checkbox'
                      checked={selected.has(choice.entityId)}
                      onChange={() => toggle(choice.entityId)}
                    />
                    <span className={styles.choiceText}>
                      <span className={styles.name}>{choice.name}</span>
                      {choice.aliases.length > 0 && (
                        <span className={styles.meta}>Also: {choice.aliases.join(', ')}</span>
                      )}
                    </span>
                    <span className={styles.meta}>{choice.hasSheet ? 'Has a sheet' : 'No sheet'}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className={routeStyles.toolbar}>
            <button type='button' onClick={() => void exportSelected(false)} disabled={selectedIds.length === 0 || isExporting}>
              Export selected
            </button>
            {canTransferSheets && (
              <button type='button' onClick={() => void exportSelected(true)} disabled={selectedIds.length === 0 || isExporting}>
                Export selected with sheets
              </button>
            )}
          </div>
        </>
      )}
      {status === 'ready' && data.unlinked.length > 0 && (
        <div className={styles.unlinked}>
          <p className={routeStyles.lead}>
            Not selectable: these records are in the World Bible&apos;s <strong>Needs canon link</strong> queue
            and are not World Bible characters yet. Export all still includes them; link them in the World
            Bible to export them one by one.
          </p>
          <ul className={styles.list} aria-label='Records that need a canon link'>
            {data.unlinked.map((item) => (
              <li key={item.key} className={styles.choice} aria-disabled='true'>
                <input type='checkbox' disabled aria-label={`${item.name} (needs a canon link)`} />
                <span className={styles.choiceText}>
                  <span className={styles.name}>{item.name}</span>
                  <span className={styles.meta}>{item.reason}</span>
                </span>
                <span className={styles.meta}>{item.recordType === 'sheet' ? 'Sheet record' : 'Character record'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
