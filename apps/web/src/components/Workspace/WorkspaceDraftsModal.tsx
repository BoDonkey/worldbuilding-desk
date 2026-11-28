import {useEffect, useRef, useState} from 'react';
import type {SceneSnapshot, WritingDocument} from '../../entityTypes';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useDraftMilestones, type DraftExportFormat} from '../../hooks/useDraftMilestones';
import {ExportParagraphStyleChoice} from './ExportParagraphStyleChoice';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import type {DeletedScene, DraftMilestone} from '../../services/editor/draftMilestones';
import {
  formatSnapshotTime,
  plainWordOps,
  snapshotTitle,
  wordLabel
} from '../../services/editor/sceneSnapshots';
import workspaceStyles from '../../styles/WorkspaceRoute.module.css';
import {SnapshotCompare, WordTokens} from './SnapshotCompare';
import styles from './SceneVersions.module.css';

interface WorkspaceDraftsModalProps {
  projectId: string;
  projectName: string;
  documents: WritingDocument[];
  /** The scene open in the Workspace as edited, or null. */
  openScene: Pick<WritingDocument, 'id' | 'title' | 'content'> | null;
  onOpenScene: (doc: WritingDocument) => void;
  onRestoreDeletedScene: (snapshot: SceneSnapshot) => Promise<WritingDocument | null>;
}

type Selection = {kind: 'milestone'; id: string} | {kind: 'deleted'; sceneId: string} | null;

const EXPORT_FORMATS: Array<[DraftExportFormat, string]> = [['markdown', 'Markdown'], ['docx', 'DOCX'], ['epub', 'EPUB']];

/**
 * The Drafts dialog (slice 4.96): save a draft milestone of every scene, open
 * one read-only with per-scene compare against now, export it, and restore
 * deleted scenes from their snapshots. A whole milestone is never restored at
 * once; each scene's Snapshots can restore its milestone text.
 */
export function WorkspaceDraftsModal(props: WorkspaceDraftsModalProps) {
  const {projectId, projectName, documents, openScene, onOpenScene, onRestoreDeletedScene} = props;
  const drafts = useDraftMilestones({projectId, projectName, documents, openScene, onRestoreDeletedScene});
  const {isOpen, close, milestones, deletedScenes, isLoaded, isWorking} = drafts;
  const {requestConfirm, confirmDialog, isConfirmOpen} = useConfirmDialog();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  useEscapeToClose(close, isOpen && !isConfirmOpen);
  useFocusTrap(dialogRef, isOpen && !isConfirmOpen);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setSelection(null);
    }
  }, [isOpen]);
  useEffect(() => {
    if (isOpen && drafts.focusNameToken > 0) nameRef.current?.focus();
  }, [drafts.focusNameToken, isOpen]);

  if (!isOpen) return null;

  const milestone =
    selection?.kind === 'milestone' ? milestones.find((entry) => entry.id === selection.id) : undefined;
  const deleted =
    selection?.kind === 'deleted' ? deletedScenes.find((entry) => entry.sceneId === selection.sceneId) : undefined;
  const shown: DraftMilestone | DeletedScene | undefined =
    milestone ?? deleted ?? (selection === null ? milestones[0] ?? deletedScenes[0] : undefined);

  const currentHtmlOf = (sceneId: string): string | null => {
    if (openScene?.id === sceneId) return openScene.content;
    return documents.find((doc) => doc.id === sceneId)?.content ?? null;
  };

  const handleSave = async () => {
    const saved = await drafts.saveMilestone(name);
    if (saved) {
      setName('');
      setSelection({kind: 'milestone', id: saved.id});
    }
  };

  return (
    <>
    <div className={workspaceStyles.modalOverlay} onClick={close} role='presentation'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='drafts-title'
        className={`${workspaceStyles.modalCard} ${styles.card}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id='drafts-title' className={workspaceStyles.modalTitle}>Drafts</h3>
        <p className={`${workspaceStyles.modalDescription} ${styles.note}`}>
          A draft milestone saves a snapshot of every scene at once. Open one to read the manuscript as it was and
          compare each scene with now; restore a scene from its own Snapshots. Deleted scenes keep their snapshots
          and can be brought back here.
        </p>

        <form
          className={styles.takeRow}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <label className={styles.nameLabel}>
            Milestone name
            <input
              ref={nameRef}
              type='text'
              value={name}
              placeholder='Draft 1 complete'
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type='submit' disabled={isWorking || documents.length === 0}>Save draft milestone</button>
        </form>

        <div className={styles.body}>
          <div className={styles.sidebar}>
            <h4 className={styles.sectionHeading}>Milestones</h4>
            <ul className={styles.list} aria-label='Draft milestones'>
              {isLoaded && milestones.length === 0 && (
                <li className={styles.empty}>No milestones yet. Save one when a draft is done.</li>
              )}
              {milestones.map((entry) => (
                <li key={entry.id}>
                  <button
                    type='button'
                    className={styles.listItem}
                    aria-pressed={shown === entry}
                    onClick={() => setSelection({kind: 'milestone', id: entry.id})}
                  >
                    <span className={styles.listTitle}>{entry.name}</span>
                    <span className={styles.listMeta}>
                      {formatSnapshotTime(entry.createdAt)} · {entry.scenes.length}{' '}
                      {entry.scenes.length === 1 ? 'scene' : 'scenes'} · {wordLabel(entry.wordCount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {deletedScenes.length > 0 && (
              <>
                <h4 className={styles.sectionHeading}>Deleted scenes</h4>
                <ul className={styles.list} aria-label='Deleted scenes'>
                  {deletedScenes.map((entry) => (
                    <li key={entry.sceneId}>
                      <button
                        type='button'
                        className={styles.listItem}
                        aria-pressed={shown === entry}
                        onClick={() => setSelection({kind: 'deleted', sceneId: entry.sceneId})}
                      >
                        <span className={styles.listTitle}>{entry.title}</span>
                        <span className={styles.listMeta}>
                          Last snapshot {formatSnapshotTime(entry.snapshots[0].createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {shown && 'scenes' in shown && (
            <MilestoneView
              key={shown.id}
              projectId={projectId}
              milestone={shown}
              currentHtmlOf={currentHtmlOf}
              onExport={(format) => drafts.exportMilestone(shown, format)}
              onDelete={() => requestConfirm({
                title: `Delete "${shown.name}"?`,
                message: 'The milestone and its snapshots will be deleted. Your scenes are not changed.',
                confirmLabel: 'Delete milestone',
                variant: 'danger',
                onConfirm: () => drafts.removeMilestone(shown)
              })}
              onOpenScene={(sceneId) => {
                const doc = documents.find((entry) => entry.id === sceneId);
                if (!doc) return;
                close();
                onOpenScene(doc);
              }}
            />
          )}
          {shown && 'snapshots' in shown && (
            <DeletedSceneView
              key={shown.sceneId}
              scene={shown}
              isWorking={isWorking}
              onRestore={(snapshot) => void drafts.restoreDeletedScene(snapshot)}
            />
          )}
        </div>

        <div className={workspaceStyles.modalActions}>
          <button type='button' onClick={close} className={workspaceStyles.modalSecondaryAction}>Close</button>
        </div>
      </div>
    </div>
    {confirmDialog}
    </>
  );
}

function MilestoneView({projectId, milestone, currentHtmlOf, onExport, onDelete, onOpenScene}: {
  projectId: string;
  milestone: DraftMilestone;
  currentHtmlOf: (sceneId: string) => string | null;
  onExport: (format: DraftExportFormat) => void;
  onDelete: () => void;
  onOpenScene: (sceneId: string) => void;
}) {
  // null shows the whole draft; otherwise the index of one scene.
  const [sceneIndex, setSceneIndex] = useState<number | null>(null);
  const scene = sceneIndex === null ? null : milestone.scenes[sceneIndex];
  const changeNote = (sceneId: string, html: string) => {
    const current = currentHtmlOf(sceneId);
    if (current === null) return ' (deleted since)';
    return current === html ? '' : ' (changed since)';
  };

  return (
    <section className={styles.detail} aria-label='Selected milestone'>
      <div className={styles.detailBar}>
        <span className={styles.summary}>Export this draft:</span>
        {EXPORT_FORMATS.map(([format, label]) => (
          <button key={format} type='button' onClick={() => onExport(format)}>{label}</button>
        ))}
        <div className={styles.detailActions}>
          <button type='button' className={styles.dangerButton} onClick={onDelete}>Delete milestone</button>
        </div>
      </div>
      <ExportParagraphStyleChoice key={projectId} projectId={projectId} note='EPUB and DOCX only.' />
      <ul className={styles.sceneList} aria-label='Scenes in this milestone'>
        <li>
          <button type='button' className={styles.sceneChip} aria-pressed={sceneIndex === null} onClick={() => setSceneIndex(null)}>
            Whole draft
          </button>
        </li>
        {milestone.scenes.map((entry, index) => (
          <li key={entry.snapshot.id}>
            <button type='button' className={styles.sceneChip} aria-pressed={sceneIndex === index} onClick={() => setSceneIndex(index)}>
              {entry.title}
              <span className={styles.sceneChipNote}>{changeNote(entry.sceneId, entry.snapshot.content)}</span>
            </button>
          </li>
        ))}
      </ul>
      {scene ? (
        <SnapshotCompare
          key={scene.snapshot.id}
          snapshotHeading={`${scene.title} · ${milestone.name}`}
          snapshotHtml={scene.snapshot.content}
          currentHtml={currentHtmlOf(scene.sceneId)}
          actions={currentHtmlOf(scene.sceneId) !== null && (
            <button type='button' onClick={() => onOpenScene(scene.sceneId)}>Open scene</button>
          )}
        />
      ) : (
        <div className={`${styles.text} ${styles.wholeDraft}`} data-testid='milestone-text'>
          {milestone.scenes.map((entry) => (
            <div key={entry.snapshot.id}>
              <h5>{entry.title}</h5>
              <WordTokens ops={plainWordOps(entry.snapshot.content)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DeletedSceneView({scene, isWorking, onRestore}: {
  scene: DeletedScene;
  isWorking: boolean;
  onRestore: (snapshot: SceneSnapshot) => void;
}) {
  const [snapshotId, setSnapshotId] = useState(scene.snapshots[0].id);
  const snapshot = scene.snapshots.find((entry) => entry.id === snapshotId) ?? scene.snapshots[0];
  return (
    <section className={styles.detail} aria-label='Deleted scene'>
      <ul className={styles.sceneList} aria-label='Snapshots of the deleted scene'>
        {scene.snapshots.map((entry) => (
          <li key={entry.id}>
            <button type='button' className={styles.sceneChip} aria-pressed={entry.id === snapshot.id} onClick={() => setSnapshotId(entry.id)}>
              {snapshotTitle(entry)}
              <span className={styles.sceneChipNote}> · {formatSnapshotTime(entry.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      <SnapshotCompare
        key={snapshot.id}
        snapshotHeading={`${scene.title} · ${snapshotTitle(snapshot)}`}
        snapshotHtml={snapshot.content}
        currentHtml={null}
        actions={
          <button type='button' disabled={isWorking} onClick={() => onRestore(snapshot)}>
            Restore scene from this snapshot
          </button>
        }
      />
    </section>
  );
}
