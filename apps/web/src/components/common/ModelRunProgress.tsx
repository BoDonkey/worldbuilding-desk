import styles from '../../assets/components/common/ModelRunProgress.module.css';
import type {UseModelRun} from '../../hooks/useModelRun';
import {formatElapsed} from '../../services/llm/modelRun';

const PHASE_LABELS = {
  waiting: 'Waiting for the model',
  thinking: 'Thinking',
  answering: 'Writing the answer'
} as const;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export interface ModelRunProgressProps {
  run: Pick<UseModelRun, 'status' | 'thinking' | 'elapsedMs' | 'isRunning' | 'stop'>;
  className?: string;
}

/**
 * Point-of-use progress for one model run (Slice 4.40): the phase, how long it has been running,
 * the model's thinking as it streams, and Stop. After the run the thinking stays readable behind
 * "Show thinking" until the next request; it is never saved.
 */
export function ModelRunProgress({run, className}: ModelRunProgressProps) {
  const {status, thinking, elapsedMs, isRunning, stop} = run;
  if (status === 'idle') return null;

  const rootClass = [styles.progress, className].filter(Boolean).join(' ');
  const thinkingWords = countWords(thinking);

  if (isRunning) {
    const phase = PHASE_LABELS[status as keyof typeof PHASE_LABELS];
    return (
      <div className={rootClass}>
        <div className={styles.statusRow}>
          <span className={styles.spinner} aria-hidden='true' />
          <span role='status'>{phase}…</span>
          <span className={styles.elapsed} aria-label={`Elapsed ${formatElapsed(elapsedMs)}`}>
            {formatElapsed(elapsedMs)}
          </span>
          <button type='button' className={styles.stopButton} onClick={stop}>
            Stop
          </button>
        </div>
        {thinking && (
          <details className={styles.thinking} open={status === 'thinking'}>
            <summary>Thinking ({thinkingWords} word{thinkingWords === 1 ? '' : 's'} so far)</summary>
            <div className={styles.thinkingText}>{thinking}</div>
          </details>
        )}
      </div>
    );
  }

  const summary = status === 'stopped'
    ? `Stopped after ${formatElapsed(elapsedMs)}.`
    : status === 'error'
      ? `Failed after ${formatElapsed(elapsedMs)}.`
      : `Finished in ${formatElapsed(elapsedMs)}.`;

  return (
    <div className={rootClass}>
      <div className={styles.statusRow}>
        <span className={styles.summary}>{summary}</span>
      </div>
      {thinking && (
        <details className={styles.thinking}>
          <summary>Show thinking ({thinkingWords} word{thinkingWords === 1 ? '' : 's'})</summary>
          <div className={styles.thinkingText}>{thinking}</div>
        </details>
      )}
    </div>
  );
}
