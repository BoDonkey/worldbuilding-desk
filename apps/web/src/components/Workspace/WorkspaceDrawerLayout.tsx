import type {ComponentProps, ReactNode, RefObject} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';
import {WorkspaceContextDrawer} from './WorkspaceContextDrawer';
import {WorkspaceDrawerPanel} from './WorkspaceDrawerPanel';
import {WorkspaceSceneDrawer} from './WorkspaceSceneDrawer';

interface WorkspaceDrawerLayoutProps {
  children: ReactNode;
  isNarrowViewport: boolean;
  isSceneDrawerOpen: boolean;
  isContextDrawerOpen: boolean;
  sceneDrawerDialogRef: RefObject<HTMLDivElement | null>;
  contextDrawerDialogRef: RefObject<HTMLDivElement | null>;
  closeSceneDrawer: () => void;
  closeContextDrawer: () => void;
  sceneDrawerProps: ComponentProps<typeof WorkspaceSceneDrawer>;
  contextDrawerProps: ComponentProps<typeof WorkspaceContextDrawer>;
}

export const WorkspaceDrawerLayout = ({
  children,
  isNarrowViewport,
  isSceneDrawerOpen,
  isContextDrawerOpen,
  sceneDrawerDialogRef,
  contextDrawerDialogRef,
  closeSceneDrawer,
  closeContextDrawer,
  sceneDrawerProps,
  contextDrawerProps
}: WorkspaceDrawerLayoutProps) => (
  <>
    <div className={styles.workspaceFrame} data-wbd-scroll-key='workspace-frame'>
      <div className={styles.workspaceLayout} data-wbd-scroll-key='workspace-layout'>
        {isSceneDrawerOpen && !isNarrowViewport && (
          <aside
            className={styles.sceneDrawerDesktop}
            data-wbd-scroll-key='workspace-scene-drawer'
          >
            <WorkspaceSceneDrawer {...sceneDrawerProps} />
          </aside>
        )}
        {children}
        {isContextDrawerOpen && !isNarrowViewport && (
          <aside className={styles.contextDrawerDesktop}>
            <WorkspaceContextDrawer {...contextDrawerProps} />
          </aside>
        )}
      </div>
    </div>

    {isSceneDrawerOpen && isNarrowViewport && (
      <WorkspaceDrawerPanel
        ref={sceneDrawerDialogRef}
        ariaLabel='Workspace scene drawer'
        dataScrollKey='workspace-scene-drawer'
        onClose={closeSceneDrawer}
        side='left'
        title='Scenes'
      >
        <WorkspaceSceneDrawer {...sceneDrawerProps} />
      </WorkspaceDrawerPanel>
    )}

    {isContextDrawerOpen && isNarrowViewport && (
      <WorkspaceDrawerPanel
        ref={contextDrawerDialogRef}
        ariaLabel='Workspace context drawer'
        onClose={closeContextDrawer}
        side='right'
        title='Context Drawer'
      >
        <WorkspaceContextDrawer {...contextDrawerProps} />
      </WorkspaceDrawerPanel>
    )}
  </>
);
