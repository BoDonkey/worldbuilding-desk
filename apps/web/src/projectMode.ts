import type {
  ProjectFeatureToggles,
  ProjectMode,
  ProjectSettings
} from './entityTypes';

const PROJECT_MODE_OPTIONS: Array<{value: ProjectMode; label: string}> = [
  {value: 'litrpg', label: 'LitRPG Author'},
  {value: 'game', label: 'Game Simulation'},
  {value: 'general', label: 'General Fiction'}
];

const FIRST_RELEASE_PROJECT_MODE_OPTIONS = PROJECT_MODE_OPTIONS.filter(
  (option) => option.value !== 'game'
);

/**
 * New and ordinary projects expose the two supported first-release modes.
 * A legacy Game Simulation project keeps its current value visible until the
 * author explicitly changes it; its persisted contract and data stay intact.
 */
export function getVisibleProjectModeOptions(
  currentMode?: ProjectMode
): Array<{value: ProjectMode; label: string}> {
  return currentMode === 'game'
    ? PROJECT_MODE_OPTIONS
    : FIRST_RELEASE_PROJECT_MODE_OPTIONS;
}

export const DEFAULT_FEATURE_TOGGLES_BY_MODE: Record<
  ProjectMode,
  ProjectFeatureToggles
> = {
  litrpg: {
    enableGameSystems: true,
    enableRuntimeModifiers: true,
    enableSettlementAndZoneSystems: true,
    enableRuleAuthoring: true
  },
  game: {
    enableGameSystems: true,
    enableRuntimeModifiers: true,
    enableSettlementAndZoneSystems: true,
    enableRuleAuthoring: true
  },
  general: {
    enableGameSystems: false,
    enableRuntimeModifiers: false,
    enableSettlementAndZoneSystems: false,
    enableRuleAuthoring: false
  }
};

export function getDefaultFeatureToggles(
  mode: ProjectMode
): ProjectFeatureToggles {
  return {
    ...DEFAULT_FEATURE_TOGGLES_BY_MODE[mode]
  };
}

export function normalizeFeatureToggles(params: {
  mode: ProjectMode;
  featureToggles?: Partial<ProjectFeatureToggles> | null;
}): ProjectFeatureToggles {
  return {
    ...getDefaultFeatureToggles(params.mode),
    ...(params.featureToggles ?? {})
  };
}

export interface ProjectCapabilities {
  canUseGameSystems: boolean;
  canUseRuntimeModifiers: boolean;
  canUseSettlementAndZoneSystems: boolean;
  canUseRuleAuthoring: boolean;
  isGeneralFiction: boolean;
}

export function getProjectCapabilities(
  settings: ProjectSettings | null | undefined
): ProjectCapabilities {
  const toggles = settings?.featureToggles;
  const canUseGameSystems = toggles?.enableGameSystems === true;

  return {
    canUseGameSystems,
    canUseRuntimeModifiers:
      canUseGameSystems && toggles?.enableRuntimeModifiers === true,
    canUseSettlementAndZoneSystems:
      canUseGameSystems && toggles?.enableSettlementAndZoneSystems === true,
    canUseRuleAuthoring: toggles?.enableRuleAuthoring === true,
    isGeneralFiction: settings?.projectMode === 'general'
  };
}
