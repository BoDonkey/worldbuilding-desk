import {useCallback, useEffect, useState} from 'react';
import type {Project, StoredRuleset} from '../entityTypes';
import type {MemoryEntry, ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {promoteDocumentToParent} from '../services/seriesBible/SeriesBibleService';

/** The ruleset's project-memory summary, and promoting the ruleset to a parent series. */
export const useCharacterSheetRulesetMemory = (params: {
  activeProject: Project | null;
  ruleset: StoredRuleset | null;
  shodhService: ShodhMemoryProvider | null;
}) => {
  const {activeProject, ruleset, shodhService} = params;
  const [rulesetMemory, setRulesetMemory] = useState<MemoryEntry | null>(null);
  const [rulesetMemoryFilter, setRulesetMemoryFilter] = useState('');

  const refreshRulesetMemory = useCallback(async () => {
    if (!shodhService || !ruleset?.id) {
      setRulesetMemory(null);
      return;
    }
    const list = await shodhService.listMemories();
    const memory = list.find((entry) => entry.documentId === ruleset.id) ?? null;
    setRulesetMemory(memory);
  }, [shodhService, ruleset?.id]);

  useEffect(() => {
    void refreshRulesetMemory();
  }, [refreshRulesetMemory]);

  const handlePromoteRuleset = useCallback(async () => {
    if (!ruleset || !activeProject?.parentProjectId) return;
    const ruleText = ruleset.rules
      .map((rule) => `${rule.name}: ${rule.description || ''}`)
      .join('\n');
    await promoteDocumentToParent({
      parentProjectId: activeProject.parentProjectId,
      documentId: ruleset.id,
      title: ruleset.name || 'Ruleset',
      content: `${ruleset.description ?? ''}\n${ruleText}`,
      type: 'rule',
      tags: ['ruleset']
    });
  }, [ruleset, activeProject?.parentProjectId]);

  return {
    rulesetMemory, rulesetMemoryFilter, setRulesetMemoryFilter,
    refreshRulesetMemory, handlePromoteRuleset
  };
};

export type CharacterSheetRulesetMemory = ReturnType<typeof useCharacterSheetRulesetMemory>;
