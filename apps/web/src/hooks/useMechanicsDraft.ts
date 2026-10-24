import {useCallback, useEffect, useRef, useState} from 'react';
import type {MechanicsDraft} from '../entityTypes';
import {
  deleteMechanicsDraft,
  getMechanicsDraft,
  migrateLegacyMechanicsDrafts,
  saveMechanicsDraft
} from '../services/storage';

type DraftFields = Pick<MechanicsDraft, 'kind' | 'name' | 'defaultValue'>;

/**
 * Loads and keeps the unfinished first-mechanics form for one character in
 * project storage (slice 3.23c). `draft` is undefined while loading. Writes run
 * one at a time in call order, because each opens its own connection and a
 * save that finished after a discard would bring the draft back.
 */
export function useMechanicsDraft(projectId: string | null, entityId: string) {
  const [draft, setDraft] = useState<MechanicsDraft | null | undefined>(projectId ? undefined : null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback((write: () => Promise<unknown>) => {
    // A failed write must not block later ones; the form keeps what was typed.
    queueRef.current = queueRef.current.then(write).catch(() => undefined);
    return queueRef.current;
  }, []);

  useEffect(() => {
    if (!projectId) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setDraft(undefined);
    void enqueue(async () => {
      await migrateLegacyMechanicsDrafts(projectId).catch(() => 0);
      const stored = await getMechanicsDraft(projectId, entityId).catch(() => null);
      if (!cancelled) setDraft(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [enqueue, entityId, projectId]);

  const save = useCallback((fields: DraftFields) => {
    if (!projectId) return;
    void enqueue(() => saveMechanicsDraft({projectId, entityId, ...fields}));
  }, [enqueue, entityId, projectId]);

  const discard = useCallback(() => {
    if (!projectId) return Promise.resolve();
    return enqueue(() => deleteMechanicsDraft(projectId, entityId));
  }, [enqueue, entityId, projectId]);

  return {draft, isLoading: draft === undefined, save, discard};
}
