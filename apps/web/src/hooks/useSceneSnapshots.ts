import {useCallback, useEffect, useRef, useState} from 'react';
import type {SceneSnapshot} from '../entityTypes';
import {WORKSPACE_COMMAND_EVENT, type WorkspaceCommandId} from '../commands/workspaceCommands';
import {RECORDS_CHANGED} from '../services/recordEvents';
import {deleteSceneSnapshot, getSceneSnapshots} from '../services/storage';
import {
  localDayKey,
  prepareSnapshotRestore,
  snapshotPlainText,
  takeDailySceneSnapshotIfNeeded,
  takeSceneSnapshot,
  type SceneContentReplacement
} from '../services/editor/sceneSnapshots';
import {describeError} from '../services/errors';
import {pushAppToast} from '../store/notificationStore';
import {copyText} from '../utils/clipboard';

interface UseSceneSnapshotsOptions {
  projectId: string | null;
  sceneId: string | null;
  /** The open scene's title as edited, stored on snapshots to name a deleted scene. */
  sceneTitle: string;
  /** False while the selected scene's text is still loading. */
  isSceneReady: boolean;
  /** The open scene as edited, which can be ahead of its last save. */
  content: string;
  /** The scene's text as last saved, or null when no scene is open. */
  savedContent: string | null;
}

/** True for Cmd/Ctrl+Shift+S, the Take snapshot shortcut. */
export const isTakeSnapshotShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === 'KeyS';

/**
 * Scene snapshots in the Workspace (slice 4.95): Take snapshot from the
 * footer, command palette, or shortcut; the Snapshots dialog's list, restore,
 * copy, and delete; and the automatic snapshot on a scene's first edit each
 * day. Restore hands the editor a `contentReplacement`, applied as an
 * ordinary edit, after saving the current text as a snapshot.
 */
export function useSceneSnapshots({
  projectId,
  sceneId,
  sceneTitle,
  isSceneReady,
  content,
  savedContent
}: UseSceneSnapshotsOptions) {
  const [isOpen, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SceneSnapshot[]>([]);
  const [isLoaded, setLoaded] = useState(false);
  const [isWorking, setWorking] = useState(false);
  const [contentReplacement, setContentReplacement] = useState<SceneContentReplacement | null>(null);
  const contentRef = useRef(content);
  const titleRef = useRef(sceneTitle);
  useEffect(() => {
    contentRef.current = content;
    titleRef.current = sceneTitle;
  }, [content, sceneTitle]);

  const canSnapshot = Boolean(projectId && sceneId && isSceneReady);

  useEffect(() => {
    setLoaded(false);
    setSnapshots([]);
    if (!isOpen || !projectId || !sceneId) return;
    let cancelled = false;
    const load = () => {
      getSceneSnapshots(projectId, sceneId)
        .then((next) => {
          if (cancelled) return;
          setSnapshots(next);
          setLoaded(true);
        })
        .catch((error) => {
          if (!cancelled) pushAppToast({tone: 'error', message: describeError(error, 'Unable to load snapshots.')});
        });
    };
    load();
    window.addEventListener(RECORDS_CHANGED.sceneSnapshots, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RECORDS_CHANGED.sceneSnapshots, load);
    };
  }, [isOpen, projectId, sceneId]);

  // Close the dialog and drop a pending restore when the scene changes.
  useEffect(() => {
    setOpen(false);
  }, [projectId, sceneId]);
  useEffect(() => {
    if (!contentReplacement) return;
    if (contentReplacement.documentId !== sceneId || content === contentReplacement.html) {
      setContentReplacement(null);
    }
  }, [content, contentReplacement, sceneId]);

  const takeSnapshot = useCallback(async (name?: string): Promise<boolean> => {
    if (!projectId || !sceneId || !isSceneReady) {
      pushAppToast({tone: 'error', message: 'Open a scene to take a snapshot.'});
      return false;
    }
    setWorking(true);
    try {
      await takeSceneSnapshot({
        projectId, sceneId, sceneTitle: titleRef.current, content: contentRef.current, kind: 'manual', name
      });
      pushAppToast({message: name?.trim() ? `Snapshot "${name.trim()}" saved.` : 'Snapshot saved.'});
      return true;
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to save the snapshot.')});
      return false;
    } finally {
      setWorking(false);
    }
  }, [isSceneReady, projectId, sceneId]);

  const restoreSnapshot = useCallback(async (snapshot: SceneSnapshot) => {
    if (!projectId || !sceneId) return;
    setWorking(true);
    try {
      const html = await prepareSnapshotRestore({
        projectId, sceneId, sceneTitle: titleRef.current, currentContent: contentRef.current, snapshot
      });
      if (html === null) {
        pushAppToast({message: 'The scene already matches this snapshot.'});
        return;
      }
      setContentReplacement({documentId: sceneId, html, token: Date.now()});
      pushAppToast({message: 'Snapshot restored. The text before it was saved as a snapshot.'});
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to restore the snapshot.')});
    } finally {
      setWorking(false);
    }
  }, [projectId, sceneId]);

  const copySnapshot = useCallback(async (snapshot: SceneSnapshot) => {
    const copied = await copyText(snapshotPlainText(snapshot));
    pushAppToast(
      copied
        ? {message: 'Snapshot text copied.'}
        : {tone: 'error', message: 'Unable to copy. Select the snapshot text and copy it instead.'}
    );
  }, []);

  /** Deletes without asking; the dialog confirms first. */
  const removeSnapshot = useCallback(async (snapshot: SceneSnapshot) => {
    try {
      await deleteSceneSnapshot(snapshot.id);
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to delete the snapshot.')});
    }
  }, []);

  // Command palette, footer button, and shortcut.
  useEffect(() => {
    const onCommand = (event: Event) => {
      const id = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail?.id;
      if (id === 'take-snapshot') void takeSnapshot();
      if (id === 'open-snapshots') {
        if (canSnapshot) setOpen(true);
        else pushAppToast({tone: 'error', message: 'Open a scene to see its snapshots.'});
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTakeSnapshotShortcut(event)) return;
      event.preventDefault();
      void takeSnapshot();
    };
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canSnapshot, takeSnapshot]);

  // The first edit of a scene each day saves the text as it was before it.
  const dailyChecked = useRef(new Set<string>());
  useEffect(() => {
    if (!projectId || !sceneId || !isSceneReady || savedContent === null || content === savedContent) return;
    const key = `${projectId}:${sceneId}:${localDayKey(Date.now())}`;
    if (dailyChecked.current.has(key)) return;
    dailyChecked.current.add(key);
    takeDailySceneSnapshotIfNeeded({projectId, sceneId, sceneTitle: titleRef.current, savedContent}).catch((error) => {
      dailyChecked.current.delete(key);
      console.error('Unable to take the daily scene snapshot.', error);
    });
  }, [content, isSceneReady, projectId, savedContent, sceneId]);

  return {
    isOpen,
    close: useCallback(() => setOpen(false), []),
    snapshots,
    isLoaded,
    isWorking,
    contentReplacement,
    takeSnapshot,
    restoreSnapshot,
    copySnapshot,
    removeSnapshot
  };
}

export type SceneSnapshotsController = ReturnType<typeof useSceneSnapshots>;
