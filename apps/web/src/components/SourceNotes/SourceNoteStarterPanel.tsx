import {useState} from 'react';
import styles from '../../styles/LoreRoute.module.css';

const COLLAPSED_STORAGE_KEY = 'wbd:lore:starter-collapsed';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface SourceNoteStarterPanelProps {
  isImporting: boolean;
  onStartWriting: () => void;
  onImport: () => void;
}

/** Intake starting points; collapses to one row that keeps both actions. */
export const SourceNoteStarterPanel = ({
  isImporting,
  onStartWriting,
  onImport
}: SourceNoteStarterPanelProps) => {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // The panel still toggles; it just will not be remembered.
    }
  };
  const startWritingButton = (
    <button type='button' onClick={onStartWriting}>
      Start Writing
    </button>
  );
  const importButton = (
    <button type='button' onClick={onImport} disabled={isImporting}>
      {isImporting ? 'Importing...' : 'Import File'}
    </button>
  );

  return (
    <section
      className={`${styles.starterPanel} ${collapsed ? styles.starterPanelCollapsed : ''}`}
      aria-label='Source note starting points'
    >
      <div className={styles.starterHeader}>
        <div>
          {collapsed ? null : <div className={styles.starterEyebrow}>Start here</div>}
          <h2>Source note intake</h2>
          {collapsed ? null : (
            <p>
              Capture longform material first, then decide which extracted facts
              and entities are worth promoting into World Bible canon.
            </p>
          )}
        </div>
        <div className={styles.starterHeaderActions}>
          {collapsed ? (
            <>
              {startWritingButton}
              {importButton}
            </>
          ) : null}
          <button
            type='button'
            className={styles.starterToggle}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? 'Show intro' : 'Hide intro'}
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <div className={styles.starterGrid}>
          <div className={styles.starterCard}>
            <h3>Write Manually</h3>
            <p>Draft a dossier, timeline, myth, or background note without shaping it into fields.</p>
            {startWritingButton}
          </div>
          <div className={styles.starterCard}>
            <h3>Import Dossier</h3>
            <p>Bring in DOCX, Markdown, or plain text as a linked or general Source Note.</p>
            {importButton}
          </div>
          <div className={styles.starterCard}>
            <h3>Review Later</h3>
            <p>Save a Source Note, open it for editing, then extract candidates from the one saved version in view.</p>
          </div>
        </div>
      )}
    </section>
  );
};
