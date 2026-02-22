import type {GameRule} from '../src/types/GameRule';
import type {ExposureAilmentDefinition} from '../src/state/StateManager';

/**
 * Example ailment preset:
 * - 10 minutes of cave exposure applies Cave Lung
 * - Cave Lung lasts 20 minutes
 * - While active, drains stamina each minute
 */

export const CAVE_LUNG_AILMENT: ExposureAilmentDefinition = {
  id: 'ailment-cave-lung',
  exposureKey: 'cave_air',
  statusName: 'cave_lung',
  triggerAtSeconds: 10 * 60,
  durationSeconds: 20 * 60,
  sourceRuleId: 'status-cave-lung',
  cooldownSeconds: 5 * 60,
  data: {
    severity: 'moderate'
  }
};

export const CAVE_LUNG_RULES: GameRule[] = [
  {
    id: 'status-cave-lung-drain-stamina',
    name: 'Cave Lung Drains Stamina',
    description: 'Active cave lung drains stamina over time.',
    category: 'time',
    enabled: true,
    priority: 100,
    tags: ['ailment', 'cave_lung'],
    trigger: {
      type: 'status_active',
      statusName: 'cave_lung',
      interval: 60
    },
    effects: [
      {
        target: 'resources.current.stamina',
        operation: 'subtract',
        value: 3,
        min: 0,
        description: 'Cave lung stamina drain'
      }
    ]
  }
];
