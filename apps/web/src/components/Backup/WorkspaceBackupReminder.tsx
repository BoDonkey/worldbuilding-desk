import {useEffect, useState} from 'react';
import type {Project} from '../../entityTypes';
import {getDocumentsByProject, getEntitiesByProject, getProjectById} from '../../services/storage';
import {projectHasRealContent} from '../../services/backup/backupReminder';
import {useAppStore} from '../../store/appStore';
import {useBackupReminders} from '../../hooks/useBackupReminders';
import {useBackupPassphraseFlow} from '../../hooks/useBackupPassphraseFlow';
import {useProjectBackupExport} from '../../hooks/useProjectBackupExport';
import {RouteFeedback, type RouteFeedbackValue} from '../common';
import {BackupReminder} from './BackupReminder';

/**
 * The backup reminder at the top of the Workspace (4.93), for the open
 * project. It reads the project's stored record, not the app store's copy, so
 * a backup made from Projects is already counted.
 */
export function WorkspaceBackupReminder() {
  const projectId = useAppStore((s) => s.activeProject?.id ?? null);
  const reminders = useBackupReminders();
  const {isTimeDue} = reminders;
  const [dueProject, setDueProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState<RouteFeedbackValue | null>(null);
  const {chooseExport, backupDialogs} = useBackupPassphraseFlow();
  const {exportBackup, exportingProjectId} = useProjectBackupExport({
    chooseExport,
    onMessage: setFeedback,
    onBackedUp: () => setDueProject(null)
  });

  useEffect(() => {
    let live = true;
    setDueProject(null);
    if (!projectId) return;
    void (async () => {
      const project = await getProjectById(projectId);
      // Time first: the content check reads every scene, so skip it when nothing is due.
      if (!project || !isTimeDue(project)) return;
      const [documents, entities] = await Promise.all([
        getDocumentsByProject(projectId),
        getEntitiesByProject(projectId)
      ]);
      if (live && projectHasRealContent({documents, entityCount: entities.length})) setDueProject(project);
    })().catch(() => {
      // A reminder that cannot be worked out is simply not shown.
    });
    return () => {
      live = false;
    };
  }, [projectId, isTimeDue]);

  return (
    <>
      {dueProject ? (
        <BackupReminder
          project={dueProject}
          now={reminders.now}
          storageNote={reminders.storageNote}
          busy={exportingProjectId === dueProject.id}
          onBackUp={() => void exportBackup(dueProject)}
          onSnooze={() => {
            reminders.snooze(dueProject.id);
            setDueProject(null);
          }}
        />
      ) : null}
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} errorsAsToast />
      {backupDialogs}
    </>
  );
}
