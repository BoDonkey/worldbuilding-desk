import type {AppUpdateSnapshot} from '../../hooks/useAppUpdates';

export const UPDATE_PRIVACY_NOTE =
  'The check asks GitHub whether a newer SagaSpine exists. It sends no project data, and nothing downloads without your OK.';

/** One line for the current update state, or null when there is nothing to say. */
export function describeUpdateStatus(snapshot: AppUpdateSnapshot): string | null {
  const {status, installMode} = snapshot;
  switch (status.state) {
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return 'SagaSpine is up to date.';
    case 'available':
      return installMode === 'in-app'
        ? `SagaSpine ${status.version} is available.`
        : `SagaSpine ${status.version} is available. Download it from the release page and install it over this version; your projects stay where they are.`;
    case 'downloading':
      return `Downloading SagaSpine ${status.version}… ${Math.round(status.percent)}%`;
    case 'downloaded':
      return `SagaSpine ${status.version} is ready. It installs when you restart, or the next time you quit.`;
    case 'error':
      return status.message;
    default:
      return null;
  }
}
