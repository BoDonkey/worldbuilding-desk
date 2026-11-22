import {useState} from 'react';
import type {FormEvent} from 'react';
import {saveDraftMilestone} from '../../services/editor/draftMilestones';
import {describeError} from '../../services/errors';
import {pushAppToast} from '../../store/notificationStore';
import styles from '../../assets/components/BackupPassphraseDialog.module.css';
import {DialogFrame} from './BackupPassphraseDialog';

/**
 * Save draft milestone from a project card (slice 4.96): a snapshot of every
 * scene as last saved. The Workspace's Drafts dialog lists and opens it.
 */
export function ProjectDraftMilestoneButton({projectId, projectName, className}: {
  projectId: string;
  projectName: string;
  className?: string;
}) {
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const milestone = await saveDraftMilestone({projectId, name});
      pushAppToast({message: `Draft milestone "${milestone.name}" saved for ${projectName}.`});
      setOpen(false);
      setName('');
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to save the draft milestone.')});
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type='button' className={className} onClick={() => setOpen(true)}>
        Save draft milestone
      </button>
      {isOpen && (
        <DialogFrame
          titleId={`draft-milestone-${projectId}`}
          title={`Save a draft milestone of ${projectName}`}
          busy={busy}
          onCancel={() => setOpen(false)}
          onSubmit={(event) => void submit(event)}
          submitLabel='Save draft milestone'
          busyLabel='Saving…'
        >
          <p>A snapshot of every scene as last saved. Open it from Drafts in the Workspace.</p>
          <label className={styles.field}>
            Milestone name
            <input
              className={styles.input}
              type='text'
              value={name}
              placeholder='Draft 1 complete'
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </DialogFrame>
      )}
    </>
  );
}
