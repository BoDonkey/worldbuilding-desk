import styles from '../../styles/LoreRoute.module.css';

interface SourceNoteStarterPanelProps {
  isImporting: boolean;
  onStartWriting: () => void;
  onImport: () => void;
}

export const SourceNoteStarterPanel = ({
  isImporting,
  onStartWriting,
  onImport
}: SourceNoteStarterPanelProps) => (
  <section className={styles.starterPanel} aria-label='Source note starting points'>
    <div className={styles.starterHeader}>
      <div>
        <div className={styles.starterEyebrow}>Start here</div>
        <h2>Source note intake</h2>
        <p>
          Capture longform material first, then decide which extracted facts
          and entities are worth promoting into World Bible canon.
        </p>
      </div>
    </div>
    <div className={styles.starterGrid}>
      <div className={styles.starterCard}>
        <h3>Write Manually</h3>
        <p>Draft a dossier, timeline, myth, or background note without shaping it into fields.</p>
        <button type='button' onClick={onStartWriting}>
          Start Writing
        </button>
      </div>
      <div className={styles.starterCard}>
        <h3>Import Dossier</h3>
        <p>Bring in DOCX, Markdown, or plain text as a linked or general Source Note.</p>
        <button type='button' onClick={onImport} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import File'}
        </button>
      </div>
      <div className={styles.starterCard}>
        <h3>Review Later</h3>
        <p>Save a Source Note, open it for editing, then extract candidates from the one saved version in view.</p>
      </div>
    </div>
  </section>
);
