import type {CharacterLabSummary} from '../../services/characterLab';
import {SUMMARY_LABEL} from '../../services/characterLab';
import styles from '../../styles/CharacterLab.module.css';

/**
 * The rolling summary of earlier Talk turns (Slice 4.74): offered when the
 * conversation fills the model's context, then shown, editable, and labeled
 * as a summary. It stands in for the older turns for the model only.
 */
export function CharacterLabSummaryPanel({
  summary,
  offer,
  summarizableCount,
  busy,
  disabledReason,
  onSummarize,
  onEdit,
  onRemove
}: {
  summary: CharacterLabSummary | null;
  /** Share of the model's context the conversation takes, when it is enough to offer a summary. */
  offer: number | null;
  summarizableCount: number;
  busy: boolean;
  disabledReason: string | null;
  onSummarize: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  if (!summary && offer === null) return null;
  const summarizeLabel = summary ? 'Add earlier turns to the summary' : 'Summarize earlier turns';
  return (
    <section className={styles.instructions} aria-label={SUMMARY_LABEL}>
      {offer !== null && (
        <p className={styles.hint}>
          This conversation fills about {Math.round(offer * 100)}% of the model’s context. A summary of the{' '}
          {summarizableCount} earlier {summarizableCount === 1 ? 'turn' : 'turns'} can stand in for them; the most
          recent turns are always sent in full.
        </p>
      )}
      {summary && (
        <>
          <label className={styles.field}>
            <span>
              {SUMMARY_LABEL} · {summary.coveredCount} {summary.coveredCount === 1 ? 'turn' : 'turns'} · not canon
              {summary.edited ? ' · edited' : ''}
            </span>
            <textarea rows={4} value={summary.text} onChange={(event) => onEdit(event.target.value)} />
          </label>
          <p className={styles.hint}>
            The model gets this summary instead of the turns marked Summarized. It is a note for this session only:
            it is not canon and is never saved to the World Bible.
          </p>
        </>
      )}
      <div className={styles.actions}>
        {summarizableCount > 0 && (
          <button type='button' onClick={onSummarize} disabled={busy || Boolean(disabledReason)} title={disabledReason ?? undefined}>
            {summarizeLabel}
          </button>
        )}
        {summary && (
          <button type='button' onClick={onRemove} disabled={busy}>
            Remove summary
          </button>
        )}
      </div>
    </section>
  );
}
