import {useRef} from 'react';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import styles from '../../assets/components/common/ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Styles the confirm button for destructive actions (delete, discard,
   * etc.). Defaults to the app's standard primary button styling.
   */
  variant?: 'default' | 'danger';
}

/**
 * Theme-consistent replacement for `window.confirm(...)`. Shares the
 * Escape-to-close and focus-trap hooks extracted from the Scratchpad and
 * Corkboard modals (see `useEscapeToClose` / `useFocusTrap`) so every dialog
 * in the app behaves the same way for keyboard users.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onCancel, isOpen);
  useFocusTrap(dialogRef, isOpen);

  if (!isOpen) return null;

  const confirmButtonClassName = [
    styles.confirmButton,
    variant === 'danger' ? styles.confirmButtonDanger : styles.confirmButtonDefault
  ].join(' ');

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role='presentation'
    >
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='confirm-dialog-title'
        aria-describedby='confirm-dialog-message'
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id='confirm-dialog-title' className={styles.title}>
          {title}
        </h2>
        <p id='confirm-dialog-message' className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button type='button' className={styles.cancelButton} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type='button' className={confirmButtonClassName} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
