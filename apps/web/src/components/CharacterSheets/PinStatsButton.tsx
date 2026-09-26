import {useAppStore} from '../../store/appStore';
import {useWorkspaceUiStore} from '../../store/workspaceUiStore';
import {announceStatus, pushAppToast} from '../../store/notificationStore';
import {getProjectCapabilities} from '../../projectMode';
import {MAX_STAT_PINS} from '../../services/state/statPanel';

const NO_PINS: string[] = [];

/** Pins a character's stat card to the app-shell panel; hidden without game systems. */
export function PinStatsButton({
  sheetId,
  name,
  className
}: {
  sheetId: string;
  name: string;
  className?: string;
}) {
  const projectId = useAppStore((s) => s.activeProject?.id ?? null);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const pins = useWorkspaceUiStore((s) =>
    projectId ? s.statPinsByProjectId[projectId] ?? NO_PINS : NO_PINS
  );
  const toggleStatPin = useWorkspaceUiStore((s) => s.toggleStatPin);
  if (!projectId || !getProjectCapabilities(projectSettings).canUseGameSystems) return null;

  const isPinned = pins.includes(sheetId);
  return (
    <button
      type='button'
      className={className}
      aria-pressed={isPinned}
      aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${name}'s stats`}
      onClick={() => {
        const result = toggleStatPin(projectId, sheetId);
        if (result === 'full') {
          pushAppToast({
            tone: 'info',
            message: `Up to ${MAX_STAT_PINS} characters can be pinned. Unpin one to pin ${name}.`
          });
          return;
        }
        announceStatus(result === 'pinned' ? `Pinned ${name}'s stats.` : `Unpinned ${name}'s stats.`);
      }}
    >
      {isPinned ? 'Unpin stats' : 'Pin stats'}
    </button>
  );
}
