import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {SceneSnapshot, WritingDocument} from '../entityTypes';
import {WORKSPACE_COMMAND_EVENT, type WorkspaceCommandId} from '../commands/workspaceCommands';
import {RECORDS_CHANGED} from '../services/recordEvents';
import {getProjectSceneSnapshots} from '../services/storage';
import {
  deleteDraftMilestone,
  findDeletedScenes,
  groupDraftMilestones,
  milestoneAsDocuments,
  saveDraftMilestone,
  type DraftMilestone
} from '../services/editor/draftMilestones';
import {describeError} from '../services/errors';
import {pushAppToast} from '../store/notificationStore';
import {exportScenesAsDocx, exportScenesAsEpub, exportScenesAsMarkdown} from '../utils/sceneExport';

export type DraftExportFormat = 'markdown' | 'docx' | 'epub';

interface UseDraftMilestonesOptions {
  projectId: string | null;
  projectName: string;
  documents: WritingDocument[];
  /** The scene open in the Workspace as edited, which can be ahead of its last save. */
  openScene: Pick<WritingDocument, 'id' | 'title' | 'content'> | null;
  onRestoreDeletedScene: (snapshot: SceneSnapshot) => Promise<WritingDocument | null>;
}

/**
 * Draft milestones in the Workspace (slice 4.96): save a milestone of every
 * scene, list milestones and deleted scenes, export a milestone's text, and
 * restore a deleted scene from one of its snapshots.
 */
export function useDraftMilestones({
  projectId,
  projectName,
  documents,
  openScene,
  onRestoreDeletedScene
}: UseDraftMilestonesOptions) {
  const [isOpen, setOpen] = useState(false);
  const [focusNameToken, setFocusNameToken] = useState(0);
  const [snapshots, setSnapshots] = useState<SceneSnapshot[]>([]);
  const [isLoaded, setLoaded] = useState(false);
  const [isWorking, setWorking] = useState(false);
  const openSceneRef = useRef(openScene);
  useEffect(() => {
    openSceneRef.current = openScene;
  }, [openScene]);

  useEffect(() => {
    setLoaded(false);
    setSnapshots([]);
    if (!isOpen || !projectId) return;
    let cancelled = false;
    const load = () => {
      getProjectSceneSnapshots(projectId)
        .then((next) => {
          if (cancelled) return;
          setSnapshots(next);
          setLoaded(true);
        })
        .catch((error) => {
          if (!cancelled) pushAppToast({tone: 'error', message: describeError(error, 'Unable to load drafts.')});
        });
    };
    load();
    window.addEventListener(RECORDS_CHANGED.sceneSnapshots, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RECORDS_CHANGED.sceneSnapshots, load);
    };
  }, [isOpen, projectId]);

  useEffect(() => {
    setOpen(false);
  }, [projectId]);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const id = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail?.id;
      if (id !== 'open-drafts' && id !== 'save-draft-milestone') return;
      setOpen(true);
      if (id === 'save-draft-milestone') setFocusNameToken((token) => token + 1);
    };
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
  }, []);

  const milestones = useMemo(() => groupDraftMilestones(snapshots), [snapshots]);
  const deletedScenes = useMemo(() => findDeletedScenes(snapshots, documents), [documents, snapshots]);

  const saveMilestone = useCallback(async (name: string): Promise<DraftMilestone | null> => {
    if (!projectId) return null;
    setWorking(true);
    try {
      const milestone = await saveDraftMilestone({projectId, name, openScene: openSceneRef.current});
      pushAppToast({message: `Draft milestone "${milestone.name}" saved.`});
      return milestone;
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to save the draft milestone.')});
      return null;
    } finally {
      setWorking(false);
    }
  }, [projectId]);

  const removeMilestone = useCallback(async (milestone: DraftMilestone) => {
    if (!projectId) return;
    try {
      await deleteDraftMilestone(projectId, milestone.id);
      pushAppToast({message: `Draft milestone "${milestone.name}" deleted.`});
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to delete the draft milestone.')});
    }
  }, [projectId]);

  const exportMilestone = useCallback((milestone: DraftMilestone, format: DraftExportFormat) => {
    if (!projectId) return;
    const params = {projectName: `${projectName} - ${milestone.name}`, scenes: milestoneAsDocuments(milestone, projectId)};
    if (format === 'markdown') exportScenesAsMarkdown(params);
    else if (format === 'docx') exportScenesAsDocx(params);
    else exportScenesAsEpub(params);
    pushAppToast({message: `Exported "${milestone.name}".`});
  }, [projectId, projectName]);

  const restoreDeletedScene = useCallback(async (snapshot: SceneSnapshot) => {
    setWorking(true);
    try {
      if (await onRestoreDeletedScene(snapshot)) setOpen(false);
    } finally {
      setWorking(false);
    }
  }, [onRestoreDeletedScene]);

  return {
    isOpen,
    close: useCallback(() => setOpen(false), []),
    focusNameToken,
    isLoaded,
    isWorking,
    milestones,
    deletedScenes,
    saveMilestone,
    removeMilestone,
    exportMilestone,
    restoreDeletedScene
  };
}

export type DraftMilestonesController = ReturnType<typeof useDraftMilestones>;
