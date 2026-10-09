import type {LoreDocument, LoreDocumentLink} from '../../entityTypes';
import styles from '../../styles/LoreRoute.module.css';

interface SourceNoteDocumentListProps {
  documents: LoreDocument[];
  linksByDocumentId: Map<string, LoreDocumentLink[]>;
  pendingCountByDocumentId: (documentId: string) => number;
  acceptedCountByDocumentId: (documentId: string) => number;
  saving: boolean;
  deletingId: string | null;
  onEdit: (document: LoreDocument) => void;
  onDelete: (document: LoreDocument) => void;
}

export const SourceNoteDocumentList = ({
  documents,
  linksByDocumentId,
  pendingCountByDocumentId,
  acceptedCountByDocumentId,
  saving,
  deletingId,
  onEdit,
  onDelete
}: SourceNoteDocumentListProps) => (
  <aside className={styles.listCard} aria-label='Source notes'>
    <div className={styles.cardHeader}>
      <h2>Documents</h2>
      <span className={styles.countBadge}>{documents.length}</span>
    </div>
    {documents.length === 0 ? (
      <p className={styles.emptyState}>
        No Source Notes yet. Import a dossier or start a longform world note.
      </p>
    ) : (
      <div className={styles.documentList}>
        {documents.map((document) => {
          const links = linksByDocumentId.get(document.id) ?? [];
          return (
            <article key={document.id} className={styles.documentCard}>
              <div className={styles.documentHeader}>
                <div>
                  <p className={styles.documentKind}>
                    {links.length > 0 ? 'Linked source note' : 'General source note'}
                  </p>
                  <h3>{document.title}</h3>
                </div>
                <div className={styles.inlineActions}>
                  {/* A save lists the note before its links are written; wait for it. */}
                  <button
                    type='button'
                    onClick={() => onEdit(document)}
                    disabled={saving}
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    onClick={() => onDelete(document)}
                    disabled={saving || deletingId === document.id}
                  >
                    {deletingId === document.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span>
                  {pendingCountByDocumentId(document.id)} pending
                </span>
                <span>{acceptedCountByDocumentId(document.id)} accepted</span>
                {links.length > 0 ? <span>{links.length} linked</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    )}
  </aside>
);
