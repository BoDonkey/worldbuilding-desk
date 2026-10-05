import {useCallback, useMemo, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {CharacterSheet, StateMutationEvent, StoredRuleset, WritingDocument} from '../entityTypes';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {
  invalidateStateMutationEventById,
  saveStateMutationEvent
} from '../services/state/stateMutationLedger';
import {
  buildStateMutationReviewItems,
  countHiddenStateMutationReviewsByScene,
  getHiddenStateMutationReviewKey,
  type StateMutationReviewGroupHiddenCounts,
  type StateMutationReviewItem
} from '../services/consistency/mutationReviewGrouping';
import {describeError} from '../services/errors';
import type {ConsistencyFeedback, ConsistencySystemHistory} from './useConsistencyReviewRuns';

/** Suggested state changes in Project Review: accept, reject, hide, restore. */
export function useStateMutationReview({
  characterSheets,
  actorResolutions,
  documents,
  ruleset,
  stateMutationEvents,
  hiddenStateMutationReviewKeys,
  setHiddenStateMutationReviewKeys,
  setFeedback,
  addSystemHistory
}: {
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  documents: WritingDocument[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  hiddenStateMutationReviewKeys: string[];
  setHiddenStateMutationReviewKeys: Dispatch<SetStateAction<string[]>>;
  setFeedback: ConsistencyFeedback;
  addSystemHistory: ConsistencySystemHistory;
}) {
  const [applyingStateMutationReviewId, setApplyingStateMutationReviewId] = useState<string | null>(null);

  const stateMutationReviewItems = useMemo<StateMutationReviewItem[]>(
    () =>
      buildStateMutationReviewItems({
        characterSheets,
        actorResolutions,
        documents,
        hiddenReviewKeys: hiddenStateMutationReviewKeys,
        ruleset,
        stateMutationEvents
      }),
    [
      characterSheets,
      actorResolutions,
      documents,
      hiddenStateMutationReviewKeys,
      ruleset,
      stateMutationEvents
    ]
  );

  const hiddenStateMutationReviewCountBySceneId =
    useMemo<StateMutationReviewGroupHiddenCounts>(
      () =>
        countHiddenStateMutationReviewsByScene({
          stateMutationEvents,
          hiddenReviewKeys: hiddenStateMutationReviewKeys
        }),
      [hiddenStateMutationReviewKeys, stateMutationEvents]
    );

  const hiddenStateMutationReviewCount = useMemo(
    () =>
      Object.values(hiddenStateMutationReviewCountBySceneId).reduce(
        (sum, count) => sum + count,
        0
      ),
    [hiddenStateMutationReviewCountBySceneId]
  );

  const acceptStateMutationReviewItem = useCallback(
    async (eventId: string, applyingId?: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      setApplyingStateMutationReviewId(applyingId ?? eventId);
      setFeedback(null);
      try {
        await saveStateMutationEvent({
          ...event,
          status: 'accepted',
          invalidatedAt: undefined,
          invalidationReason: undefined
        });
        setFeedback({
          tone: 'success',
          message: `Accepted suggested state change from "${event.sceneTitle || 'scene'}".`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Accepted suggested state change from "${event.sceneTitle || 'scene'}".`,
          sceneId: event.sceneId
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to accept suggested state change.')
        });
      } finally {
        setApplyingStateMutationReviewId(null);
      }
    },
    [addSystemHistory, setFeedback, stateMutationEvents]
  );

  const rejectStateMutationReviewItem = useCallback(
    async (eventId: string, applyingId?: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      setApplyingStateMutationReviewId(applyingId ?? eventId);
      setFeedback(null);
      try {
        await invalidateStateMutationEventById({
          eventId,
          reason: 'Rejected from Project Review suggested state changes.'
        });
        setFeedback({
          tone: 'success',
          message: `Rejected suggested state change from "${event.sceneTitle || 'scene'}".`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Rejected suggested state change from "${event.sceneTitle || 'scene'}".`,
          sceneId: event.sceneId
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to reject suggested state change.')
        });
      } finally {
        setApplyingStateMutationReviewId(null);
      }
    },
    [addSystemHistory, setFeedback, stateMutationEvents]
  );

  const hideStateMutationReviewItem = useCallback(
    (eventId: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      const hiddenKey = getHiddenStateMutationReviewKey(event);
      setHiddenStateMutationReviewKeys((prev) =>
        prev.includes(hiddenKey) ? prev : [...prev, hiddenKey]
      );
      setFeedback({
        tone: 'success',
        message: `Hidden suggested state change from "${event.sceneTitle || 'scene'}" until the scene changes.`
      });
    },
    [setHiddenStateMutationReviewKeys, setFeedback, stateMutationEvents]
  );

  const restoreHiddenStateMutationReviewItems = useCallback(
    (sceneId: string) => {
      const hiddenKeysForScene = stateMutationEvents
        .filter(
          (event) =>
            event.sceneId === sceneId &&
            event.status === 'proposed' &&
            event.sourceType === 'deterministic-review'
        )
        .map((event) => getHiddenStateMutationReviewKey(event))
        .filter((key) => hiddenStateMutationReviewKeys.includes(key));
      if (hiddenKeysForScene.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No hidden suggested state changes to restore in this scene.'
        });
        return;
      }
      setHiddenStateMutationReviewKeys((prev) =>
        prev.filter((key) => !hiddenKeysForScene.includes(key))
      );
      const sceneTitle =
        stateMutationEvents.find((event) => event.sceneId === sceneId)?.sceneTitle || 'scene';
      setFeedback({
        tone: 'success',
        message: `Restored hidden suggested state changes from "${sceneTitle}".`
      });
    },
    [setHiddenStateMutationReviewKeys, hiddenStateMutationReviewKeys, setFeedback, stateMutationEvents]
  );

  const restoreAllHiddenStateMutationReviewItems = useCallback(() => {
    if (hiddenStateMutationReviewCount === 0) {
      setFeedback({
        tone: 'error',
        message: 'No hidden suggested state changes to restore.'
      });
      return;
    }
    setHiddenStateMutationReviewKeys([]);
    setFeedback({
      tone: 'success',
      message: `Restored ${hiddenStateMutationReviewCount} hidden suggested state change${hiddenStateMutationReviewCount === 1 ? '' : 's'}.`
    });
  }, [setHiddenStateMutationReviewKeys, hiddenStateMutationReviewCount, setFeedback]);

  const acceptSceneStateMutationReviewItems = useCallback(
    async (sceneId: string) => {
      const applyingId = `scene:${sceneId}:accept`;
      const sceneItems = stateMutationReviewItems
        .filter((item) => item.sceneId === sceneId)
        .sort(
          (a, b) =>
            (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
            (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
        );
      const batchAcceptableItems = sceneItems.filter((item) => item.canAcceptInBatch);
      if (batchAcceptableItems.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No valid suggested state changes to accept in this scene.'
        });
        return;
      }
      for (const item of batchAcceptableItems) {
        await acceptStateMutationReviewItem(item.id, applyingId);
      }
      setFeedback({
        tone: 'success',
        message: `Accepted ${batchAcceptableItems.length} suggested state change${batchAcceptableItems.length === 1 ? '' : 's'} from "${batchAcceptableItems[0]?.sceneTitle || 'scene'}".`
      });
    },
    [acceptStateMutationReviewItem, setFeedback, stateMutationReviewItems]
  );

  const rejectSceneStateMutationReviewItems = useCallback(
    async (sceneId: string) => {
      const applyingId = `scene:${sceneId}:reject`;
      const sceneItems = stateMutationReviewItems.filter((item) => item.sceneId === sceneId);
      if (sceneItems.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No suggested state changes to reject in this scene.'
        });
        return;
      }
      for (const item of sceneItems) {
        await rejectStateMutationReviewItem(item.id, applyingId);
      }
      setFeedback({
        tone: 'success',
        message: `Rejected ${sceneItems.length} suggested state change${sceneItems.length === 1 ? '' : 's'} from "${sceneItems[0]?.sceneTitle || 'scene'}".`
      });
    },
    [rejectStateMutationReviewItem, setFeedback, stateMutationReviewItems]
  );

  return {
    stateMutationReviewItems,
    hiddenStateMutationReviewCountBySceneId,
    hiddenStateMutationReviewCount,
    applyingStateMutationReviewId,
    acceptStateMutationReviewItem,
    rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems,
    rejectSceneStateMutationReviewItems,
    hideStateMutationReviewItem,
    restoreHiddenStateMutationReviewItems,
    restoreAllHiddenStateMutationReviewItems
  };
}
