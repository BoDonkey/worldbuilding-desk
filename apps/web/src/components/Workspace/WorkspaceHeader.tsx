import type {WritingDocument} from '../../entityTypes';
import type {useWorkspaceChapterCardLinks} from '../../hooks/useWorkspaceChapterCardLinks';
import type {ReviewReadiness} from '../../services/consistency/reviewReadiness';
import styles from '../../styles/WorkspaceRoute.module.css';
import {PageHeader} from '../PageHeader';
import {WorkspaceChapterCardContext} from './WorkspaceChapterCardContext';

interface WorkspaceHeaderProps {
  projectName: string;
  selectedDocument: WritingDocument | null | undefined;
  chapterCardLinks: ReturnType<typeof useWorkspaceChapterCardLinks>;
  reviewReadiness: ReviewReadiness;
  onOpenReview: () => void;
  onOpenScratchpad: () => void;
}

/**
 * The Workspace page header: the project and open scene, the Corkboard
 * cards linked to that scene, the review status chip (opens the Review
 * tab), and the Scratchpad button.
 */
export function WorkspaceHeader({
  projectName,
  selectedDocument,
  chapterCardLinks,
  reviewReadiness,
  onOpenReview,
  onOpenScratchpad
}: WorkspaceHeaderProps) {
  return (
    <PageHeader
      eyebrow='Current manuscript'
      title='Writing Workspace'
      meta={
        <span className={styles.workspaceHeaderMeta}>
          {projectName}
          {selectedDocument ? ` · ${selectedDocument.title || 'Untitled scene'}` : ''}
          <WorkspaceChapterCardContext
            cards={chapterCardLinks.linkedChapterCards}
            onOpenCard={chapterCardLinks.handleOpenChapterCard}
            onOpenCorkboard={chapterCardLinks.handleOpenChapterCardRoute}
          />
        </span>
      }
      actions={
        <>
          <button
            type='button'
            className={`${styles.reviewIndicator} ${styles[`reviewIndicator_${reviewReadiness.state}`]}`}
            onClick={onOpenReview}
            title={reviewReadiness.detail}
            aria-label={`Open review drawer, ${reviewReadiness.label}: ${reviewReadiness.detail}`}
          >
            <span className={styles.reviewIndicatorDot} />
            <span>{reviewReadiness.label}</span>
          </button>
          <button
            type='button'
            className={styles.scratchpadHeaderButton}
            onClick={onOpenScratchpad}
          >
            Scratchpad
          </button>
        </>
      }
    />
  );
}
