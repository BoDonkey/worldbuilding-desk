import {Link} from 'react-router';
import type {ModelCanonCheckController} from '../../hooks/useModelCanonCheck';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import styles from '../../styles/WorkspaceRoute.module.css';

interface CanonCheckPanelProps {
  check: ModelCanonCheckController;
  sceneTitle: string | null;
}

/**
 * The review drawer's **Check this scene against canon** action (4.38):
 * explicit, previewed, and confirmed. Validated candidates join the review
 * queue only when the author adds them.
 */
export function CanonCheckPanel({check, sceneTitle}: CanonCheckPanelProps) {
  const {preview, modelRun, budget} = check;
  if (sceneTitle === null) return null;

  const notes = preview
    ? [
        `Checked against ${preview.factCount} accepted fact${preview.factCount === 1 ? '' : 's'}.`,
        preview.truncated ? 'The scene is long, so only its first part was checked.' : '',
        preview.rejectedCount > 0
          ? `${preview.rejectedCount} suggestion${preview.rejectedCount === 1 ? ' was' : 's were'} discarded because ` +
            'they did not quote this scene exactly or did not cite a fact that was sent.'
          : ''
      ].filter(Boolean)
    : [];

  return (
    <section aria-label='Model-assisted canon check'>
      <div className={styles.consistencyDescription}>
        <strong>Check against canon</strong> asks the AI to read this scene for contradictions the
        automatic review cannot catch, such as paraphrase. You review every result.
      </div>
      <div className={styles.consistencyPanelHeader}>
        <button type='button' onClick={() => void check.run()} disabled={!check.canCheck}>
          {modelRun.isRunning ? 'Checking…' : 'Check this scene against canon'}
        </button>
      </div>
      {!check.consultationEnabled ? (
        <div className={styles.consistencyDescription}>
          AI consultation actions are off for this project. <Link to='/settings'>Open Settings</Link>
        </div>
      ) : check.providerIssue ? (
        <div className={styles.consistencyDescription}>
          {check.providerIssue} <Link to='/settings'>Open Settings</Link>
        </div>
      ) : (
        check.disclosure && <div className={styles.consistencyReason}>{check.disclosure}</div>
      )}
      <ConsultationBudgetNotice
        status={budget.status}
        isLocal={budget.isLocal}
        onGrantMore={budget.grantMore}
        hidden={!check.consultationEnabled || Boolean(check.providerIssue)}
      />
      <ModelRunProgress run={modelRun} />
      {check.error && <div className={styles.consistencyDescription} role='alert'>{check.error}</div>}
      {check.message && <div className={styles.consistencyDescription} role='status'>{check.message}</div>}
      {preview && preview.items.length === 0 && (
        <div className={styles.consistencyDescription} role='status'>
          No contradictions found in {sceneTitle || 'this scene'}. {notes.join(' ')}{' '}
          <button type='button' className={styles.consistencyRelatedButton} onClick={check.discard}>OK</button>
        </div>
      )}
      {preview && preview.items.length > 0 && (
        <AIProposalPreview
          title={`Add ${preview.items.length} possible conflict${preview.items.length === 1 ? '' : 's'} to review`}
          onDismiss={check.discard}
          onConfirm={check.confirm}
        >
          <ul className={styles.consistencyList}>
            {preview.items.map((item) => (
              <li key={item.id} className={styles.consistencyListItem}>
                <div>{item.issue.message}</div>
                {item.reviewAnnotation?.summary && (
                  <div className={styles.consistencyDescription}>{item.reviewAnnotation.summary}</div>
                )}
              </li>
            ))}
          </ul>
          {notes.length > 0 && <div className={styles.consistencyReason}>{notes.join(' ')}</div>}
        </AIProposalPreview>
      )}
    </section>
  );
}
