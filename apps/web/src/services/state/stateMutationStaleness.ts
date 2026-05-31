import type {StateMutationEvent, WritingDocument} from '../../entityTypes';

export interface StateMutationEventStaleness {
  isMissingSourceScene: boolean;
  hasRevisionMismatch: boolean;
  hasHashMismatch: boolean;
  isStale: boolean;
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
      isStale: true
    };
  }

  const hasRevisionMismatch = document.updatedAt !== params.event.sourceRevision;
  const hasHashMismatch = hashString(document.content) !== params.event.sourceHash;

  return {
    isMissingSourceScene: false,
    hasRevisionMismatch,
    hasHashMismatch,
    isStale: hasRevisionMismatch || hasHashMismatch
  };
}

export function describeStateMutationEventStaleness(
  staleness: StateMutationEventStaleness
): string | null {
  if (staleness.isMissingSourceScene) {
    return 'Source scene missing';
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
