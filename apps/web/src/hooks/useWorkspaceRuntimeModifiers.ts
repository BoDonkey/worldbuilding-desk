import {useEffect, useMemo} from 'react';
import type {Character, Project} from '../entityTypes';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getPartySynergySuggestions
} from '../services/compendium';
import type {useWorkspaceProjectData} from './useWorkspaceProjectData';
import type {useWorkspaceSystemHistory} from './useWorkspaceSystemHistory';

type ProjectData = ReturnType<typeof useWorkspaceProjectData>;
type SystemHistory = ReturnType<typeof useWorkspaceSystemHistory>;

interface UseWorkspaceRuntimeModifiersParams {
  activeProject: Project | null;
  characters: Character[];
  settlementState: ProjectData['settlementState'];
  settlementModules: ProjectData['settlementModules'];
  addSystemHistory: SystemHistory['addSystemHistory'];
  refreshSystemHistory: SystemHistory['refreshSystemHistory'];
}

/**
 * Game-systems bonuses that apply while writing: party synergies among the
 * characters and settlement modules, combined into the runtime modifiers
 * stat blocks and snapshots use. A complete synergy adds a quest-hook entry
 * to system history once per set of active combos.
 */
export function useWorkspaceRuntimeModifiers({
  activeProject,
  characters,
  settlementState,
  settlementModules,
  addSystemHistory,
  refreshSystemHistory
}: UseWorkspaceRuntimeModifiersParams) {
  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }),
    [characters]
  );
  const runtimeModifiers = useMemo(
    () =>
      deriveCharacterRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      }),
    [settlementState, settlementModules, activePartySynergies]
  );
  useEffect(() => {
    if (!activeProject) return;
    const activeRules = activePartySynergies
      .filter((item) => item.missingRoles.length === 0)
      .map((item) => item.ruleId)
      .sort();
    if (activeRules.length === 0) return;

    const message =
      activeRules.length === 1
        ? 'Quest hook available from an active party synergy combo.'
        : `Quest hooks available from ${activeRules.length} active party synergy combos.`;

    addSystemHistory({
      category: 'quest',
      message,
      insertText: `Quest Update: ${message}`,
      sourceKey: `party-synergy:${activeRules.join('|')}`,
      createdAt: Date.now()
    });
    refreshSystemHistory();
  }, [activeProject, activePartySynergies, addSystemHistory, refreshSystemHistory]);

  return {activePartySynergies, runtimeModifiers};
}
