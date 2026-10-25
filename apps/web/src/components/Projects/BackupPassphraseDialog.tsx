import {useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {checkNewBackupPassphrase, MIN_BACKUP_PASSPHRASE_LENGTH} from '../../services/storage';
import styles from '../../assets/components/BackupPassphraseDialog.module.css';

const RECOVERY_WARNING =
  'SagaSpine never stores this passphrase and has no way to recover it. Without it, this backup cannot be opened.';

function DialogFrame(props: {
  titleId: string;
  title: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  submitLabel: string;
  busyLabel: string;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const cancel = () => {
    if (!props.busy) props.onCancel();
  };
  useEscapeToClose(cancel, true);
  useFocusTrap(dialogRef, true);
  return (
    <div className={styles.overlay} onClick={cancel} role='presentation'>
      <form
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={props.titleId}
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        onSubmit={props.onSubmit}
        noValidate
      >
        <h2 id={props.titleId} className={styles.title}>
          {props.title}
        </h2>
        {props.children}
        <div className={styles.actions}>
          <button type='button' className={styles.cancelButton} onClick={cancel} disabled={props.busy}>
            Cancel
          </button>
          <button type='submit' className={styles.primaryButton} disabled={props.busy}>
            {props.busy ? props.busyLabel : props.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Chooses a plain or passphrase-protected backup before export (slice 5.14). */
export function ExportBackupDialog(props: {
  projectName: string;
  busy: boolean;
  onExport: (passphrase: string | undefined) => void;
  onCancel: () => void;
}) {
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!encrypt) {
      props.onExport(undefined);
      return;
    }
    const issue = checkNewBackupPassphrase(passphrase, confirmation);
    setProblem(issue);
    if (!issue) props.onExport(passphrase);
  };

  return (
    <DialogFrame
      titleId='export-backup-title'
      title={`Export a backup of “${props.projectName}”`}
      busy={props.busy}
      onCancel={props.onCancel}
      onSubmit={submit}
      submitLabel='Export Backup'
      busyLabel={encrypt ? 'Encrypting…' : 'Exporting…'}
    >
      <fieldset className={styles.choices}>
        <legend className={styles.message}>Choose how to save it.</legend>
        <label className={styles.choice}>
          <input type='radio' name='backup-kind' checked={!encrypt} onChange={() => setEncrypt(false)} />
          <span>
            Plain backup (.zip)
            <span className={styles.choiceHelp}>Anyone who has the file can read it.</span>
          </span>
        </label>
        <label className={styles.choice}>
          <input type='radio' name='backup-kind' checked={encrypt} onChange={() => setEncrypt(true)} />
          <span>
            Encrypted backup (.sagabackup)
            <span className={styles.choiceHelp}>Needs a passphrase to open, on this or another computer.</span>
          </span>
        </label>
      </fieldset>
      {encrypt && (
        <>
          <label className={styles.field}>
            Passphrase
            <input
              type='password'
              className={styles.input}
              autoComplete='new-password'
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              aria-describedby='export-backup-passphrase-help'
              disabled={props.busy}
            />
          </label>
          <label className={styles.field}>
            Confirm passphrase
            <input
              type='password'
              className={styles.input}
              autoComplete='new-password'
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={props.busy}
            />
          </label>
          <p id='export-backup-passphrase-help' className={styles.warning}>
            At least {MIN_BACKUP_PASSPHRASE_LENGTH} characters. {RECOVERY_WARNING}
          </p>
          {problem && (
            <p className={styles.error} role='alert'>
              {problem}
            </p>
          )}
        </>
      )}
    </DialogFrame>
  );
}

/** Asks for the passphrase of an encrypted backup before it is read. */
export function UnlockBackupDialog(props: {
  fileName: string;
  busy: boolean;
  error: string | null;
  onUnlock: (passphrase: string) => void;
  onCancel: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passphrase) props.onUnlock(passphrase);
  };
  return (
    <DialogFrame
      titleId='unlock-backup-title'
      title='Open an encrypted backup'
      busy={props.busy}
      onCancel={props.onCancel}
      onSubmit={submit}
      submitLabel='Open Backup'
      busyLabel='Opening…'
    >
      <p className={styles.message}>
        “{props.fileName}” is encrypted. Enter the passphrase it was exported with. Nothing is read or imported until
        it opens.
      </p>
      <label className={styles.field}>
        Passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='off'
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? 'unlock-backup-error' : undefined}
          disabled={props.busy}
        />
      </label>
      {props.error && (
        <p id='unlock-backup-error' className={styles.error} role='alert'>
          {props.error}
        </p>
      )}
    </DialogFrame>
  );
}
