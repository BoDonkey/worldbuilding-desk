import {describe, expect, it} from 'vitest';
import type {StateMutationEvent} from '../../entityTypes';
import {countReviewItemsByScene, countStaleStateEventsByScene} from './sceneDrawerBadges';

describe('countReviewItemsByScene', () => {
  it('counts items per scene', () => {
    expect(
      countReviewItemsByScene([{sceneId: 'a'}, {sceneId: 'b'}, {sceneId: 'a'}])
    ).toEqual({a: 2, b: 1});
  });
});

describe('countStaleStateEventsByScene', () => {
  it('counts only accepted events that are stale', () => {
    const event = (id: string, status: string) =>
      ({id, sceneId: 'gone', status}) as unknown as StateMutationEvent;
    // The scene is missing, so each accepted event is stale.
    expect(
      countStaleStateEventsByScene(
        [event('1', 'accepted'), event('2', 'proposed'), event('3', 'accepted')],
        []
      )
    ).toEqual({gone: 2});
  });
});
