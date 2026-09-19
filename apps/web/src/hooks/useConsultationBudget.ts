import {useCallback, useEffect, useMemo, useState} from 'react';
import type {AIProviderId, InspectorSettings} from '../entityTypes';
import {
  DEFAULT_CONSULTATION_LIMIT,
  getConsultationBudgetStatus,
  grantExtraConsultations,
  isLocalConsultationProvider,
  recordConsultation,
  type ConsultationBudgetStatus,
  type ConsultationFeature
} from '../services/editor';

export interface UseConsultationBudget {
  status: ConsultationBudgetStatus;
  /** True when this project's provider is local, so requests do not spend the budget. */
  isLocal: boolean;
  /** True when the request should be refused: budget exhausted, or the local loop guard tripped. */
  blocked: boolean;
  /** Plain-language reason the request was refused, for the caller's own error surface. */
  blockedMessage: string | null;
  /** Records one consultation against the given feature and refreshes the displayed status. */
  spend: (feature: ConsultationFeature) => void;
  /** Point-of-use grant: more units for today only. */
  grantMore: () => void;
  refresh: () => void;
}

/**
 * Single source of truth for a surface that spends AI consultations: the status to display beside
 * the button, the guard to check before the request, and the grant the author can use to keep
 * going. Every spending surface uses this so the budget reads the same everywhere.
 */
export function useConsultationBudget(
  projectId: string | null,
  inspector: InspectorSettings | undefined,
  provider: AIProviderId | undefined
): UseConsultationBudget {
  const configuredLimit = inspector?.maxConsultationsPerDay ?? DEFAULT_CONSULTATION_LIMIT;
  const isLocal = isLocalConsultationProvider(provider);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    refresh();
  }, [projectId, configuredLimit, refresh]);

  const status = useMemo(
    () => getConsultationBudgetStatus(projectId ?? '__none__', configuredLimit),
    // `version` is the explicit invalidation signal; localStorage is not reactive on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, configuredLimit, version]
  );

  const spend = useCallback(
    (feature: ConsultationFeature) => {
      if (!projectId) return;
      recordConsultation(projectId, feature, provider, configuredLimit);
      refresh();
    },
    [projectId, provider, configuredLimit, refresh]
  );

  const grantMore = useCallback(() => {
    if (!projectId) return;
    grantExtraConsultations(projectId, undefined, configuredLimit);
    refresh();
  }, [projectId, configuredLimit, refresh]);

  const blocked = isLocal ? status.localGuardExhausted : status.exhausted;

  const blockedMessage = !blocked
    ? null
    : isLocal
      ? `Stopped after ${status.localUsed} local requests for this project today — that is the runaway guard, not a budget. It resets at ${status.resetsAtLabel}.`
      : `You have used all ${status.limit} AI consultations for this project today. They reset at ${status.resetsAtLabel}, or you can add more for today.`;

  // Memoized: callers put this object in `useCallback`/`useEffect` dependency arrays, so a new
  // identity every render would re-create their handlers (and, where a handler is an effect
  // dependency, loop).
  return useMemo(
    () => ({status, isLocal, blocked, blockedMessage, spend, grantMore, refresh}),
    [status, isLocal, blocked, blockedMessage, spend, grantMore, refresh]
  );
}
