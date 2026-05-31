import {findTextMatches, normalizeCanonText} from './textMatcher';
import type {GuardrailIssueCode} from './types';

export type WorkspaceAnnotationKind = 'known-canon' | 'review-candidate';
export type WorkspaceAnnotationVisibility = 'visible' | 'suppressed';
export type WorkspaceReviewInlineMode = 'visible' | 'passive' | 'hidden';
export type WorkspaceAnnotationSource =
  | 'known-canon'
  | 'deterministic-review'
  | 'local-ai-review'
  | 'manual-ignore'
  | 'project-suppressed';

export interface WorkspaceKnownSurface<TMetadata = unknown> {
  id: string;
  surface: string;
  label?: string;
  metadata?: TMetadata;
}

export interface WorkspaceReviewSurface<TMetadata = unknown> {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
  issueCode?: GuardrailIssueCode;
  source?: WorkspaceAnnotationSource;
  confidence?: number;
  inlineMode?: WorkspaceReviewInlineMode;
  metadata?: TMetadata;
}

export interface WorkspaceAnnotation<TMetadata = unknown> {
  id: string;
  kind: WorkspaceAnnotationKind;
  surface: string;
  normalized: string;
  from: number;
  to: number;
  source: WorkspaceAnnotationSource;
  issueCode?: GuardrailIssueCode;
  severity?: 'blocking' | 'warning';
  confidence?: number;
  inlineMode?: WorkspaceReviewInlineMode;
  visibility: WorkspaceAnnotationVisibility;
  suppressedById?: string;
  data: TMetadata;
}

export interface WorkspaceAnnotationSummary {
  totalCount: number;
  inlineVisibleCount: number;
  passiveCount: number;
  suppressedCount: number;
  blockingCount: number;
}

type CandidateAnnotation<TMetadata> = Omit<
  WorkspaceAnnotation<TMetadata>,
  'visibility' | 'suppressedById'
>;

const TITLE_PREFIX_PATTERN =
  /(?:^|[^\p{L}\p{N}_])((?:Detective|Dr|Mr|Mrs|Ms|Mx|Officer|Prof|Professor)\.?\s+)$/u;

const rangesOverlap = (
  left: {from: number; to: number},
  right: {from: number; to: number}
): boolean => left.from < right.to && left.to > right.from;

const annotationPriority = (annotation: CandidateAnnotation<unknown>): number =>
  annotation.kind === 'known-canon' ? 2 : 1;

const compareCandidates = (
  left: CandidateAnnotation<unknown>,
  right: CandidateAnnotation<unknown>
): number => {
  const lengthDelta = right.to - right.from - (left.to - left.from);
  if (lengthDelta !== 0) {
    return lengthDelta;
  }
  const priorityDelta = annotationPriority(right) - annotationPriority(left);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return left.from - right.from || left.to - right.to;
};

const shouldShowInlineAnnotation = (
  annotation: CandidateAnnotation<unknown>
): boolean => {
  if (annotation.kind === 'known-canon') {
    return true;
  }
  if (
    annotation.source === 'manual-ignore' ||
    annotation.source === 'project-suppressed' ||
    annotation.inlineMode === 'hidden'
  ) {
    return false;
  }
  if (annotation.inlineMode === 'passive') {
    return false;
  }
  if (annotation.severity === 'blocking' || annotation.inlineMode === 'visible') {
    return true;
  }
  if (annotation.issueCode === 'AMBIGUOUS_REFERENCE') {
    return true;
  }
  return true;
};

const extendKnownMatchForTitle = (
  text: string,
  match: {from: number; to: number; surface: string}
): {from: number; to: number; surface: string} => {
  const prefix = text.slice(0, match.from);
  const titleMatch = prefix.match(TITLE_PREFIX_PATTERN);
  if (!titleMatch?.[1]) {
    return match;
  }

  const from = match.from - titleMatch[1].length;
  return {
    from,
    to: match.to,
    surface: text.slice(from, match.to)
  };
};

export const buildWorkspaceAnnotations = <
  TKnownMetadata = unknown,
  TReviewMetadata = unknown
>(params: {
  text: string;
  knownSurfaces: WorkspaceKnownSurface<TKnownMetadata>[];
  reviewSurfaces: WorkspaceReviewSurface<TReviewMetadata>[];
}): Array<WorkspaceAnnotation<TKnownMetadata | TReviewMetadata>> => {
  const knownCandidates: Array<CandidateAnnotation<TKnownMetadata>> = findTextMatches(
    params.text,
    params.knownSurfaces.map((entry) => ({
      id: entry.id,
      surface: entry.surface,
      kind: 'known' as const,
      metadata: {entry}
    }))
  ).map((match) => {
    const entry = match.pattern.metadata?.entry as
      | WorkspaceKnownSurface<TKnownMetadata>
      | undefined;
    const titledMatch = extendKnownMatchForTitle(params.text, match);
    return {
      id: `known:${entry?.id ?? match.pattern.id}:${normalizeCanonText(match.surface)}`,
      kind: 'known-canon' as const,
      surface: titledMatch.surface,
      normalized: normalizeCanonText(match.surface),
      from: titledMatch.from,
      to: titledMatch.to,
      source: 'known-canon',
      confidence: 1,
      inlineMode: 'visible',
      data: entry?.metadata as TKnownMetadata
    };
  });

  const reviewCandidates: Array<CandidateAnnotation<TReviewMetadata>> = findTextMatches(
    params.text,
    params.reviewSurfaces.map((issue) => ({
      id: issue.id,
      surface: issue.surface,
      kind: 'review' as const,
      metadata: {issue}
    }))
  ).map((match) => {
    const issue = match.pattern.metadata?.issue as
      | WorkspaceReviewSurface<TReviewMetadata>
      | undefined;
    return {
      id: `review:${issue?.id ?? match.pattern.id}:${normalizeCanonText(match.surface)}`,
      kind: 'review-candidate' as const,
      surface: match.surface,
      normalized: normalizeCanonText(match.surface),
      from: match.from,
      to: match.to,
      source: issue?.source ?? 'deterministic-review',
      issueCode: issue?.issueCode,
      severity: issue?.severity,
      confidence: issue?.confidence,
      inlineMode: issue?.inlineMode,
      data: issue?.metadata as TReviewMetadata
    };
  });

  const candidates = [...knownCandidates, ...reviewCandidates].sort(compareCandidates);
  const visible: Array<CandidateAnnotation<TKnownMetadata | TReviewMetadata>> = [];
  const annotations: Array<WorkspaceAnnotation<TKnownMetadata | TReviewMetadata>> = [];

  candidates.forEach((candidate) => {
    const suppressor = visible.find((annotation) => rangesOverlap(candidate, annotation));
    const annotation = {
      ...candidate,
      visibility:
        suppressor || !shouldShowInlineAnnotation(candidate)
          ? 'suppressed' as const
          : 'visible' as const,
      suppressedById: suppressor?.id
    };
    annotations.push(annotation);
    if (annotation.visibility === 'visible') {
      visible.push(candidate);
    }
  });

  return annotations.sort((left, right) => left.from - right.from || right.to - left.to);
};

export const getVisibleWorkspaceAnnotations = <
  TKnownMetadata = unknown,
  TReviewMetadata = unknown
>(params: {
  text: string;
  knownSurfaces: WorkspaceKnownSurface<TKnownMetadata>[];
  reviewSurfaces: WorkspaceReviewSurface<TReviewMetadata>[];
}): Array<WorkspaceAnnotation<TKnownMetadata | TReviewMetadata>> =>
  buildWorkspaceAnnotations(params).filter(
    (annotation) => annotation.visibility === 'visible'
  );

export const summarizeWorkspaceAnnotations = (
  annotations: Array<WorkspaceAnnotation<unknown>>
): WorkspaceAnnotationSummary =>
  annotations.reduce<WorkspaceAnnotationSummary>(
    (summary, annotation) => ({
      totalCount: summary.totalCount + 1,
      inlineVisibleCount:
        summary.inlineVisibleCount + (annotation.visibility === 'visible' ? 1 : 0),
      passiveCount:
        summary.passiveCount + (annotation.inlineMode === 'passive' ? 1 : 0),
      suppressedCount:
        summary.suppressedCount +
        (annotation.visibility === 'suppressed' ? 1 : 0),
      blockingCount:
        summary.blockingCount + (annotation.severity === 'blocking' ? 1 : 0)
    }),
    {
      totalCount: 0,
      inlineVisibleCount: 0,
      passiveCount: 0,
      suppressedCount: 0,
      blockingCount: 0
    }
  );

export const summarizeWorkspaceReviewSurfaces = (
  reviewSurfaces: WorkspaceReviewSurface[]
): WorkspaceAnnotationSummary =>
  summarizeWorkspaceAnnotations(
    reviewSurfaces.map((surface): WorkspaceAnnotation => {
      const annotation: CandidateAnnotation<unknown> = {
        id: `review:${surface.id}:${normalizeCanonText(surface.surface)}`,
        kind: 'review-candidate',
        surface: surface.surface,
        normalized: normalizeCanonText(surface.surface),
        from: 0,
        to: surface.surface.length,
        source: surface.source ?? 'deterministic-review',
        issueCode: surface.issueCode,
        severity: surface.severity,
        confidence: surface.confidence,
        inlineMode: surface.inlineMode,
        data: surface.metadata
      };
      return {
        ...annotation,
        visibility: shouldShowInlineAnnotation(annotation) ? 'visible' : 'suppressed'
      };
    })
  );
