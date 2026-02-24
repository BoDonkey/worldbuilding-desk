import type {ItemDurabilityOptions} from '../src/state/StateManager';

/**
 * Suggested defaults for a "break -> insight -> better tool" loop.
 */
export const LEGACY_CRAFTING_DEFAULTS: ItemDurabilityOptions = {
  durabilityCost: 1,
  allowBreak: true,
  scrapOnBreak: 2,
  insightOnBreak: 1,
  legacyUsageThreshold: 100,
  legacyYieldIncrement: 0.02,
  legacyNamePrefix: 'Legacy'
};

/**
 * Narrative milestone suggestion:
 * if a pickaxe survives roughly 10 level bands (or thresholded usage),
 * promote to a named legacy tool with a small permanent yield bonus.
 */
export const LEGACY_MILESTONES = [
  {tier: 1, label: 'Seasoned Tool', yieldBonusPercent: 0.02},
  {tier: 2, label: 'Veteran Tool', yieldBonusPercent: 0.04},
  {tier: 3, label: 'Heirloom Tool', yieldBonusPercent: 0.06}
];
