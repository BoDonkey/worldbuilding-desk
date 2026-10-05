import {useMemo, useRef} from 'react';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {
  AI_TEXT_REPORT_NOTES,
  buildAITextReport,
  describeAITextGroup,
  formatAITextReport,
  summarizeAITextCounts,
} from '../../services/editor/aiTextReport';
import type {WritingDocument} from '../../entityTypes';
import {useAppStore} from '../../store/appStore';
import {pushAppToast} from '../../store/notificationStore';
import {useWorkspaceUiStore} from '../../store/workspaceUiStore';
import {copyText} from '../../utils/clipboard';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceAITextReportModalProps {
  documents: WritingDocument[];
  selectedId: string | null;
  /** The open scene as edited, which can be ahead of its last save. */
  selectedTitle: string;
  selectedContent: string;
  onOpenScene: (doc: WritingDocument) => void;
}

/**
 * Project-level record of the text the app inserted from a model and marked
 * as AI text (Slice 4.51). Factual and platform-neutral: it reports what was
 * inserted and leaves the judgment to the author.
 */
export function WorkspaceAITextReportModal({
  documents,
  selectedId,
  selectedTitle,
  selectedContent,
  onOpenScene
}: WorkspaceAITextReportModalProps) {
  const isOpen = useWorkspaceUiStore((state) => state.isAITextReportOpen);
  const onClose = useWorkspaceUiStore((state) => state.closeAITextReport);
  const projectName = useAppStore((state) => state.activeProject?.name ?? 'Untitled project');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(onClose, isOpen);
  useFocusTrap(dialogRef, isOpen);
  const report = useMemo(
    () =>
      isOpen
        ? buildAITextReport(
            documents.map((doc) =>
              doc.id === selectedId ? {id: doc.id, title: selectedTitle, content: selectedContent} : doc
            )
          )
        : null,
    [documents, isOpen, selectedContent, selectedId, selectedTitle]
  );

  if (!isOpen || !report) return null;

  const handleCopy = async () => {
    const copied = await copyText(formatAITextReport(report, projectName));
    pushAppToast(
      copied
        ? {message: 'AI text report copied.'}
        : {tone: 'error', message: 'Unable to copy the report. Select the text and copy it instead.'}
    );
  };

  const sceneWord = report.sceneCount === 1 ? 'scene' : 'scenes';

  return (
    <div className={styles.modalOverlay} onClick={onClose} role='presentation'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='ai-text-report-title'
        className={`${styles.modalCard} ${styles.aiTextReportCard}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id='ai-text-report-title' className={styles.modalTitle}>AI text report</h3>
        <p className={styles.modalDescription} data-testid='ai-text-report-summary'>
          {report.markedWords === 0
            ? `No marked AI text in ${report.sceneCount.toLocaleString()} ${sceneWord}.`
            : `${summarizeAITextCounts(report.markedWords, report.passages)}, across ` +
              `${report.scenes.length.toLocaleString()} of ${report.sceneCount.toLocaleString()} ${sceneWord}. ` +
              `The manuscript has ${report.totalWords.toLocaleString()} words in all.`}
        </p>

        {report.groups.length > 0 && (
          <div className={styles.aiTextReportBody}>
            <h4 className={styles.aiTextReportHeading}>By feature and provider</h4>
            <ul className={styles.aiTextReportList}>
              {report.groups.map((group) => (
                <li key={`${group.origin}-${group.provider}`}>
                  {describeAITextGroup(group)}: {summarizeAITextCounts(group.words, group.passages)}
                </li>
              ))}
            </ul>
            <h4 className={styles.aiTextReportHeading}>By scene</h4>
            <ul className={styles.aiTextReportList}>
              {report.scenes.map((scene) => (
                <li key={scene.sceneId}>
                  <button
                    type='button'
                    className={styles.aiTextReportSceneButton}
                    onClick={() => {
                      const doc = documents.find((entry) => entry.id === scene.sceneId);
                      onClose();
                      if (doc) onOpenScene(doc);
                    }}
                  >
                    {scene.title}
                  </button>
                  : {summarizeAITextCounts(scene.markedWords, scene.passages)} of{' '}
                  {scene.totalWords.toLocaleString()} {scene.totalWords === 1 ? 'word' : 'words'}
                  <ul className={styles.aiTextReportSubList}>
                    {scene.groups.map((group) => (
                      <li key={`${group.origin}-${group.provider}`}>
                        {describeAITextGroup(group)}: {summarizeAITextCounts(group.words, group.passages)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.aiTextReportNotes}>
          {AI_TEXT_REPORT_NOTES.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>

        <div className={styles.modalActions}>
          <button type='button' onClick={onClose} className={styles.modalSecondaryAction}>Close</button>
          <button type='button' onClick={() => void handleCopy()}>Copy report</button>
        </div>
      </div>
    </div>
  );
}
