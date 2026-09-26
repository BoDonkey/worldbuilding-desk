import {useEffect, useMemo, useRef, useState} from 'react';
import styles from '../assets/components/CommandPalette.module.css';
import {useFocusTrap} from '../hooks/useFocusTrap';
import {useCharacterStatPeekData} from '../hooks/useCharacterStatPeekData';
import {requestCharacterStatPeek} from '../commands/characterStatPeek';
import {
  searchCharacterPeekTargets,
  type CharacterStatCardTemplate
} from '../services/state/characterPeek';
import {CharacterStatCard} from './CharacterSheets/CharacterStatCard';
import {PinStatsButton} from './CharacterSheets/PinStatsButton';

interface CharacterStatPeekDialogProps {
  isOpen: boolean;
  projectId: string | null;
  initialQuery: string;
  initialSheetId: string | null;
  template?: CharacterStatCardTemplate;
  onClose: () => void;
}

/**
 * **Show stats for…** from the command palette: pick a character, then read
 * their latest state. A surface that can show the peek in place (Workspace, at
 * the cursor) takes the pick instead.
 */
export function CharacterStatPeekDialog({
  isOpen,
  projectId,
  initialQuery,
  initialSheetId,
  template,
  onClose
}: CharacterStatPeekDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sheetId, setSheetId] = useState<string | null>(initialSheetId);
  const {isLoaded, targets, getLatestSnapshot} = useCharacterStatPeekData(projectId, isOpen);
  useFocusTrap(containerRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    setActiveIndex(0);
    setSheetId(initialSheetId);
  }, [initialQuery, initialSheetId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Switching between search and card replaces the focused control.
    containerRef.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [isOpen, sheetId]);

  const results = useMemo(() => searchCharacterPeekTargets(targets, query), [query, targets]);
  const snapshot = useMemo(
    () => (sheetId ? getLatestSnapshot(sheetId) : null),
    [getLatestSnapshot, sheetId]
  );

  if (!isOpen) return null;

  const pick = (nextSheetId: string) => {
    if (requestCharacterStatPeek(nextSheetId)) {
      onClose();
      return;
    }
    setSheetId(nextSheetId);
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={styles.palette}
        role='dialog'
        aria-modal='true'
        aria-label='Show stats for'
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        {sheetId ? (
          <>
            <div className={styles.peekHeader}>
              <span>Character stats</span>
              <div className={styles.peekHeaderActions}>
                <button type='button' onClick={() => setSheetId(null)}>
                  Other character
                </button>
                <button type='button' onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
            <div className={styles.peekBody}>
              {snapshot ? (
                <CharacterStatCard
                  snapshot={snapshot}
                  asOfLabel='Latest, after every accepted change'
                  template={template}
                  actions={
                    <div className={styles.peekHeaderActions}>
                      <PinStatsButton sheetId={snapshot.sheetId} name={snapshot.name} />
                    </div>
                  }
                />
              ) : (
                <div className={styles.empty}>
                  {isLoaded ? 'This character has no stats sheet.' : 'Loading…'}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <input
              className={styles.input}
              placeholder='Show stats for…'
              aria-label='Character name'
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && results.length > 0) {
                  event.preventDefault();
                  setActiveIndex((prev) => (prev + 1) % results.length);
                } else if (event.key === 'ArrowUp' && results.length > 0) {
                  event.preventDefault();
                  setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  const target = results[activeIndex];
                  if (target) pick(target.sheetId);
                }
              }}
            />
            <ul className={styles.list} role='listbox' aria-label='Characters'>
              {results.length === 0 && (
                <li className={styles.empty}>
                  {isLoaded ? 'No characters with stats sheets match.' : 'Loading…'}
                </li>
              )}
              {results.map((target, index) => (
                <li key={target.sheetId}>
                  <button
                    type='button'
                    className={index === activeIndex ? styles.itemActive : styles.item}
                    role='option'
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(target.sheetId)}
                  >
                    <span className={styles.primary}>
                      <span>{target.name}</span>
                      {target.surfaces.length > 1 && (
                        <span className={styles.description}>
                          Also: {target.surfaces.filter((surface) => surface !== target.name).join(', ')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
