import {useMemo, useState, type ReactNode} from 'react';
import {compareSnapshotWithCurrent, plainWordOps, wordLabel} from '../../services/editor/sceneSnapshots';
import {PARAGRAPH_BREAK_TOKEN, type WordDiffOp} from '../../services/editor/wordDiff';
import styles from './SceneVersions.module.css';

/** Paragraphs of word tokens, with added and removed words marked. */
export function WordTokens({ops}: {ops: WordDiffOp[]}): ReactNode {
  const paragraphs: WordDiffOp[][] = [[]];
  for (const op of ops) {
    if (op.token === PARAGRAPH_BREAK_TOKEN) paragraphs.push([]);
    else paragraphs[paragraphs.length - 1].push(op);
  }
  return paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph, index) => (
      <p key={index}>
        {paragraph.map((op, opIndex) => {
          const space = opIndex > 0 ? ' ' : '';
          if (op.kind === 'added') return <span key={opIndex}>{space}<ins className={styles.added}>{op.token}</ins></span>;
          if (op.kind === 'removed') return <span key={opIndex}>{space}<del className={styles.removed}>{op.token}</del></span>;
          return <span key={opIndex}>{space}{op.token}</span>;
        })}
      </p>
    ));
}

interface SnapshotCompareProps {
  snapshotHeading: string;
  snapshotHtml: string;
  /** The scene now, or null when it has since been deleted. */
  currentHtml: string | null;
  actions?: ReactNode;
}

/**
 * A saved text read-only beside the scene now (slices 4.95, 4.96). Compare
 * marks the words removed since the snapshot and the words added. Give it a
 * `key` per snapshot so Compare resets.
 */
export function SnapshotCompare({snapshotHeading, snapshotHtml, currentHtml, actions}: SnapshotCompareProps) {
  const [isComparing, setComparing] = useState(false);
  const comparison = useMemo(
    () => (isComparing && currentHtml !== null ? compareSnapshotWithCurrent(snapshotHtml, currentHtml) : null),
    [currentHtml, isComparing, snapshotHtml]
  );
  const snapshotOps = useMemo(() => plainWordOps(snapshotHtml), [snapshotHtml]);
  const currentOps = useMemo(() => (currentHtml === null ? [] : plainWordOps(currentHtml)), [currentHtml]);

  return (
    <section className={styles.detail} aria-label='Selected snapshot'>
      <div className={styles.detailBar}>
        <label className={styles.compareToggle}>
          <input
            type='checkbox'
            checked={isComparing}
            disabled={currentHtml === null}
            onChange={(event) => setComparing(event.target.checked)}
          />
          Compare
        </label>
        {comparison && (
          <span className={styles.summary} data-testid='snapshot-compare-summary'>
            Since this snapshot: {wordLabel(comparison.added)} added, {wordLabel(comparison.removed)} removed.
          </span>
        )}
        {actions && <div className={styles.detailActions}>{actions}</div>}
      </div>
      <div className={styles.panes}>
        <div className={styles.pane}>
          <h4 className={styles.paneHeading}>{snapshotHeading}</h4>
          <div className={styles.text} data-testid='snapshot-text'>
            <WordTokens ops={comparison ? comparison.snapshot : snapshotOps} />
          </div>
        </div>
        <div className={styles.pane}>
          <h4 className={styles.paneHeading}>Current text</h4>
          <div className={styles.text} data-testid='snapshot-current-text'>
            {currentHtml === null
              ? <p className={styles.deletedNote}>This scene has since been deleted.</p>
              : <WordTokens ops={comparison ? comparison.current : currentOps} />}
          </div>
        </div>
      </div>
    </section>
  );
}
