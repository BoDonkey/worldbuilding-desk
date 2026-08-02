import {useEffect} from 'react';
import styles from '../../assets/components/common/InlineAlert.module.css';

export type InlineAlertVariant = 'error' | 'success' | 'info';

export interface InlineAlertProps {
  variant: InlineAlertVariant;
  message: string;
  /** Shows a dismiss (x) button and calls this when clicked. */
  onDismiss?: () => void;
  /** If set, calls `onDismiss` automatically after this many milliseconds. */
  autoDismissMs?: number;
  className?: string;
}

const VARIANT_CLASS: Record<InlineAlertVariant, string> = {
  error: styles.error,
  success: styles.success,
  info: styles.info
};

/**
 * Theme-consistent, non-modal replacement for `window.alert(...)`. Renders
 * inline wherever it's placed by the caller rather than blocking the page;
 * it does not manage its own visibility beyond the optional auto-dismiss
 * timer, so callers control whether/when it's mounted.
 */
export function InlineAlert({
  variant,
  message,
  onDismiss,
  autoDismissMs,
  className
}: InlineAlertProps) {
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={[styles.banner, VARIANT_CLASS[variant], className].filter(Boolean).join(' ')}
    >
      <span className={styles.message}>{message}</span>
      {onDismiss ? (
        <button
          type='button'
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label='Dismiss message'
        >
          &times;
        </button>
      ) : null}
    </div>
  );
}

export default InlineAlert;
