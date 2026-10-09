import {useMemo, useRef, useState} from 'react';
import type {LoreDocument} from '../../entityTypes';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import type {RAGProvider} from '../../services/rag/RAGService';
import {
  findImportedSourceNote,
  importSourceNoteFiles,
  type SourceNoteBatchLink,
  type SourceNoteImportResult
} from '../../services/lore/sourceNoteBatchImport';
import styles from './SourceNoteBatchImportDialog.module.css';

export interface SourceNoteLinkTarget {
  key: string;
  label: string;
  targetType: SourceNoteBatchLink['targetType'];
  targetId: string;
}

interface SourceNoteBatchImportDialogProps {
  files: File[];
  projectId: string;
  documents: LoreDocument[];
  linkTargets: SourceNoteLinkTarget[];
  ragService: RAGProvider | null;
  onOpen: (documentId: string) => void;
  onClose: () => void;
  onFinished: () => void;
}

type Phase = 'ready' | 'running' | 'done';

const STATUS_LABEL: Record<SourceNoteImportResult['status'], string> = {
  waiting: 'Waiting',
  imported: 'Imported',
  skipped: 'Skipped',
  failed: 'Failed'
};

/** Saves several files as Source Notes at once and reports each file's outcome. */
export const SourceNoteBatchImportDialog = ({
  files,
  projectId,
  documents,
  linkTargets,
  ragService,
  onOpen,
  onClose,
  onFinished
}: SourceNoteBatchImportDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [linkKey, setLinkKey] = useState('');
  // Fixed when the dialog opens, so the list does not shift as notes are saved.
  const [initialResults] = useState<SourceNoteImportResult[]>(() =>
    files.map((file) => {
      const existing = findImportedSourceNote(documents, file.name);
      return existing
        ? {fileName: file.name, status: 'skipped', documentId: existing.id, reason: `Already imported as "${existing.title}".`}
        : {fileName: file.name, status: 'waiting'};
    })
  );
  const [results, setResults] = useState(initialResults);
  const toImport = initialResults.filter((result) => result.status === 'waiting').length;
  const counts = useMemo(
    () =>
      results.reduce(
        (total, result) => ({...total, [result.status]: total[result.status] + 1}),
        {waiting: 0, imported: 0, skipped: 0, failed: 0}
      ),
    [results]
  );
  const initialSkipped = initialResults.length - toImport;
  const processed = results.length - counts.waiting - initialSkipped;
  const closeIfIdle = () => {
    if (phase !== 'running') onClose();
  };
  useEscapeToClose(closeIfIdle, true);
  useFocusTrap(dialogRef, true);

  const handleImport = async () => {
    const target = linkTargets.find((candidate) => candidate.key === linkKey);
    setPhase('running');
    await importSourceNoteFiles({
      projectId,
      files,
      existingDocuments: documents,
      link: target ? {targetType: target.targetType, targetId: target.targetId} : null,
      ragService,
      onResult: (index, result) =>
        setResults((current) => current.map((entry, position) => (position === index ? result : entry)))
    });
    setPhase('done');
    onFinished();
  };

  return (
    <div className={styles.overlay} role='presentation' onClick={closeIfIdle}>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='source-note-batch-title'
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id='source-note-batch-title' className={styles.title}>
          Import {files.length} files as Source Notes
        </h2>
        <p className={styles.copy}>
          Each file is saved as its own Source Note. Nothing becomes canon until you
          extract candidates from a note and accept them.
        </p>

        {phase === 'ready' ? (
          <label className={styles.linkField}>
            Link every note to
            <select value={linkKey} onChange={(event) => setLinkKey(event.target.value)}>
              <option value=''>Nothing (save as general Source Notes)</option>
              {linkTargets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <p className={styles.summary} role='status'>
          {phase === 'ready'
            ? `${toImport} to import${counts.skipped ? `, ${counts.skipped} already imported` : ''}.`
            : phase === 'running'
              ? `Importing... ${processed} of ${toImport} done.`
              : `Imported ${counts.imported} · Skipped ${counts.skipped} · Failed ${counts.failed}`}
        </p>

        <ul className={styles.list} aria-label='Files'>
          {results.map((result, index) => (
            <li key={`${result.fileName}-${index}`} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.fileName}>{result.fileName}</span>
                {result.reason ? <span className={styles.reason}>{result.reason}</span> : null}
              </div>
              <span className={`${styles.status} ${styles[result.status]}`}>
                {STATUS_LABEL[result.status]}
              </span>
              {result.documentId && phase !== 'running' && result.status !== 'waiting' ? (
                <button
                  type='button'
                  aria-label={`Open ${result.fileName}`}
                  onClick={() => onOpen(result.documentId as string)}
                >
                  Open
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          {phase === 'ready' ? (
            <>
              <button type='button' onClick={onClose}>
                Cancel
              </button>
              <button
                type='button'
                className={styles.primary}
                onClick={() => void handleImport()}
                disabled={toImport === 0}
              >
                Import {toImport} {toImport === 1 ? 'file' : 'files'}
              </button>
            </>
          ) : (
            <button type='button' onClick={onClose} disabled={phase === 'running'}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
