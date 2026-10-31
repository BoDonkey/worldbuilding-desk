import type {AppUpdateSnapshot} from '../../hooks/useAppUpdates';

interface UpdateActionsProps {
  snapshot: AppUpdateSnapshot;
  onDownload: () => void;
  onInstall: () => void;
  onOpenReleasePage: () => void;
  className?: string;
  primaryClassName?: string;
}

/** The next step for an available or downloaded update, if there is one. */
export function UpdateActions({
  snapshot,
  onDownload,
  onInstall,
  onOpenReleasePage,
  className,
  primaryClassName
}: UpdateActionsProps) {
  const {status, installMode} = snapshot;
  const buttonClass = [className, primaryClassName].filter(Boolean).join(' ') || undefined;
  if (status.state === 'available') {
    return installMode === 'in-app' ? (
      <button type='button' className={buttonClass} onClick={onDownload}>
        Download update
      </button>
    ) : (
      <button type='button' className={buttonClass} onClick={onOpenReleasePage}>
        Open download page
      </button>
    );
  }
  if (status.state === 'downloading') {
    return (
      <progress
        max={100}
        value={status.percent}
        aria-label={`Downloading SagaSpine ${status.version}`}
      />
    );
  }
  if (status.state === 'downloaded') {
    return (
      <button type='button' className={buttonClass} onClick={onInstall}>
        Restart to update
      </button>
    );
  }
  return null;
}
