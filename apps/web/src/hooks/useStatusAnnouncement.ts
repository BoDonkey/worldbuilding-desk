import {useCallback} from 'react';
import {useNotificationStore} from '../store/notificationStore';

/**
 * Returns a stable `announce(message, {assertive?})` that feeds the app
 * shell's single shared live region. Use it for async state changes that have
 * no visible confirmation of their own: autosave, review refresh, extraction,
 * migration, and AI streaming. Visible confirmations should use a toast,
 * which the shell already announces.
 */
export function useStatusAnnouncement() {
  const announce = useNotificationStore((state) => state.announce);
  return useCallback(
    (message: string, options?: {assertive?: boolean}) => {
      announce(message, options);
    },
    [announce]
  );
}

export default useStatusAnnouncement;
