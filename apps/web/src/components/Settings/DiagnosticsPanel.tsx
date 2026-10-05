import {useCallback, useState, useSyncExternalStore} from 'react';
import {InlineAlert, type InlineAlertVariant} from '../common';
import {
  buildDiagnosticReport,
  clearDiagnostics,
  listDiagnostics,
  subscribeDiagnostics
} from '../../services/errors';
import styles from '../../assets/components/Settings/DiagnosticsPanel.module.css';
import {copyText} from '../../utils/clipboard';

interface DiagnosticsPanelProps {
  /** Exact secret values (configured API keys) to scrub from the report. */
  secrets?: readonly string[];
}

const FAILURE_CLASS_LABELS: Record<string, string> = {
  network: 'Network',
  auth: 'Provider key',
  quota: 'Provider limit',
  'provider-unavailable': 'Provider outage',
  'storage-full': 'Local storage full',
  'schema-too-new': 'Newer project version',
  aborted: 'Cancelled',
  migration: 'Project migration',
  'app-message': 'App message',
  unknown: 'Unexpected error'
};

function formatTime(at: number): string {
  return new Date(at).toLocaleString();
}

/**
 * Local-only diagnostics view (slice 5.6). Shows the redacted error log kept
 * on this computer and lets the author copy it into a support request. It
 * never sends anything on its own.
 */
export function DiagnosticsPanel({secrets = []}: DiagnosticsPanelProps) {
  const entries = useSyncExternalStore(subscribeDiagnostics, listDiagnostics, listDiagnostics);
  const [report, setReport] = useState<string | null>(null);
  const [status, setStatus] = useState<{variant: InlineAlertVariant; message: string} | null>(null);

  const handleCopy = useCallback(async () => {
    const text = buildDiagnosticReport({secrets});
    const copied = await copyText(text);
    setStatus(
      copied
        ? {variant: 'success', message: 'Diagnostic report copied. Paste it into your support message.'}
        : {variant: 'error', message: 'Could not copy automatically. Use Show report and copy the text by hand.'}
    );
    if (!copied) setReport(text);
  }, [secrets]);

  const handleToggleReport = useCallback(() => {
    setReport((current) => (current === null ? buildDiagnosticReport({secrets}) : null));
  }, [secrets]);

  const handleClear = useCallback(() => {
    clearDiagnostics();
    setReport(null);
    setStatus({variant: 'info', message: 'Diagnostic log cleared.'});
  }, []);

  return (
    <div className={styles.container} data-testid='diagnostics-panel'>
      <p className={styles.help}>
        Stored locally. When something goes wrong, the app keeps a short, redacted
        note here: the kind of failure, a plain description, and the code location.
        Manuscript text, project data, API keys, and file paths are left out.
        Nothing is sent anywhere unless you copy it into a support request yourself.
      </p>
      {status ? (
        <InlineAlert
          variant={status.variant}
          message={status.message}
          onDismiss={() => setStatus(null)}
          autoDismissMs={status.variant === 'error' ? undefined : 4000}
        />
      ) : null}
      <div className={styles.actions}>
        <button type='button' className={styles.secondaryButton} onClick={() => void handleCopy()}>
          Copy diagnostic report
        </button>
        <button type='button' className={styles.secondaryButton} onClick={handleToggleReport}>
          {report === null ? 'Show report' : 'Hide report'}
        </button>
        <button
          type='button'
          className={styles.secondaryButton}
          onClick={handleClear}
          disabled={entries.length === 0}
        >
          Clear log
        </button>
      </div>
      {report !== null ? (
        <pre className={styles.report} aria-label='Diagnostic report'>
          {report}
        </pre>
      ) : null}
      {entries.length === 0 ? (
        <p className={styles.empty}>No errors recorded on this computer.</p>
      ) : (
        <ul className={styles.entryList} aria-label='Recent errors'>
          {entries.slice(0, 10).map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <span className={styles.entryMeta}>
                {formatTime(entry.at)} · {FAILURE_CLASS_LABELS[entry.failureClass] ?? entry.failureClass}
                {entry.context ? ` · ${entry.context}` : ''}
              </span>
              <span className={styles.entryMessage}>
                {entry.name}: {entry.message || '(no message)'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DiagnosticsPanel;
