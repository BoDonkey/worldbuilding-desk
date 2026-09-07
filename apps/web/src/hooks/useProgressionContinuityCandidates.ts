import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {CanonicalFact, Character, StateMutationEvent, StoredRuleset, WritingDocument} from '../entityTypes';
import {getCanonicalFactsByProject} from '../services/lore/loreFactStorage';
import {getCharactersByProject} from '../characterStorage';
import {getAliasesByProject} from '../services/consistency/aliasStorage';
import {
  buildAbandonedProgressionMethodCandidates,
  buildUnusedSolutionCandidates,
  type ProgressionContinuityCandidate
} from '../services/progressionContinuity/progressionContinuityCandidates';

export function useProgressionContinuityCandidates(params: {
  projectId: string | null;
  documents: WritingDocument[];
  events: StateMutationEvent[];
  ruleset: StoredRuleset | null;
}) {
  const {projectId, documents, events, ruleset} = params;
  const [canonicalFacts, setCanonicalFacts] = useState<CanonicalFact[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterAliasesById, setCharacterAliasesById] = useState<Map<string, string[]>>(new Map());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setCanonicalFacts([]);
      setCharacters([]);
      setCharacterAliasesById(new Map());
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      const [nextFacts, nextCharacters, nextAliases] = await Promise.all([
        getCanonicalFactsByProject(projectId),
        getCharactersByProject(projectId),
        getAliasesByProject(projectId)
      ]);
      if (requestId !== requestIdRef.current) return;
      setCanonicalFacts(nextFacts);
      setCharacters(nextCharacters);
      const aliasesById = new Map<string, string[]>();
      for (const alias of nextAliases) {
        if (alias.targetType !== 'character') continue;
        const list = aliasesById.get(alias.targetId) ?? [];
        list.push(alias.alias);
        aliasesById.set(alias.targetId, list);
      }
      setCharacterAliasesById(aliasesById);
      setStatus('ready');
    } catch {
      if (requestId === requestIdRef.current) setStatus('error');
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const candidates = useMemo<ProgressionContinuityCandidate[]>(() => {
    const acceptedStateMutationEvents = events.filter((event) => event.status === 'accepted');
    return [
      ...buildUnusedSolutionCandidates({
        canonicalFacts,
        characters,
        characterAliasesById,
        documents
      }),
      ...buildAbandonedProgressionMethodCandidates({
        acceptedStateMutationEvents,
        documents,
        ruleset
      })
    ];
  }, [canonicalFacts, characterAliasesById, characters, documents, events, ruleset]);

  return {candidates, status, refresh};
}
