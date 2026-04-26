import {getConsistencyEngineService} from '../consistency';
import type {ProjectAISettings} from '../../entityTypes';
import {DeterministicWorldEngine} from './DeterministicWorldEngine';
import {LocalAiReviewWorldEngine} from './LocalAiReviewWorldEngine';
import type {WorldEngine} from './types';

type WorldEngineMode = 'deterministic' | 'local-ai-preview';

export function getWorldEngine(
  mode: WorldEngineMode = 'deterministic',
  settings?: ProjectAISettings | null
): WorldEngine {
  const deterministic = new DeterministicWorldEngine(getConsistencyEngineService());
  return (
    mode === 'local-ai-preview'
      ? new LocalAiReviewWorldEngine(deterministic, settings)
      : deterministic
  );
}
