import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import styles from '../../assets/components/ContextPopover.module.css';

interface ContextPopoverProps {
  title: string;
  message?: string;
  left: number;
  top: number;
  anchorTop?: number;
  anchorBottom?: number;
  tone?: 'warning' | 'neutral';
  onClose: () => void;
  children?: ReactNode;
}

export function calculateContextPopoverPosition(params: {
  left: number;
  top: number;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  anchorTop?: number;
  anchorBottom?: number;
  margin?: number;
  gap?: number;
}) {
  const margin = params.margin ?? 12;
  const gap = params.gap ?? 8;
  const maxLeft = Math.max(margin, params.viewportWidth - params.popoverWidth - margin);
  const maxTop = Math.max(margin, params.viewportHeight - params.popoverHeight - margin);
  let desiredTop = params.top;

  if (params.anchorTop !== undefined && params.anchorBottom !== undefined) {
    const below = params.anchorBottom + gap;
    const above = params.anchorTop - params.popoverHeight - gap;
    const fitsBelow = below + params.popoverHeight <= params.viewportHeight - margin;
    const fitsAbove = above >= margin;
    desiredTop = fitsBelow
      ? below
      : fitsAbove
        ? above
        : params.anchorTop > params.viewportHeight / 2
          ? above
          : below;
  }

  return {
    left: Math.min(Math.max(params.left, margin), maxLeft),
    top: Math.min(Math.max(desiredTop, margin), maxTop)
  };
}

export function ContextPopover({
  title,
  message,
  left,
  top,
  anchorTop,
  anchorBottom,
  tone = 'warning',
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

      const rect = popover.getBoundingClientRect();
      const nextPosition = calculateContextPopoverPosition({
        left,
        top,
        popoverWidth: rect.width,
        popoverHeight: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        anchorTop,
        anchorBottom
      });
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
  }, [anchorBottom, anchorTop, left, top, title, message]);

  return (
    <div
      ref={popoverRef}
      className={`${styles.popover} ${tone === 'neutral' ? styles.popoverNeutral : ''}`}
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
