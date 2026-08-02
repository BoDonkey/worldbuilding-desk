import {useCallback, useMemo, useState} from 'react';
import {ConfirmDialog} from '../components/common/ConfirmDialog';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  /**
   * Runs when the dialog is dismissed without confirming (Cancel button,
   * Escape, or overlay click). Only needed for the rare dialog where
   * "cancel" means "do the other thing" rather than "do nothing" — e.g. a
   * replace-vs-append choice. Defaults to a no-op.
   */
  onCancel?: () => void | Promise<void>;
}

/**
 * Owns one `ConfirmDialog` instance for a route/component and exposes an
 * imperative `requestConfirm(...)` function as a theme-consistent, async
 * replacement for `window.confirm(...)`. Callers that used to write:
 *
 *   if (!window.confirm('Delete this?')) return;
 *   doThing();
 *
 * instead write:
 *
 *   requestConfirm({title: 'Delete this?', message: '...', onConfirm: doThing});
 *
 * `doThing` only runs if the user confirms, same as before — the dialog
 * defers the call instead of blocking synchronously. Render `confirmDialog`
 * once near the root of the owning component/route.
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const requestConfirm = useCallback((next: ConfirmRequest) => {
    setRequest(next);
  }, []);

  const handleCancel = useCallback(() => {
    const pending = request;
    setRequest(null);
    void pending?.onCancel?.();
  }, [request]);

  const handleConfirm = useCallback(() => {
    const pending = request;
    setRequest(null);
    void pending?.onConfirm();
  }, [request]);

  const confirmDialog = useMemo(
    () => (
      <ConfirmDialog
        isOpen={request !== null}
        title={request?.title ?? ''}
        message={request?.message ?? ''}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        variant={request?.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [handleCancel, handleConfirm, request]
  );

  return {requestConfirm, confirmDialog};
}

export default useConfirmDialog;
