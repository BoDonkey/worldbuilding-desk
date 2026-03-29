import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import styles from '../../assets/components/ContextPopover.module.css';

interface ContextPopoverProps {
  title: string;
  message?: string;
  eyebrow?: string;
  tone?: 'default' | 'warning' | 'info';
  left: number;
  top: number;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function ContextPopover({
  title,
  message,
  eyebrow,
  tone = 'default',
  left,
  top,
  onClose,
  children,
  className,
  bodyClassName
}: ContextPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({left, top});

  useLayoutEffect(() => {
    const element = popoverRef.current;
    if (!element) {
      setPosition({left, top});
      return;
    }

    const margin = 16;
    const maxLeft = window.innerWidth - element.offsetWidth - margin;
    const maxTop = window.innerHeight - element.offsetHeight - margin;

    setPosition({
      left: Math.max(margin, Math.min(left, maxLeft)),
      top: Math.max(margin, Math.min(top, maxTop))
    });
  }, [left, top, children, message, title, eyebrow, tone, className, bodyClassName]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (popoverRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={`${styles.popover} ${
        tone === 'warning'
          ? styles.popoverWarning
          : tone === 'info'
            ? styles.popoverInfo
            : ''
      } ${className ?? ''}`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`
      }}
      role='dialog'
      aria-modal='false'
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
          <div className={styles.title}>{title}</div>
          {message ? <div className={styles.message}>{message}</div> : null}
        </div>
        <button
          ref={closeButtonRef}
          type='button'
          className={styles.closeButton}
          onClick={onClose}
          aria-label='Close popover'
        >
          ×
        </button>
      </div>
      <div className={`${styles.body} ${bodyClassName ?? ''}`}>{children}</div>
    </div>
  );
}
