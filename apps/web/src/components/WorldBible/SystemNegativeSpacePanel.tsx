import {useMemo} from 'react';
import type {WorldEntity, WritingDocument} from '../../entityTypes';
import {
  SYSTEM_NEGATIVE_SPACE_STATUSES,
  summarizeSystemNegativeSpaceRecords,
  type SystemNegativeSpaceStatus
} from '../../services/worldBible/systemNegativeSpace';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface SystemNegativeSpacePanelProps {
  categoryId: string;
  entities: WorldEntity[];
  documents: WritingDocument[];
  editing: boolean;
  status: SystemNegativeSpaceStatus;
  sceneIds: string[];
  onStatusChange: (status: SystemNegativeSpaceStatus) => void;
  onSceneIdsChange: (sceneIds: string[]) => void;
  onOpenScene: (sceneId: string) => void;
}

export function SystemNegativeSpacePanel({
  categoryId,
  entities,
  documents,
  editing,
  status,
  sceneIds,
  onStatusChange,
  onSceneIdsChange,
  onOpenScene
}: SystemNegativeSpacePanelProps) {
  const summary = useMemo(
    () => summarizeSystemNegativeSpaceRecords({categoryId, entities, documents}),
    [categoryId, documents, entities]
  );
  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents]
  );

  if (editing) {
    return (
      <section className={styles.negativeSpacePanel} aria-label='Problem status and scene links'>
        <div className={styles.negativeSpaceHeading}>
          <div>
            <strong>Author-maintained status</strong>
            <p>
              Track the problem explicitly. The app does not infer whether power solved it
              or whether a scene engages it meaningfully.
            </p>
          </div>
          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as SystemNegativeSpaceStatus)
              }
            >
              {SYSTEM_NEGATIVE_SPACE_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className={styles.negativeSpaceScenes}>
          <legend>Explicit scene links</legend>
          {documents.length === 0 ? (
            <p>No manuscript scenes are available yet.</p>
          ) : documents.map((document) => (
            <label key={document.id}>
              <input
                type='checkbox'
                checked={sceneIds.includes(document.id)}
                onChange={(event) => onSceneIdsChange(
                  event.target.checked
                    ? [...sceneIds, document.id]
                    : sceneIds.filter((id) => id !== document.id)
                )}
              />
              {document.title}
            </label>
          ))}
        </fieldset>
      </section>
    );
  }

  return (
    <section className={styles.negativeSpacePanel} aria-label='Problems power cannot solve summary'>
      <div className={styles.negativeSpaceHeading}>
        <div>
          <strong>Structured status</strong>
          <p>Counts and scene links come only from author-maintained records.</p>
        </div>
        <span>{summary.recordCount} tracked</span>
      </div>
      <div className={styles.negativeSpaceCounts}>
        {SYSTEM_NEGATIVE_SPACE_STATUSES.map((option) => (
          <span key={option.value}>
            <strong>{summary.counts[option.value]}</strong> {option.label}
          </span>
        ))}
      </div>
      {summary.linkedSceneIds.length > 0 && (
        <div className={styles.negativeSpaceLinks}>
          <strong>Linked scenes</strong>
          <div>
            {summary.linkedSceneIds.map((sceneId) => (
              <button key={sceneId} type='button' onClick={() => onOpenScene(sceneId)}>
                {documentById.get(sceneId)?.title ?? 'Unknown scene'}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
