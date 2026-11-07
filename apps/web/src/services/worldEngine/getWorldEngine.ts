import {getConsistencyEngineService} from '../consistency';
import type {ProjectAISettings} from '../../entityTypes';
import {DeterministicWorldEngine} from './DeterministicWorldEngine';
import {LocalAiReviewWorldEngine} from './LocalAiReviewWorldEngine';
import type {WorldEngine} from './types';
import {readAISwitches} from '../llm/aiSwitches';

type WorldEngineMode = 'deterministic' | 'local-ai-preview';

export function getWorldEngine(
  mode: WorldEngineMode = 'deterministic',
  settings?: ProjectAISettings | null
): WorldEngine {
  const deterministic = new DeterministicWorldEngine(getConsistencyEngineService());
  // Local AI review annotations are AI coaching (5.18): with the switch off, review stays
  // deterministic whatever mode was saved.
  return (
    mode === 'local-ai-preview' && readAISwitches(settings).coaching
      ? new LocalAiReviewWorldEngine(deterministic, settings)
      : deterministic
  );
}
