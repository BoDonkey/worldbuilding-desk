import {useState} from 'react';
import {useAppUpdates} from '../../hooks/useAppUpdates';
import {UpdateActions} from './UpdateActions';
import {describeUpdateStatus, UPDATE_PRIVACY_NOTE} from './updateText';
import styles from '../../assets/components/UpdateNotice.module.css';

/**
 * Desktop-only corner card (Slice 5.1): asks once whether to check for
 * updates automatically, then tells the author about an update and its
 * progress. A failed automatic check stays quiet here (Settings shows it);
 * a failure after the author chose to download is shown.
 */
export function UpdateNotice() {
  const {snapshot, download, install, openReleasePage, setCheckAutomatically} = useAppUpdates();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  if (!snapshot?.supported) return null;

  if (snapshot.checkAutomatically === null) {
    return (
      <section className={styles.card} aria-labelledby='update-question-title'>
        <strong id='update-question-title'>Check for updates automatically?</strong>
        <p>SagaSpine can check for a newer version each time it starts. {UPDATE_PRIVACY_NOTE}</p>
        <p className={styles.hint}>You can change this any time in Settings → Updates.</p>
        <div className={styles.actions}>
          <button type='button' className={styles.button} onClick={() => void setCheckAutomatically(false)}>
            Don&apos;t check automatically
          </button>
          <button
            type='button'
            className={`${styles.button} ${styles.primary}`}
            onClick={() => void setCheckAutomatically(true)}
          >
            Check automatically
          </button>
        </div>
      </section>
    );
  }

  const {status} = snapshot;
  const showError = status.state === 'error' && downloadStarted;
  const showUpdate = status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded';
  const key = 'version' in status ? `${status.state}:${status.version}` : status.state;
  if ((!showUpdate && !showError) || dismissedKey === key) return null;

  return (
    <section className={styles.card} aria-labelledby='update-notice-title' aria-live='polite'>
      <strong id='update-notice-title'>{showError ? 'Update failed' : 'SagaSpine update'}</strong>
      <p>{describeUpdateStatus(snapshot)}</p>
      <div className={styles.actions}>
        {status.state !== 'downloading' && (
          <button type='button' className={styles.button} onClick={() => setDismissedKey(key)}>
            {showError ? 'Dismiss' : 'Later'}
          </button>
        )}
        <UpdateActions
          snapshot={snapshot}
          className={styles.button}
          primaryClassName={styles.primary}
          onDownload={() => {
            setDownloadStarted(true);
            void download();
          }}
          onInstall={() => void install()}
          onOpenReleasePage={() => void openReleasePage()}
        />
      </div>
    </section>
  );
}
