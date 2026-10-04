import {describe, expect, it} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {buildAITextProvenance, normalizeAIText} from './aiTextProvenance';

describe('AI text provenance', () => {
  it('records provider, verified model, and route', () => {
    const aiConfig = {provider: 'ollama', configs: {ollama: {model: 'qwen3'}}} as unknown as ProjectAISettings;
    expect(
      buildAITextProvenance('character-scene', aiConfig, {
        kind: 'private-local', provider: 'ollama', isPrivateLocal: true, allowsRequests: true, model: 'qwen3:8b'
      }, 5)
    ).toEqual({origin: 'character-scene', provider: 'ollama', model: 'qwen3:8b', route: 'private-local', at: 5});

    const hosted = {provider: 'anthropic', configs: {anthropic: {model: 'claude-x'}}} as unknown as ProjectAISettings;
    expect(
      buildAITextProvenance('scene-revision', hosted, {
        kind: 'hosted', provider: 'anthropic', isPrivateLocal: false, allowsRequests: true
      }, 6)
    ).toEqual({origin: 'scene-revision', provider: 'anthropic', model: 'claude-x', route: 'hosted', at: 6});
  });

  it('drops zero-width characters and turns no-break spaces into spaces', () => {
    expect(normalizeAIText('A\u200Bb\u200Cc\u200Dd\u2060e\uFEFFf g\u202Fh\u00A0i')).toBe('Abcdef g h i');
  });
});
