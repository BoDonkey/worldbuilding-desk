import type {
  ProjectFeatureToggles,
  ProjectMode,
  ProjectSettings
} from './entityTypes';

export const PROJECT_MODE_OPTIONS: Array<{value: ProjectMode; label: string}> = [
  {value: 'litrpg', label: 'LitRPG Author'},
  {value: 'game', label: 'Game Simulation'},
  {value: 'general', label: 'General Fiction'}
];

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
