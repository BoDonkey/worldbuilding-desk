import {
  forwardRef,
  type ReactNode
} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceDrawerPanelProps {
  ariaLabel: string;
  children: ReactNode;
  dataScrollKey?: string;
  onClose: () => void;
  side: 'left' | 'right';
  title: string;
}

export const WorkspaceDrawerPanel = forwardRef<
  HTMLDivElement,
  WorkspaceDrawerPanelProps
>(function WorkspaceDrawerPanel(
  {
    ariaLabel,
    children,
    dataScrollKey,
    onClose,
    side,
    title
  },
  ref
) {
  const isLeft = side === 'left';

  return (
    <div
      ref={ref}
      role='dialog'
      aria-modal='true'
      aria-label={ariaLabel}
      onClick={onClose}
      className={`${styles.drawerOverlay} ${
        isLeft ? styles.sceneOverlay : styles.contextOverlay
      }`}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className={isLeft ? styles.drawerPanelLeft : styles.drawerPanelRight}
        data-wbd-scroll-key={dataScrollKey}
      >
        <div className={styles.drawerPanelHeader}>
          <strong>{title}</strong>
          <button type='button' onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
});
