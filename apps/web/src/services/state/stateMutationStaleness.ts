import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {
  resolveStateMutationAnchor,
  textSnapshotFromPlainText,
  type StateMutationAnchorResolution
} from './stateMutationAnchor';

export interface StateMutationEventStaleness {
  isMissingSourceScene: boolean;
  hasRevisionMismatch: boolean;
  hasHashMismatch: boolean;
  anchorStatus: StateMutationAnchorResolution['status'] | 'legacy';
  isStale: boolean;
}

function plainTextFromHtml(value: string): string {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(value, 'text/html').body.textContent ?? '';
  }
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
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
          snapshot: textSnapshotFromPlainText(plainTextFromHtml(document.content)),
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
