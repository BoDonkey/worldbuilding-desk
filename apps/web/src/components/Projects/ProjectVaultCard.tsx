import type {Project} from '../../entityTypes';
import type {VaultState} from '../../services/storage';
import styles from '../../styles/ProjectsRoute.module.css';

/**
 * A locked project on the Projects page (slice 5.15b): only its label is
 * readable, so the card offers nothing but Unlock and Delete.
 */
export function LockedProjectCard(props: {
  project: Project;
  deleting: boolean;
  onUnlock: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={styles.projectCard} aria-label={`${props.project.name} (locked)`}>
      <div className={styles.projectHeader}>
        <strong className={styles.projectName}>{props.project.name}</strong>{' '}
        <span className={styles.activeBadge}>(locked)</span>
      </div>
      <p className={styles.sectionIntro}>Protected with a passphrase. Unlock it to open, export, or change it.</p>
      <div className={styles.projectActions}>
        <button type='button' onClick={props.onUnlock}>
          Unlock and Open
        </button>
        <button type='button' onClick={props.onDelete} disabled={props.deleting} className={styles.dangerButton}>
          {props.deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </li>
  );
}

/** Passphrase buttons on an open project's card. */
export function ProjectVaultActions(props: {
  state: VaultState | null;
  onProtect: () => void;
  onLock: () => void;
  onChangePassphrase: () => void;
  onRemoveProtection: () => void;
}) {
  if (props.state === 'migrating') return null;
  if (props.state === null) {
    return (
      <button type='button' onClick={props.onProtect} className={styles.backupButton}>
        Protect with Passphrase
      </button>
    );
  }
  return (
    <>
      <button type='button' onClick={props.onLock} className={styles.backupButton}>
        Lock Project
      </button>
      <button type='button' onClick={props.onChangePassphrase} className={styles.backupButton}>
        Change Passphrase
      </button>
      <button type='button' onClick={props.onRemoveProtection} className={styles.backupButton}>
        Remove Protection
      </button>
    </>
  );
}
