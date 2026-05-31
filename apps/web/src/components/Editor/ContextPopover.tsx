import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
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
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({left, top});

  useLayoutEffect(() => {
    const clampPosition = () => {
      const popover = popoverRef.current;
      if (!popover || typeof window === 'undefined') {
        setPosition({left, top});
        return;
      }

      const margin = 12;
      const rect = popover.getBoundingClientRect();
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

      const nextPosition = {
        left: Math.min(Math.max(left, margin), maxLeft),
        top: Math.min(Math.max(top, margin), maxTop)
      };
      setPosition((prev) =>
        prev.left === nextPosition.left && prev.top === nextPosition.top
          ? prev
          : nextPosition
      );
    };

    clampPosition();
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => clampPosition());
    if (popoverRef.current) {
      resizeObserver?.observe(popoverRef.current);
    }
    window.addEventListener('resize', clampPosition);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', clampPosition);
    };
  }, [left, top, title, message]);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`
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
