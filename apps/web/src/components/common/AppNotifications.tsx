import {useEffect} from 'react';
import {useNotificationStore, type AppToast} from '../../store/notificationStore';
import styles from '../../assets/components/common/AppNotifications.module.css';

const TONE_CLASS: Record<AppToast['tone'], string> = {
  success: styles.toastSuccess,
  info: styles.toastInfo,
  error: styles.toastError
};

function ToastItem({toast}: {toast: AppToast}) {
  const dismissToast = useNotificationStore((state) => state.dismissToast);

  useEffect(() => {
    if (toast.durationMs === null) return;
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast.id, toast.durationMs]);

  const showDismiss = toast.tone === 'error' || toast.durationMs === null || Boolean(toast.action);

  return (
    <div role='status' className={`${styles.toast} ${TONE_CLASS[toast.tone]}`} data-testid='app-toast'>
      <span className={styles.toastMessage}>{toast.message}</span>
      {toast.action || showDismiss ? (
        <div className={styles.toastActions}>
          {toast.action ? (
            <button
              type='button'
              className={`${styles.toastButton} ${styles.toastButtonPrimary}`}
              onClick={() => {
                toast.action?.onSelect();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          {showDismiss ? (
            <button
              type='button'
              className={styles.toastButton}
              onClick={() => dismissToast(toast.id)}
              aria-label='Dismiss notification'
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The one toast viewport and the one shared status live region for the whole
 * app. Mounted once by the app shell; routes post through the notification
 * store rather than rendering their own transient banners.
 */
export function AppNotifications() {
  const toasts = useNotificationStore((state) => state.toasts);
  const announcement = useNotificationStore((state) => state.announcement);
  // Alternating an invisible suffix makes screen readers re-announce a
  // repeated message (for example, a second "Scene saved.").
  const suffix = announcement && announcement.id % 2 === 1 ? ' ' : '';
  const polite = announcement && !announcement.assertive ? `${announcement.message}${suffix}` : '';
  const assertive = announcement && announcement.assertive ? `${announcement.message}${suffix}` : '';

  return (
    <>
      {toasts.length > 0 ? (
        <div className={styles.viewport} aria-live='polite' data-testid='app-toast-viewport'>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      ) : null}
      <div
        className={styles.visuallyHidden}
        role='status'
        aria-live='polite'
        aria-atomic='true'
        data-testid='app-status-announcer'
      >
        {polite}
      </div>
      <div className={styles.visuallyHidden} role='alert' aria-live='assertive' aria-atomic='true'>
        {assertive}
      </div>
    </>
  );
}

export default AppNotifications;
