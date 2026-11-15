import {useState} from 'react';
import type {CanonDecisionCluster} from '../entityTypes';
import {describeError} from '../services/errors';
import {
  acceptNewEntity,
  aliasEntityToExisting,
  deferCluster,
  findCanonDecisionMembers,
  keepClusterSeparate,
  rejectCluster,
  supersedeFactAsOfScene,
  type CanonDecisionContext
} from '../services/lore/canonDecisionActions';

export type CanonDecisionFeedback = {tone: 'success' | 'error'; message: string} | null;

/**
 * Busy, feedback, and effective-scene state for the Canon Decisions buttons
 * (slice 3.43). The decisions themselves are in services/lore/canonDecisionActions.
 * `context` is null until a project is open.
 */
export function useCanonDecisionActions(params: {
  context: CanonDecisionContext | null;
  refresh: () => Promise<void>;
}) {
  const {context, refresh} = params;
  const [actingClusterId, setActingClusterId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CanonDecisionFeedback>(null);
  const [factEffectiveSceneByClusterId, setFactEffectiveSceneByClusterId] = useState<
    Record<string, string>
  >({});

  const run = async (
    cluster: CanonDecisionCluster,
    fallbackError: string,
    action: () => Promise<string>,
    afterSuccess?: () => void
  ) => {
    setActingClusterId(cluster.id);
    setFeedback(null);
    try {
      const message = await action();
      afterSuccess?.();
      setFeedback({tone: 'success', message});
      await refresh();
    } catch (error) {
      setFeedback({tone: 'error', message: describeError(error, fallbackError)});
    } finally {
      setActingClusterId(null);
    }
  };

  const handleAliasEntity = async (cluster: CanonDecisionCluster) => {
    if (!context) return;
    const {entityProposal, targetRef} = findCanonDecisionMembers(context.records, cluster);
    if (!entityProposal || !targetRef) return;
    await run(cluster, 'Unable to alias candidate.', () =>
      aliasEntityToExisting(context, cluster, entityProposal, targetRef)
    );
  };

  const handleAcceptNewEntity = async (cluster: CanonDecisionCluster) => {
    if (!context) return;
    const {entityProposal} = findCanonDecisionMembers(context.records, cluster);
    if (!entityProposal) return;
    await run(cluster, 'Unable to accept new candidate.', () =>
      acceptNewEntity(context, cluster, entityProposal)
    );
  };

  const handleAcceptFactUpdate = async (cluster: CanonDecisionCluster) => {
    if (!context) return;
    const {factProposal, canonicalFact} = findCanonDecisionMembers(context.records, cluster);
    if (!factProposal || !canonicalFact || !factProposal.targetType || !factProposal.targetId) return;
    const asOfSceneId = factEffectiveSceneByClusterId[cluster.id];
    if (!asOfSceneId) {
      setFeedback({tone: 'error', message: 'Choose the scene where the new fact becomes true.'});
      return;
    }
    await run(
      cluster,
      'Unable to update canonical fact.',
      () =>
        supersedeFactAsOfScene(context, cluster, {
          proposal: factProposal,
          previousFact: canonicalFact,
          asOfSceneId
        }),
      () =>
        setFactEffectiveSceneByClusterId((current) => {
          const next = {...current};
          delete next[cluster.id];
          return next;
        })
    );
  };

  const handleKeepSeparate = async (cluster: CanonDecisionCluster) => {
    if (!context) return;
    await run(cluster, 'Unable to update cluster.', () => keepClusterSeparate(context, cluster));
  };

  const handleReject = async (cluster: CanonDecisionCluster) => {
    if (!context) return;
    await run(cluster, 'Unable to reject cluster.', () => rejectCluster(context, cluster));
  };

  const handleDefer = async (cluster: CanonDecisionCluster) => {
    await run(cluster, 'Unable to defer cluster.', () => deferCluster(cluster));
  };

  const setFactEffectiveScene = (clusterId: string, sceneId: string) =>
    setFactEffectiveSceneByClusterId((current) => ({...current, [clusterId]: sceneId}));

  return {
    actingClusterId,
    feedback,
    setFeedback,
    factEffectiveSceneByClusterId,
    setFactEffectiveScene,
    handleAliasEntity,
    handleAcceptNewEntity,
    handleAcceptFactUpdate,
    handleKeepSeparate,
    handleReject,
    handleDefer
  };
}
