import {useId} from 'react';
import {useAIProposalConfirmation} from '../../hooks/useAIProposalConfirmation';
import styles from '../../assets/components/common/AIProposalPreview.module.css';

interface AIProposalPreviewProps {
  title: string;
  text: string;
  beforeText?: string;
  onDismiss: () => void;
  onConfirm: () => void | Promise<void>;
}

/** Read-only preview. Confirm delegates to an app-owned, validated action. */
export function AIProposalPreview({title, text, beforeText, onDismiss, onConfirm}: AIProposalPreviewProps) {
  const titleId = useId();
  const {confirm, isConfirming, error} = useAIProposalConfirmation(onConfirm);
  return (
    <section className={styles.aiHelperProposalCard} aria-labelledby={titleId} aria-busy={isConfirming}>
      <div>
        <span className={styles.aiHelperProposalEyebrow}>Pending action</span>
        <strong id={titleId}>{title}</strong>
      </div>
      {beforeText !== undefined && <><strong>Current text</strong><p>{beforeText}</p><strong>Proposed text</strong></>}
      <p>{text}</p>
      {error && <p role='alert'>{error}</p>}
      <div className={styles.aiHelperProposalActions}>
        <button type='button' className={styles.secondaryButton} onClick={onDismiss} disabled={isConfirming}>Dismiss</button>
        <button type='button' className={styles.primaryButton} onClick={() => void confirm()} disabled={isConfirming}>
          {isConfirming ? 'Applying…' : 'Confirm action'}
        </button>
      </div>
    </section>
  );
}
