/*
 * Types for consistency highlights in the editor. The decorations themselves
 * are drawn by WorkspaceAnnotationsExtension; the old standalone extension
 * here had no caller and was removed (slice 3.51).
 */
import type {
  WorkspaceAnnotationSource,
  WorkspaceReviewInlineMode
} from '../../../services/consistency/workspaceAnnotations';
import type {GuardrailIssueCode} from '../../../services/consistency/types';

export interface ConsistencyHighlightIssue {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
  issueCode?: GuardrailIssueCode;
  source?: WorkspaceAnnotationSource;
  confidence?: number;
  inlineMode?: WorkspaceReviewInlineMode;
}

