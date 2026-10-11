import {useMemo, useRef} from 'react';
import type {KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {sourceNoteContentToHtml} from '../../services/lore/sourceNoteFormat';
import type {CraftCitation} from '../../services/craft/types';
import {pushAppToast} from '../../store/notificationStore';
import {copyText} from '../../utils/clipboard';
import {CraftCitationList} from '../CraftCitationList';
import styles from '../../assets/components/AIAssistant.module.css';

interface AssistantReplyReaderProps {
  content: string;
  craftCitations?: CraftCitation[];
  isStreaming: boolean;
  onClose: () => void;
}

/**
 * Wide reading view for one assistant reply (Slice 4.65). The assistant often
 * sits in a narrow drawer; this shows the same reply at a readable width with
 * its Markdown formatted. Display only: the stored message is unchanged.
 */
export function AssistantReplyReader({
  content,
  craftCitations,
  isStreaming,
  onClose
}: AssistantReplyReaderProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  const html = useMemo(() => sourceNoteContentToHtml(content, 'markdown'), [content]);

  // Escape is handled here rather than on window so it closes only this
  // dialog, not the narrow-viewport drawer the assistant lives in.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };

  const handleCopy = async () => {
    const copied = await copyText(content);
    pushAppToast(
      copied
        ? {message: 'Reply copied.'}
        : {tone: 'error', message: 'Unable to copy the reply. Select the text and copy it instead.'}
    );
  };

  return createPortal(
    <div className={styles.readerOverlay} onClick={onClose} role='presentation'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='assistant-reply-reader-title'
        aria-busy={isStreaming}
        tabIndex={-1}
        className={styles.readerCard}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.readerHeader}>
          <h2 id='assistant-reply-reader-title' className={styles.readerTitle}>
            Assistant reply
          </h2>
          <div className={styles.readerActions}>
            <button type='button' onClick={() => void handleCopy()} disabled={isStreaming}>
              Copy
            </button>
            <button type='button' onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div
          className={styles.readerBody}
          data-testid='assistant-reply-reader-body'
          dangerouslySetInnerHTML={{__html: html}}
        />
        {craftCitations?.length ? (
          <details className={styles.contextSources}>
            <summary>Craft reference material (not your canon)</summary>
            <CraftCitationList citations={craftCitations} />
          </details>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
