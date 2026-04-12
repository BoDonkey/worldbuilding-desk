import type {WritingDocument, WorkspaceImportMode} from '../../entityTypes';
import type {WorkspaceImportSummary} from '../../hooks/useWorkspaceDocuments';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceSceneDrawerProps {
  handleNewDocument: () => void;
  isCreatingScene: boolean;
  isImportingDocuments: boolean;
  openImportPicker: () => void;
  importMode: WorkspaceImportMode;
  setImportMode: (mode: WorkspaceImportMode) => void;
  skipImportSuggestions: boolean;
  setSkipImportSuggestions: (val: boolean) => void;
  openExportModalWithDrawerHandling: (format: 'markdown' | 'docx' | 'epub') => void;
  documents: WritingDocument[];
  importSummary: WorkspaceImportSummary | null;
  setImportSummary: React.Dispatch<React.SetStateAction<WorkspaceImportSummary | null>>;
  retryImportFiles: File[];
  setRetryImportFiles: (val: File[]) => void;
  handleRetryFailedImports: () => Promise<void>;
  selectedId: string | null;
  handleSelectDocument: (doc: WritingDocument) => void;
  handleDelete: (doc: WritingDocument) => void;
  deletingDocumentId: string | null;
}

export function WorkspaceSceneDrawer({
  handleNewDocument,
  isCreatingScene,
  isImportingDocuments,
  openImportPicker,
  importMode,
  setImportMode,
  skipImportSuggestions,
  setSkipImportSuggestions,
  openExportModalWithDrawerHandling,
  documents,
  importSummary,
  setImportSummary,
  retryImportFiles,
  setRetryImportFiles,
  handleRetryFailedImports,
  selectedId,
  handleSelectDocument,
  handleDelete,
  deletingDocumentId
}: WorkspaceSceneDrawerProps) {
  return (
    <>
      <div style={{marginBottom: '1rem'}}>
        <button
          type='button'
          onClick={handleNewDocument}
          disabled={isCreatingScene}
        >
          {isCreatingScene ? 'Creating...' : '+ New Scene'}
        </button>
        <button
          type='button'
          onClick={openImportPicker}
          disabled={isImportingDocuments}
          style={{marginLeft: '0.5rem'}}
        >
          {isImportingDocuments ? 'Importing...' : 'Import'}
        </button>
        <label className={styles.importModeLabel}>
          Import mode
          <select
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as WorkspaceImportMode)}
            disabled={isImportingDocuments}
            className={styles.importModeSelect}
          >
            <option value='balanced'>Balanced</option>
            <option value='strict'>Strict</option>
            <option value='lenient'>Lenient</option>
          </select>
        </label>
        <label className={styles.importToggleLabel}>
          <input
            type='checkbox'
            checked={skipImportSuggestions}
            disabled={isImportingDocuments}
            onChange={(event) => setSkipImportSuggestions(event.target.checked)}
          />
          Skip consistency suggestions for this import
        </label>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('markdown')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export MD
        </button>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('docx')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export DOCX
        </button>
        <button
          type='button'
          onClick={() => openExportModalWithDrawerHandling('epub')}
          disabled={documents.length === 0}
          style={{marginLeft: '0.5rem'}}
        >
          Export EPUB
        </button>
      </div>

      {importSummary && (
        <div className={styles.importSummaryPanel}>
          <strong>Import Summary</strong>
          <p className={styles.importSummaryText}>
            Imported {importSummary.importedCount} · Failed {importSummary.failedCount} ·
            Detected on import {importSummary.unresolvedCount} · Mode {importSummary.mode}
            {importSummary.openedTitle ? ` · Opened "${importSummary.openedTitle}"` : ''}
            {importSummary.suggestionsSkipped ? ' · Suggestions skipped' : ''}
          </p>
          <div className={styles.importSummaryActions}>
            <button
              type='button'
              onClick={() => void handleRetryFailedImports()}
              disabled={isImportingDocuments || retryImportFiles.length === 0}
            >
              Retry failed files only
            </button>
            <button
              type='button'
              onClick={() => {
                setImportSummary(null);
                setRetryImportFiles([]);
              }}
              disabled={isImportingDocuments}
            >
              Dismiss
            </button>
          </div>
          {importSummary.failures.length > 0 && (
            <ul className={styles.importSummaryList}>
              {importSummary.failures.slice(0, 6).map((item) => (
                <li key={`${item.fileName}-${item.reason}`}>
                  {item.fileName}:{' '}
                  {item.reason === 'legacy-doc'
                    ? 'Legacy .doc is unsupported.'
                    : item.reason === 'apple-pages'
                      ? item.detail ?? 'Apple Pages file: export as .docx/.txt then import.'
                      : item.detail ?? 'Could not parse this file.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {documents.length === 0 && (
        <p style={{fontStyle: 'italic'}}>
          No scenes yet. Create one to start writing.
        </p>
      )}

      <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
        {documents.map((doc) => (
          <li
            key={doc.id}
            style={{
              marginBottom: '0.5rem',
              padding: '0.5rem',
              borderRadius: '4px',
              backgroundColor: doc.id === selectedId ? '#eee' : 'transparent',
              cursor: 'pointer'
            }}
          >
            <div
              onClick={() => handleSelectDocument(doc)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '160px'
                }}
              >
                {doc.title || 'Untitled scene'}
              </span>
            </div>
            <button
              type='button'
              onClick={() => handleDelete(doc)}
              disabled={deletingDocumentId === doc.id}
              style={{marginTop: '0.25rem', fontSize: '0.8rem'}}
            >
              {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
