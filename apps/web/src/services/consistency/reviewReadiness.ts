import type {StateMutationEvent} from '../../entityTypes';
import type {GuardrailIssue} from './types';
import type {
  WorkspaceAnnotationSummary,
  WorkspaceAnnotationSource,
  WorkspaceReviewInlineMode
} from './workspaceAnnotations';
import type {ReviewIssueAnnotation, WorldEngineStatus} from '../worldEngine';
import {normalizeCanonText} from './textMatcher';

export interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
  reviewAnnotation?: ReviewIssueAnnotation;
}

export interface HighlightableUnknownIssue {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
  issueCode: GuardrailIssue['code'];
  source: WorkspaceAnnotationSource;
  confidence?: number;
  inlineMode: WorkspaceReviewInlineMode;
}

export type ReviewReadinessState =
  | 'idle'
  | 'running'
  | 'ready'
  | 'attention'
  | 'unavailable';

export interface ReviewReadiness {
  state: ReviewReadinessState;
  count: number;
  activeCount: number;
  passiveCount: number;
  suppressedCount: number;
  label: string;
  detail: string;
}

export const getReviewIssueKey = (issue: GuardrailIssue): string =>
  [issue.code, normalizeCanonText(issue.surface ?? issue.message)].join(':');

export const makeReviewItemId = (
  documentId: string,
  issue: GuardrailIssue
): string => `${documentId}:${getReviewIssueKey(issue)}`;

export function mapReviewAnnotationsByIssueKey(
  issues: GuardrailIssue[],
  issueAnnotations: ReviewIssueAnnotation[]
): Map<string, ReviewIssueAnnotation> {
  const annotationsByIssueKey = new Map<string, ReviewIssueAnnotation>();
  issues.forEach((issue, index) => {
    const annotation = issueAnnotations[index];
    if (annotation) {
      annotationsByIssueKey.set(getReviewIssueKey(issue), annotation);
    }
  });
  return annotationsByIssueKey;
}

const getAnnotationSourceForReview = (
  reviewAnnotation?: ReviewIssueAnnotation
): WorkspaceAnnotationSource =>
  reviewAnnotation?.source === 'local-ai'
    ? 'local-ai-review'
    : 'deterministic-review';

function buildHighlightableUnknownIssue(
  issue: GuardrailIssue,
  reviewAnnotation?: ReviewIssueAnnotation
): HighlightableUnknownIssue | null {
  if (
    (issue.code !== 'UNKNOWN_ENTITY' && issue.code !== 'AMBIGUOUS_REFERENCE') ||
    !issue.surface
  ) {
    return null;
  }
  return {
    id: `${issue.code}:${issue.surface}`,
    surface: issue.surface,
    message: issue.message,
    severity: issue.severity,
    issueCode: issue.code,
    source: getAnnotationSourceForReview(reviewAnnotation),
    confidence: reviewAnnotation?.confidence ?? issue.confidence,
    inlineMode:
      issue.code === 'UNKNOWN_ENTITY' && issue.severity === 'warning'
        ? 'passive'
        : 'visible'
  };
}

export function filterUnknownGuardrailIssues(params: {
  issues: GuardrailIssue[];
  knownSurfaceSet: Set<string>;
}): GuardrailIssue[] {
  const seen = new Set<string>();
  return params.issues
    .filter((issue) => issue.code === 'UNKNOWN_ENTITY' && Boolean(issue.surface))
    .filter(
      (issue) =>
        !params.knownSurfaceSet.has(normalizeCanonText(issue.surface ?? ''))
    )
    .filter((issue) => {
      const key = normalizeCanonText(issue.surface ?? '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildHighlightableUnknownIssues(params: {
  unknownGuardrailIssues: GuardrailIssue[];
  consistencyReviewItems: ConsistencyReviewItem[];
  selectedDocumentId: string | null;
  knownSurfaceSet: Set<string>;
}): HighlightableUnknownIssue[] {
  const issueMap = new Map<string, HighlightableUnknownIssue>();
  const addIssue = (
    issue: GuardrailIssue,
    reviewAnnotation?: ReviewIssueAnnotation
  ) => {
    const key = getReviewIssueKey(issue);
    if (issueMap.has(key)) return;
    const highlightable = buildHighlightableUnknownIssue(issue, reviewAnnotation);
    if (highlightable) issueMap.set(key, highlightable);
  };

  params.unknownGuardrailIssues.forEach((issue) => addIssue(issue));
  if (params.selectedDocumentId) {
    params.consistencyReviewItems
      .filter((item) => item.sceneId === params.selectedDocumentId)
      .filter(
        (item) =>
          item.issue.code !== 'UNKNOWN_ENTITY' ||
          !params.knownSurfaceSet.has(
            normalizeCanonText(item.issue.surface ?? '')
          )
      )
      .forEach((item) => addIssue(item.issue, item.reviewAnnotation));
  }
  return Array.from(issueMap.values());
}

export function buildReviewReadiness(params: {
  annotationSummary: WorkspaceAnnotationSummary;
  stateMutationEvents: StateMutationEvent[];
  worldEngineStatus: WorldEngineStatus | null;
  isRunningConsistencyReview: boolean;
  hasBlockingUnknownGuardrailIssues: boolean;
}): ReviewReadiness {
  const stateMutationItemCount = params.stateMutationEvents.filter(
    (event) =>
      event.status === 'proposed' &&
      event.sourceType === 'deterministic-review'
  ).length;
  const activeCount =
    params.annotationSummary.inlineVisibleCount + stateMutationItemCount;
  const passiveCount = params.annotationSummary.passiveCount;
  const suppressedCount = params.annotationSummary.suppressedCount;
  const count = activeCount + passiveCount;
  const label =
    activeCount > 0 && passiveCount > 0
      ? `${activeCount} active, ${passiveCount} later`
      : activeCount > 0
        ? activeCount === 1
          ? '1 review item'
          : `${activeCount} review items`
        : passiveCount > 0
          ? passiveCount === 1
            ? '1 review later'
            : `${passiveCount} review later`
          : 'Review clear';

  if (params.worldEngineStatus?.state !== undefined &&
      params.worldEngineStatus.state !== 'available') {
    return {
      state: 'unavailable', count, activeCount, passiveCount, suppressedCount,
      label: 'Review unavailable',
      detail:
        params.worldEngineStatus.state === 'notInstalled'
          ? 'Local review engine is not installed.'
          : params.worldEngineStatus.reason
    };
  }
  if (params.isRunningConsistencyReview) {
    return {
      state: 'running', count, activeCount, passiveCount, suppressedCount,
      label: 'Review running',
      detail: 'Review is checking the current project.'
    };
  }
  if (params.hasBlockingUnknownGuardrailIssues) {
    return {
      state: 'attention', count, activeCount, passiveCount, suppressedCount, label,
      detail: 'Some review items need attention before a strict save can finish.'
    };
  }
  if (activeCount > 0) {
    return {
      state: 'ready', count, activeCount, passiveCount, suppressedCount, label,
      detail: 'Review items are ready when you want to check them.'
    };
  }
  if (passiveCount > 0) {
    return {
      state: 'ready', count, activeCount, passiveCount, suppressedCount, label,
      detail: 'Low-priority review candidates are saved for later without inline drafting noise.'
    };
  }
  return {
    state: 'idle', count: 0, activeCount: 0, passiveCount: 0, suppressedCount,
    label: 'Review clear', detail: 'No open review items.'
  };
}
