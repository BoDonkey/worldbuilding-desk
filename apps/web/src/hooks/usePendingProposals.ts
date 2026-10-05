import {useEffect, useState} from 'react';
import type {LoreFactProposal} from '../entityTypes';
import {getLoreDocumentsByProject} from '../loreStorage';
import {getLoreFactProposalsByProject} from '../services/lore/loreFactStorage';

export interface PendingProposalContext {
  proposals: LoreFactProposal[];
  sourceTitleById: Map<string, string>;
}

/**
 * Pending Source Note fact proposals and their Source Note titles, loaded only
 * while `enabled` (the author asked to discuss proposals) and refreshed when
 * proposals or Source Notes change. Read-only.
 */
export function usePendingProposals(projectId: string | null, enabled: boolean): PendingProposalContext | null {
  const [context, setContext] = useState<PendingProposalContext | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) {
      setContext(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void Promise.all([getLoreFactProposalsByProject(projectId), getLoreDocumentsByProject(projectId)])
        .then(([proposals, documents]) => {
          if (cancelled) return;
          setContext({
            proposals: proposals.filter((proposal) => proposal.status === 'proposed'),
            sourceTitleById: new Map(documents.map((document) => [document.id, document.title]))
          });
        })
        .catch((error) => {
          console.warn('Could not load pending proposals.', error);
          if (!cancelled) setContext({proposals: [], sourceTitleById: new Map()});
        });
    };
    load();
    window.addEventListener('wbd:lore-fact-records-changed', load);
    window.addEventListener('wbd:lore-records-changed', load);
    return () => {
      cancelled = true;
      window.removeEventListener('wbd:lore-fact-records-changed', load);
      window.removeEventListener('wbd:lore-records-changed', load);
    };
  }, [enabled, projectId]);

  return context;
}
