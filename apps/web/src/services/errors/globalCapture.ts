import {classifyError} from './describeError';
import {recordDiagnostic} from './diagnostics';

/**
 * Records uncaught errors and unhandled promise rejections in the local
 * diagnostics log so failures that no call site rendered still leave a
 * redacted trace on this computer. Nothing is transmitted.
 */
type CaptureTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export function installGlobalDiagnosticCapture(target: CaptureTarget = window): () => void {
  const onError = (event: Event) => {
    const errorEvent = event as ErrorEvent;
    const error = errorEvent.error ?? errorEvent.message;
    recordDiagnostic(error, {context: 'uncaught error', failureClass: classifyError(error)});
  };
  const onRejection = (event: Event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    recordDiagnostic(reason, {
      context: 'unhandled promise rejection',
      failureClass: classifyError(reason)
    });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
