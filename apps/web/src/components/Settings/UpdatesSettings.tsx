import {useId} from 'react';
import {useAppUpdates} from '../../hooks/useAppUpdates';
import {UpdateActions} from '../Updates/UpdateActions';
import {describeUpdateStatus, UPDATE_PRIVACY_NOTE} from '../Updates/updateText';

/** Settings → Updates (Slice 5.1): the automatic-check choice and a manual check. */
export function UpdatesSettings() {
  const {snapshot, check, download, install, openReleasePage, setCheckAutomatically} = useAppUpdates();
  const toggleId = useId();
  const hintId = useId();
  if (!snapshot) return null;
  if (!snapshot.supported) {
    return <p>Updates are available in the installed SagaSpine app. This build ({snapshot.currentVersion}) does not update itself.</p>;
  }
  const busy = ['checking', 'downloading', 'downloaded'].includes(snapshot.status.state);
  const statusText = describeUpdateStatus(snapshot);
  return (
    <div>
      <p>Version {snapshot.currentVersion}</p>
      <label htmlFor={toggleId}>
        <input
          id={toggleId}
          type='checkbox'
          checked={snapshot.checkAutomatically === true}
          aria-describedby={hintId}
          onChange={(event) => void setCheckAutomatically(event.target.checked)}
        />{' '}
        Check for updates automatically when SagaSpine starts
      </label>
      <p id={hintId}>{UPDATE_PRIVACY_NOTE}</p>
      <button type='button' onClick={() => void check()} disabled={busy}>
        Check for updates
      </button>
      <p role='status'>{statusText}</p>
      <UpdateActions
        snapshot={snapshot}
        onDownload={() => void download()}
        onInstall={() => void install()}
        onOpenReleasePage={() => void openReleasePage()}
      />
    </div>
  );
}
