import {useState} from 'react';
import type {ChapterCard, WritingDocument} from '../../entityTypes';
import {useStatusAnnouncement} from '../../hooks/useStatusAnnouncement';
import {resolveSceneLinks} from '../../services/workspace/chapterCardSceneLinks';
import styles from './ChapterCardSceneLinks.module.css';

interface ChapterCardSceneLinksProps {
  card: ChapterCard;
  documents: WritingDocument[];
  currentDocumentId?: string;
  onToggle: (sceneId: string) => void;
  onRemoveMissing: (sceneId: string) => void;
  onOpenScene?: (sceneId: string) => void;
  /** Present when the project allows AI scene drafts: offered on linked scenes that are still empty. */
  onDraftScene?: (sceneId: string) => void;
  canDraftScene?: (document: WritingDocument) => boolean;
  onCurrentSceneAction?: (message: string) => void;
  onCreateLinkedScene?: () => void;
  isCreatingLinkedScene?: boolean;
  compact?: boolean;
}

const sceneTitle = (document: WritingDocument) => document.title.trim() || 'Untitled scene';
const cardTitle = (card: ChapterCard) => card.title.trim() || 'Untitled chapter';

export function ChapterCardSceneLinks({
  card,
  documents,
  currentDocumentId,
  onToggle,
  onRemoveMissing,
  onOpenScene,
  onDraftScene,
  canDraftScene,
  onCurrentSceneAction,
  onCreateLinkedScene,
  isCreatingLinkedScene = false,
  compact = false
}: ChapterCardSceneLinksProps) {
  const [linksOpen, setLinksOpen] = useState(!compact);
  const announceStatus = useStatusAnnouncement();
  const {linked, missingSceneIds} = resolveSceneLinks(card, documents);
  const linkedIdSet = new Set(linked.map((document) => document.id));
  const currentDocument = currentDocumentId
    ? documents.find((document) => document.id === currentDocumentId)
    : undefined;
  const currentIsLinked = Boolean(currentDocumentId && (card.sceneIds ?? []).includes(currentDocumentId));
  const visibleLinked = linked.slice(0, 3);
  const hiddenLinkedCount = Math.max(0, linked.length - visibleLinked.length);
  const totalLinkCount = new Set(card.sceneIds ?? []).size;

  const toggle = (document: WritingDocument, isCurrentAction = false) => {
    const wasLinked = (card.sceneIds ?? []).includes(document.id);
    onToggle(document.id);
    const message = wasLinked
      ? `Unlinked ${sceneTitle(document)} from ${cardTitle(card)}.`
      : `Linked ${sceneTitle(document)} to ${cardTitle(card)}.`;
    announceStatus(message);
    if (isCurrentAction) onCurrentSceneAction?.(message);
  };

  const removeMissing = (sceneId: string) => {
    onRemoveMissing(sceneId);
    announceStatus(`Removed a missing scene link from ${cardTitle(card)}.`);
  };

  return <section className={`${styles.sceneLinks} ${compact ? styles.compact : ''}`} aria-label={`Draft scenes for ${cardTitle(card)}`}>
    <div className={styles.headingRow}>
      <div>
        <strong>Draft scenes</strong>
        {!compact && <p>Explicit links power chapter rollups. Nothing is matched by title or order.</p>}
      </div>
      <span className={styles.countChip}>{totalLinkCount} linked</span>
    </div>

    {(linked.length > 0 || missingSceneIds.length > 0) ? <div className={styles.chipRow} aria-label='Linked scenes'>
      {visibleLinked.map((document) => <span key={document.id} className={styles.sceneChip}>{sceneTitle(document)}</span>)}
      {hiddenLinkedCount > 0 && <span className={styles.sceneChip}>+{hiddenLinkedCount} more</span>}
      {missingSceneIds.map((sceneId) => <span key={sceneId} className={`${styles.sceneChip} ${styles.missingChip}`}>
        Scene no longer exists
        <button type='button' onClick={() => removeMissing(sceneId)} aria-label={`Remove missing scene link ${sceneId} from ${cardTitle(card)}`}>Remove link</button>
      </span>)}
    </div> : <p className={styles.emptyCopy}>No linked scenes yet.</p>}

    {(currentDocument || onCreateLinkedScene) && <div className={styles.primaryActions}>
      {currentDocument && <button
        type='button'
        className={styles.currentSceneButton}
        onClick={() => toggle(currentDocument, true)}
        aria-label={`${currentIsLinked ? 'Unlink' : 'Link'} current scene ${sceneTitle(currentDocument)} ${currentIsLinked ? 'from' : 'to'} ${cardTitle(card)}`}
      >
        {currentIsLinked ? 'Unlink current scene' : 'Link current scene'}
      </button>}
      {onCreateLinkedScene && <button
        type='button'
        onClick={onCreateLinkedScene}
        disabled={isCreatingLinkedScene}
        aria-label={`Create linked scene for ${cardTitle(card)}`}
      >
        {isCreatingLinkedScene ? 'Creating scene…' : 'Create linked scene'}
      </button>}
    </div>}

    <details open={linksOpen} onToggle={(event) => setLinksOpen(event.currentTarget.open)} className={styles.manageLinks}>
      <summary>Manage links</summary>
      {documents.length === 0 ? <p className={styles.emptyCopy}>No saved scenes are available to link.</p> : <div className={styles.sceneChecklist}>
        {documents.map((document) => <div key={document.id} className={styles.sceneCheckRow}>
          <label>
            <input type='checkbox' checked={linkedIdSet.has(document.id)} onChange={() => toggle(document)} />
            <span>{sceneTitle(document)}</span>
          </label>
          {linkedIdSet.has(document.id) && onOpenScene && <button type='button' onClick={() => onOpenScene(document.id)} aria-label={`Open scene ${sceneTitle(document)}`}>Open scene</button>}
          {linkedIdSet.has(document.id) && onDraftScene && canDraftScene?.(document) && <button type='button' onClick={() => onDraftScene(document.id)} aria-label={`Draft scene ${sceneTitle(document)}`}>Draft this scene</button>}
        </div>)}
      </div>}
    </details>
  </section>;
}
