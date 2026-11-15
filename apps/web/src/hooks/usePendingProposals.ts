import {useCallback, useEffect, useRef, useState} from 'react';
import type {LoreFactProposal} from '../entityTypes';
import {getLoreDocumentsByProject, getLoreFactProposalsByProject} from '../services/storage';
import {describeError} from '../services/errors';
import {isAiSessionSourceNote} from '../services/lore/sourceNoteOrigin';
import {RECORDS_CHANGED} from '../services/recordEvents';

export interface PendingProposalContext {
  proposals: LoreFactProposal[];
  sourceTitleById: Map<string, string>;
  /** Source Notes saved from an AI session; a prompt says so beside their evidence. */
  aiSessionNoteIds: ReadonlySet<string>;
}

/**
 * Only `ready` may be shown to the assistant. `loading` and `error` must block
 * a request that would otherwise claim proposals were considered.
 */
export type PendingProposalState =
  | {status: 'disabled'}
  | {status: 'loading'}
  | {status: 'ready'; context: PendingProposalContext}
  | {status: 'error'; message: string};

type LoadedState =
  | {status: 'idle'}
  | {status: 'ready'; projectId: string; context: PendingProposalContext}
  | {status: 'error'; projectId: string; message: string};

/**
 * Pending Source Note fact proposals and their Source Note titles, loaded only
 * while `enabled` (the author asked to discuss proposals) and refreshed when
 * proposals or Source Notes change. A refresh keeps the last ready result
 * until it finishes; only the newest read can update the state. Read-only.
 */
export function usePendingProposals(
  projectId: string | null,
  enabled: boolean
): {state: PendingProposalState; retry: () => void} {
  const [loaded, setLoaded] = useState<LoadedState>({status: 'idle'});
  const generation = useRef(0);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    generation.current += 1;
    if (!projectId || !enabled) {
      setLoaded({status: 'idle'});
      return;
    }
    const load = () => {
      const request = ++generation.current;
      Promise.all([getLoreFactProposalsByProject(projectId), getLoreDocumentsByProject(projectId)])
        .then(([proposals, documents]) => {
          if (request !== generation.current) return;
          setLoaded({
            status: 'ready',
            projectId,
            context: {
              proposals: proposals.filter((proposal) => proposal.status === 'proposed'),
              sourceTitleById: new Map(documents.map((document) => [document.id, document.title])),
              aiSessionNoteIds: new Set(documents.filter(isAiSessionSourceNote).map((document) => document.id))
            }
          });
        })
        .catch((error: unknown) => {
          if (request !== generation.current) return;
          setLoaded({
            status: 'error',
            projectId,
            message: describeError(error, 'Retry, or turn the option off to ask about accepted canon only.')
          });
        });
    };
    load();
    window.addEventListener(RECORDS_CHANGED.loreFact, load);
    window.addEventListener(RECORDS_CHANGED.lore, load);
    return () => {
      // Any read still in flight belongs to a project or setting that is gone.
      generation.current += 1;
      window.removeEventListener(RECORDS_CHANGED.loreFact, load);
      window.removeEventListener(RECORDS_CHANGED.lore, load);
    };
  }, [enabled, projectId, retryCount]);

  const retry = useCallback(() => {
    setLoaded({status: 'idle'});
    setRetryCount((count) => count + 1);
  }, []);

  let state: PendingProposalState;
  if (!projectId || !enabled) {
    state = {status: 'disabled'};
  } else if (loaded.status === 'idle' || loaded.projectId !== projectId) {
    // Just enabled, or switched projects: nothing loaded for this request yet.
    state = {status: 'loading'};
  } else if (loaded.status === 'error') {
    state = {status: 'error', message: loaded.message};
  } else {
    state = {status: 'ready', context: loaded.context};
  }
  return {state, retry};
}
