import {useEffect} from 'react';
import {InlineAlert} from './InlineAlert';
import {useNotificationStore} from '../../store/notificationStore';

export interface RouteFeedbackValue {
  tone: 'success' | 'error' | 'info';
  message: string;
}

export interface RouteFeedbackProps {
  feedback: RouteFeedbackValue | null | undefined;
  /** Clears the route's local feedback state; called after a toast is posted or the alert is dismissed. */
  onClear: () => void;
  /** Send error feedback to the shell toast as well (Workspace). Default: render errors inline. */
  errorsAsToast?: boolean;
  className?: string;
}

/**
 * Bridges a route's local `{tone, message}` feedback state to the app-shell
 * notification split: success and info confirmations become shell toasts;
 * errors stay anchored where they happened as an `InlineAlert`.
 */
export function RouteFeedback({feedback, onClear, errorsAsToast = false, className}: RouteFeedbackProps) {
  const pushToast = useNotificationStore((state) => state.pushToast);
  const toToast = Boolean(feedback) && (feedback?.tone !== 'error' || errorsAsToast);

  useEffect(() => {
    if (!feedback || !toToast) return;
    pushToast({tone: feedback.tone, message: feedback.message});
    onClear();
    // onClear is a state setter wrapper; re-running on its identity would repost the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, toToast, pushToast]);

  if (!feedback || toToast) return null;
  return <InlineAlert variant='error' message={feedback.message} onDismiss={onClear} className={className} />;
}

export default RouteFeedback;
