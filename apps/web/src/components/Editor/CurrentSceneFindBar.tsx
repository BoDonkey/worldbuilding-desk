import type {RefObject} from 'react';
import styles from '../../assets/components/Editor.module.css';
import type {CurrentSceneFindControls} from '../../hooks/useCurrentSceneFind';

/** The find-in-scene bar above the editor; shown while find is open. */
export function CurrentSceneFindBar({
  find,
  inputRef
}: {
  find: CurrentSceneFindControls;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  if (!find.isOpen) return null;
  return (
    <div className={styles.currentSceneFindBar} role='search' aria-label='Find in current scene'>
      <label className={styles.currentSceneFindField}>
        <span>Find in scene</span>
        <input
          ref={inputRef}
          type='search'
          value={find.query}
          onChange={(event) => find.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            find.navigate(event.shiftKey ? 'previous' : 'next');
          }}
          aria-describedby='current-scene-find-status'
        />
      </label>
      <span
        id='current-scene-find-status'
        className={styles.currentSceneFindStatus}
        role='status'
        aria-live='polite'
      >
        {!find.query.trim()
          ? 'Type to find'
          : find.matches.length === 0
            ? 'No matches'
            : `${find.activeIndex + 1} of ${find.matches.length}`}
      </span>
      <div className={styles.currentSceneFindActions}>
        <button
          type='button'
          onClick={() => find.navigate('previous')}
          disabled={!find.matches.length}
          aria-label='Previous match in scene'
        >
          Previous
        </button>
        <button
          type='button'
          onClick={() => find.navigate('next')}
          disabled={!find.matches.length}
          aria-label='Next match in scene'
        >
          Next
        </button>
        <button
          type='button'
          onClick={find.close}
          aria-label='Close find in scene'
        >
          Close
        </button>
      </div>
    </div>
  );
}
