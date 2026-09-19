import styles from '../../assets/components/common/ConsultationBudgetNotice.module.css';
import {CONSULTATION_GRANT_STEP, type ConsultationBudgetStatus} from '../../services/editor';

export interface ConsultationBudgetNoticeProps {
  status: ConsultationBudgetStatus;
  /** True when the project's provider is local, so this action does not spend the budget. */
  isLocal: boolean;
  /** Called when the author chooses to add more consultations for today. */
  onGrantMore: () => void;
  /** Hide the notice entirely — e.g. when consultation is disabled and the button is unusable. */
  hidden?: boolean;
  className?: string;
}

/**
 * The point-of-use half of the 4.39 budget model: every action that spends a consultation states
 * what it costs before the request and what is left after, in plain language, beside the button
 * rather than in Settings. When the budget is spent the message says when it resets in the
 * author's own timezone and offers more for today, because the budget guards against runaway
 * loops, not against deliberate work.
 */
export function ConsultationBudgetNotice({
  status,
  isLocal,
  onGrantMore,
  hidden,
  className
}: ConsultationBudgetNoticeProps) {
  if (hidden) return null;

  if (isLocal) {
    return (
      <p className={[styles.notice, styles.local, className].filter(Boolean).join(' ')}>
        {status.localGuardExhausted
          ? `Local requests are paused after ${status.localUsed} today — a runaway guard, not a budget. Resets at ${status.resetsAtLabel}.`
          : 'Runs on your local model, so it costs nothing and does not use your daily consultations.'}
      </p>
    );
  }

  if (status.exhausted) {
    return (
      <div
        role='alert'
        className={[styles.exhausted, className].filter(Boolean).join(' ')}
      >
        <span className={styles.message}>
          You have used all {status.limit} AI consultations for this project today. They reset at{' '}
          {status.resetsAtLabel}.
        </span>
        <button type='button' className={styles.grantButton} onClick={onGrantMore}>
          Add {CONSULTATION_GRANT_STEP} more for today
        </button>
      </div>
    );
  }

  return (
    <p className={[styles.notice, styles.cost, className].filter(Boolean).join(' ')}>
      Costs 1 of this project&apos;s {status.limit} daily AI consultations —{' '}
      {status.remaining} left, resetting at {status.resetsAtLabel}.
    </p>
  );
}
