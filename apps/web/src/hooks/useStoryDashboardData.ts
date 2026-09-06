import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChapterCard, StateMutationEvent, StoredRuleset, WritingDocument} from '../entityTypes';
import {getDocumentsByProject} from '../writingStorage';
import {buildStoryDashboard} from '../services/dashboard/storyDashboard';
import {getRulesetByProjectId} from '../services/rules/rulesetService';
import {getStateMutationEventsByProject} from '../services/state/stateMutationLedger';

export function useStoryDashboardData(params: {
  projectId: string | null;
  cards: ChapterCard[];
  mechanicsEnabled: boolean;
}) {
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [events, setEvents] = useState<StateMutationEvent[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!params.projectId) {
      setDocuments([]);
      setEvents([]);
      setRuleset(null);
      setStatus('idle');
      return;
    }
    const projectId = params.projectId;
    setStatus('loading');
    try {
      const [nextDocuments, nextEvents, nextRuleset] = await Promise.all([
        getDocumentsByProject(projectId),
        getStateMutationEventsByProject(projectId),
        getRulesetByProjectId(projectId)
      ]);
      if (requestId !== requestIdRef.current) return;
      setDocuments(nextDocuments);
      setEvents(nextEvents);
      setRuleset(nextRuleset);
      setStatus('ready');
    } catch {
      if (requestId === requestIdRef.current) {
        setStatus('error');
      }
    }
  }, [params.projectId]);

  useEffect(() => {
    void refresh();
    window.addEventListener('wbd:writing-records-changed', refresh);
    window.addEventListener('wbd:state-mutation-events-changed', refresh);
    return () => {
      window.removeEventListener('wbd:writing-records-changed', refresh);
      window.removeEventListener('wbd:state-mutation-events-changed', refresh);
    };
  }, [refresh]);

  const dashboard = useMemo(() => buildStoryDashboard({
    documents,
    events,
    cards: params.cards,
    ruleset,
    mechanicsEnabled: params.mechanicsEnabled
  }), [documents, events, params.cards, params.mechanicsEnabled, ruleset]);

  return {dashboard, documents, status, refresh};
}
