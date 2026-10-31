import {useId, useMemo, useRef, useState} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {sourceNoteContentToHtml} from '../../services/lore/sourceNoteFormat';
import {formatReplyTranscript} from '../../services/assistant/conversationTranscript';
import type {CraftCitation} from '../../services/craft/types';
import {pushAppToast} from '../../store/notificationStore';
import {copyText} from '../../utils/clipboard';
import {CraftCitationList} from '../CraftCitationList';
import styles from '../../assets/components/AIAssistant.module.css';

interface AssistantReplyReaderProps {
  content: string;
  /** The author question this reply answered, shown above it (Slice 5.17). */
  question?: string | null;
  craftCitations?: CraftCitation[];
  isStreaming: boolean;
  onClose: () => void;
  /** Sends a follow-up in the same conversation without closing the reader. */
  onFollowUp?: (text: string) => void;
  /** When set, a follow-up cannot be sent now and this says why. */
  followUpBlockedReason?: string | null;
}

/**
 * Wide reading view for one assistant reply (Slice 4.65). The assistant often
 * sits in a narrow drawer; this shows the same reply at a readable width with
 * its Markdown formatted, and lets the author answer it in place (5.17).
 * Display only: the stored message is unchanged.
 */
export function AssistantReplyReader({
  content,
  question = null,
  craftCitations,
  isStreaming,
  onClose,
  onFollowUp,
  followUpBlockedReason = null
}: AssistantReplyReaderProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const followUpId = useId();
  const [followUp, setFollowUp] = useState('');
  useFocusTrap(dialogRef, true);
  const html = useMemo(() => sourceNoteContentToHtml(content, 'markdown'), [content]);
  const canSend = !isStreaming && !followUpBlockedReason && followUp.trim().length > 0;

  // Escape is handled here rather than on window so it closes only this
  // dialog, not the narrow-viewport drawer the assistant lives in.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };

  const handleCopy = async (text: string, what: string) => {
    const copied = await copyText(text);
    pushAppToast(
      copied
        ? {message: `${what} copied.`}
        : {tone: 'error', message: 'Unable to copy the reply. Select the text and copy it instead.'}
    );
  };

  const sendFollowUp = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend || !onFollowUp) return;
    onFollowUp(followUp.trim());
    setFollowUp('');
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
            <button type='button' onClick={() => void handleCopy(content, 'Reply')} disabled={isStreaming || !content}>
              Copy
            </button>
            {question && (
              <button
                type='button'
                onClick={() => void handleCopy(formatReplyTranscript({question, reply: content}), 'Question and reply')}
                disabled={isStreaming || !content}
              >
                Copy with question
              </button>
            )}
            <button type='button' onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className={styles.readerBody} data-testid='assistant-reply-reader-body'>
          {question && (
            <p className={styles.readerQuestion}>
              <strong>You asked:</strong> {question}
            </p>
          )}
          {content ? (
            <div dangerouslySetInnerHTML={{__html: html}} />
          ) : (
            <p className={styles.readerPending}>{isStreaming ? 'Writing the reply…' : 'No reply yet.'}</p>
          )}
        </div>
        {craftCitations?.length ? (
          <details className={styles.contextSources}>
            <summary>Craft reference material (not your canon)</summary>
            <CraftCitationList citations={craftCitations} />
          </details>
        ) : null}
        {onFollowUp && (
          <form className={styles.readerComposer} onSubmit={sendFollowUp}>
            <label htmlFor={followUpId}>Continue the conversation</label>
            <textarea
              id={followUpId}
              value={followUp}
              rows={2}
              onChange={(event) => setFollowUp(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) sendFollowUp(event);
              }}
              aria-describedby={followUpBlockedReason ? `${followUpId}-blocked` : undefined}
            />
            {followUpBlockedReason && (
              <p id={`${followUpId}-blocked`} className={styles.readerPending} role='status'>
                {followUpBlockedReason}
              </p>
            )}
            <div className={styles.readerActions}>
              <button type='submit' disabled={!canSend}>
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
