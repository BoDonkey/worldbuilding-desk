import {describe, expect, it} from 'vitest';
import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {
  describeStateMutationEventStaleness,
  getStateMutationEventStaleness
} from './stateMutationStaleness';

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function makeEvent(overrides: Partial<StateMutationEvent>): StateMutationEvent {
  return {
    id: overrides.id ?? 'event-1',
    projectId: overrides.projectId ?? 'project-1',
    sceneId: overrides.sceneId ?? 'scene-1',
    sceneTitle: overrides.sceneTitle ?? 'Scene 1',
    sceneOrder: overrides.sceneOrder ?? 1,
    sceneSequence: overrides.sceneSequence ?? 1,
    sourceRevision: overrides.sourceRevision ?? 10,
    sourceHash: overrides.sourceHash ?? hashString('Original scene text'),
    status: overrides.status ?? 'accepted',
    commands: overrides.commands ?? [],
    createdAt: overrides.createdAt ?? 1,
    invalidatedAt: overrides.invalidatedAt,
    invalidationReason: overrides.invalidationReason
  };
}

const document: WritingDocument = {
  id: 'scene-1',
  projectId: 'project-1',
  title: 'Scene 1',
  content: 'Original scene text',
  createdAt: 1,
  updatedAt: 10
};

describe('stateMutationStaleness', () => {
  it('returns clean state when revision and hash both match', () => {
    const staleness = getStateMutationEventStaleness({
      event: makeEvent({}),
      documents: [document]
    });

    expect(staleness).toEqual({
      isMissingSourceScene: false,
      hasRevisionMismatch: false,
      hasHashMismatch: false,
      isStale: false
    });
    expect(describeStateMutationEventStaleness(staleness)).toBeNull();
  });

  it('marks missing source scenes as stale', () => {
    const staleness = getStateMutationEventStaleness({
      event: makeEvent({sceneId: 'missing-scene'}),
      documents: [document]
    });

    expect(staleness.isStale).toBe(true);
    expect(describeStateMutationEventStaleness(staleness)).toBe('Source scene missing');
  });

  it('distinguishes revision-only, hash-only, and full text changes', () => {
    const revisionOnly = getStateMutationEventStaleness({
      event: makeEvent({sourceRevision: 9}),
      documents: [document]
    });
    const hashOnly = getStateMutationEventStaleness({
      event: makeEvent({sourceHash: hashString('Different scene text')}),
      documents: [document]
    });
    const fullChange = getStateMutationEventStaleness({
      event: makeEvent({
        sourceRevision: 9,
        sourceHash: hashString('Different scene text')
      }),
      documents: [document]
    });

    expect(describeStateMutationEventStaleness(revisionOnly)).toBe('Scene revision changed');
    expect(describeStateMutationEventStaleness(hashOnly)).toBe('Scene content changed');
    expect(describeStateMutationEventStaleness(fullChange)).toBe('Scene text changed');
  });
});
