import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {
  resolveStateMutationAnchor,
  textSnapshotFromPlainText,
  type StateMutationAnchorResolution
} from './stateMutationAnchor';
import {hashString} from '../../utils/hashString';
import {htmlTextContent} from '../../utils/textHelpers';

export interface StateMutationEventStaleness {
  isMissingSourceScene: boolean;
  hasRevisionMismatch: boolean;
  hasHashMismatch: boolean;
  anchorStatus: StateMutationAnchorResolution['status'] | 'legacy';
  isStale: boolean;
}

export function getStateMutationEventStaleness(params: {
  event: StateMutationEvent;
  documents: WritingDocument[];
}): StateMutationEventStaleness {
  const document = params.documents.find((entry) => entry.id === params.event.sceneId);
  if (!document) {
    return {
      isMissingSourceScene: true,
      hasRevisionMismatch: false,
      hasHashMismatch: false,
      anchorStatus: params.event.sceneAnchor ? 'unresolved' : 'legacy',
      isStale: true
    };
  }

  const hasRevisionMismatch = document.updatedAt !== params.event.sourceRevision;
  const hasHashMismatch = hashString(document.content) !== params.event.sourceHash;
  const anchorResolution =
    params.event.sceneAnchor && params.event.scenePosition !== undefined
      ? resolveStateMutationAnchor({
          snapshot: textSnapshotFromPlainText(htmlTextContent(document.content)),
          anchor: params.event.sceneAnchor,
          originalPosition: params.event.scenePosition
        })
      : null;
  const anchorStatus = anchorResolution?.status ?? 'legacy';
  const isStale = anchorStatus === 'unresolved' ||
    (anchorStatus === 'legacy' && (hasRevisionMismatch || hasHashMismatch));

  return {
    isMissingSourceScene: false,
    hasRevisionMismatch,
    hasHashMismatch,
    anchorStatus,
    isStale
  };
}

export function describeStateMutationEventStaleness(
  staleness: StateMutationEventStaleness
): string | null {
  if (staleness.isMissingSourceScene) {
    return 'Source scene missing';
  }
  if (staleness.anchorStatus === 'unresolved') {
    return 'Text anchor needs review';
  }
  if (staleness.hasRevisionMismatch && staleness.hasHashMismatch) {
    return 'Scene text changed';
  }
  if (staleness.hasHashMismatch) {
    return 'Scene content changed';
  }
  if (staleness.hasRevisionMismatch) {
    return 'Scene revision changed';
  }
  return null;
}
