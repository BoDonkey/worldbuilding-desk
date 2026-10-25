import {useState} from 'react';
import type {FormEvent} from 'react';
import {checkNewVaultPassphrase, DEFAULT_VAULT_LABEL, MIN_VAULT_PASSPHRASE_LENGTH} from '../../services/storage';
import {DialogFrame} from './BackupPassphraseDialog';
import styles from '../../assets/components/BackupPassphraseDialog.module.css';

/** Turns on passphrase protection for a project (slice 5.15b). */
export function ProtectProjectDialog(props: {
  projectName: string;
  busy: boolean;
  error: string | null;
  onProtect: (passphrase: string, label: string) => void;
  onCancel: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [label, setLabel] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issue =
      checkNewVaultPassphrase(passphrase, confirmation) ??
      (acknowledged ? null : 'Confirm that you understand the passphrase cannot be recovered.');
    setProblem(issue);
    if (!issue) props.onProtect(passphrase, label);
  };
  const shownError = problem ?? props.error;

  return (
    <DialogFrame
      titleId='protect-project-title'
      title={`Protect “${props.projectName}” with a passphrase`}
      busy={props.busy}
      onCancel={props.onCancel}
      onSubmit={submit}
      submitLabel='Protect Project'
      busyLabel='Protecting…'
    >
      <p className={styles.message}>
        SagaSpine encrypts this project on this computer. It locks when the app restarts, when you open another project,
        or when you choose <strong>Lock project</strong>, and opens only with this passphrase.
      </p>
      <label className={styles.field}>
        Passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='new-password'
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          aria-describedby='protect-project-help'
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
      <label className={styles.field}>
        Name shown while locked (optional)
        <input
          type='text'
          className={styles.input}
          value={label}
          placeholder={DEFAULT_VAULT_LABEL}
          onChange={(event) => setLabel(event.target.value)}
          aria-describedby='protect-project-label-help'
          disabled={props.busy}
        />
        <span id='protect-project-label-help' className={styles.choiceHelp}>
          Not encrypted: anyone using this computer can see it. Leave it empty to show “{DEFAULT_VAULT_LABEL}”.
        </span>
      </label>
      <p id='protect-project-help' className={styles.warning}>
        At least {MIN_VAULT_PASSPHRASE_LENGTH} characters. SagaSpine never stores this passphrase and has no way to
        recover it. If you lose it, this project is lost. Protection covers what is saved on this computer, not text
        on screen while it is unlocked or files you export without encryption.
      </p>
      <label className={styles.choice}>
        <input
          type='checkbox'
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={props.busy}
        />
        <span>I understand that a lost passphrase cannot be recovered.</span>
      </label>
      {shownError && (
        <p className={styles.error} role='alert'>
          {shownError}
        </p>
      )}
    </DialogFrame>
  );
}

/** Asks for a project's passphrase: to unlock it, or to remove its protection. */
export function ProjectPassphraseDialog(props: {
  titleId: string;
  title: string;
  message: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const errorId = `${props.titleId}-error`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passphrase) props.onSubmit(passphrase);
  };
  return (
    <DialogFrame
      titleId={props.titleId}
      title={props.title}
      busy={props.busy}
      onCancel={props.onCancel}
      onSubmit={submit}
      submitLabel={props.submitLabel}
      busyLabel={props.busyLabel}
    >
      <p className={styles.message}>{props.message}</p>
      <label className={styles.field}>
        Passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='current-password'
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? errorId : undefined}
          disabled={props.busy}
        />
      </label>
      {props.error && (
        <p id={errorId} className={styles.error} role='alert'>
          {props.error}
        </p>
      )}
    </DialogFrame>
  );
}

/** Changes a protected project's passphrase. */
export function ChangeProjectPassphraseDialog(props: {
  projectName: string;
  busy: boolean;
  error: string | null;
  onChange: (current: string, next: string) => void;
  onCancel: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issue = current ? checkNewVaultPassphrase(next, confirmation) : 'Enter the current passphrase.';
    setProblem(issue);
    if (!issue) props.onChange(current, next);
  };
  const shownError = problem ?? props.error;
  return (
    <DialogFrame
      titleId='change-project-passphrase-title'
      title={`Change the passphrase for “${props.projectName}”`}
      busy={props.busy}
      onCancel={props.onCancel}
      onSubmit={submit}
      submitLabel='Change Passphrase'
      busyLabel='Changing…'
    >
      <label className={styles.field}>
        Current passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='current-password'
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          disabled={props.busy}
        />
      </label>
      <label className={styles.field}>
        New passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='new-password'
          value={next}
          onChange={(event) => setNext(event.target.value)}
          disabled={props.busy}
        />
      </label>
      <label className={styles.field}>
        Confirm new passphrase
        <input
          type='password'
          className={styles.input}
          autoComplete='new-password'
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={props.busy}
        />
      </label>
      <p className={styles.warning}>
        At least {MIN_VAULT_PASSPHRASE_LENGTH} characters. The old passphrase stops working. The new one cannot be
        recovered either.
      </p>
      {shownError && (
        <p className={styles.error} role='alert'>
          {shownError}
        </p>
      )}
    </DialogFrame>
  );
}
