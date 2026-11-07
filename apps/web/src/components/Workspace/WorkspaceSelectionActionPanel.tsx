import {AssistantReplyReader} from '../AIAssistant/AssistantReplyReader';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import type {SelectionActionRunController} from '../../hooks/useSelectionActionRun';
import styles from './WorkspaceSelectionActionPanel.module.css';

/**
 * Progress and outcome of a custom AI action run from the selection menu (Slice 5.19), above the
 * editor: the provider disclosure, the run's progress with Stop, and any error. A note result opens
 * in the reply reader; a rewrite opens the scene revision preview in the editor.
 */
export function WorkspaceSelectionActionPanel({controller}: {controller: SelectionActionRunController}) {
  const {actionName, modelRun, budget, disclosure, error, message, note, closeNote, dismiss} = controller;
  return (
    <>
      {actionName && (
        <section className={styles.panel} aria-label={`AI action: ${actionName}`}>
          <div className={styles.header}>
            <strong>{actionName}</strong>
            {!modelRun.isRunning && (
              <button type='button' onClick={dismiss}>
                Dismiss
              </button>
            )}
          </div>
          {modelRun.isRunning && disclosure && <p className={styles.disclosure}>{disclosure}</p>}
          <ModelRunProgress run={modelRun} />
          {error && <p role='alert' className={styles.error}>{error}</p>}
          {message && <p role='status' className={styles.message}>{message}</p>}
          <ConsultationBudgetNotice
            status={budget.status}
            isLocal={budget.isLocal}
            onGrantMore={budget.grantMore}
            hidden={!budget.blocked}
          />
        </section>
      )}
      {note && (
        <AssistantReplyReader
          content={note.content}
          question={note.question}
          isStreaming={false}
          onClose={closeNote}
        />
      )}
    </>
  );
}
