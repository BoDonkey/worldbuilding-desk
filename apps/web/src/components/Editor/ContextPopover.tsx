import type {ReactNode} from 'react';
import styles from '../../assets/components/ContextPopover.module.css';

interface ContextPopoverProps {
  title: string;
  message?: string;
  left: number;
  top: number;
  onClose: () => void;
  children?: ReactNode;
}

export function ContextPopover({
  title,
  message,
  left,
  top,
  onClose,
  children
}: ContextPopoverProps) {
  return (
    <div
      className={styles.popover}
      style={{
        left: `${left}px`,
        top: `${top}px`
      }}
    >
      <div className={styles.title}>{title}</div>
      {message && <div className={styles.message}>{message}</div>}
      {children}
      <button type='button' className={styles.closeButton} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
