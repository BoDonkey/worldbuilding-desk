import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {CONSULTATION_FEATURES} from '../editor/inspectorBudgetService';
import {FEATURE_SWITCH, aiSwitchRefusal, readAISwitches, AISwitchOffError} from './aiSwitches';
import {LLMService} from './LLMService';
import {answerOllamaTags, withoutTagLookups} from '../../test/ollamaTagsStub';

const ollama = (switches: Partial<Pick<ProjectAISettings, 'aiCoaching' | 'aiProse'>>) =>
  ({provider: 'ollama', configs: {ollama: {model: 'switch-test', baseUrl: 'http://localhost:11434'}}, ...switches}) as ProjectAISettings;

describe('AI switches (5.18)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('assigns every consultation feature to exactly one switch', () => {
    // A new feature without an assignment fails here as well as in the type checker.
    for (const feature of CONSULTATION_FEATURES) {
      expect(['coaching', 'prose'], feature).toContain(FEATURE_SWITCH[feature]);
    }
    expect(Object.keys(FEATURE_SWITCH).sort()).toEqual([...CONSULTATION_FEATURES].sort());
  });

  it('puts only manuscript-writing features under prose', () => {
    const prose = CONSULTATION_FEATURES.filter((feature) => FEATURE_SWITCH[feature] === 'prose').sort();
    expect(prose).toEqual(['ai-action-replace', 'character-scene', 'scene-draft', 'scene-revision']);
  });

  it('treats a missing switch as off', () => {
    expect(readAISwitches(undefined)).toEqual({coaching: false, prose: false});
    expect(readAISwitches({})).toEqual({coaching: false, prose: false});
    expect(readAISwitches({aiCoaching: true})).toEqual({coaching: true, prose: false});
  });

  it('refuses untagged requests and requests whose switch is off', () => {
    expect(aiSwitchRefusal({aiCoaching: true, aiProse: true}, undefined)).toMatch(/not tagged/);
    expect(aiSwitchRefusal({aiCoaching: false, aiProse: true}, 'assistant')).toMatch(/AI coaching is off/);
    expect(aiSwitchRefusal({aiCoaching: true, aiProse: false}, 'scene-draft')).toMatch(/AI prose is off/);
    expect(aiSwitchRefusal({aiCoaching: true}, 'assistant')).toBeNull();
    expect(aiSwitchRefusal({aiProse: true}, 'scene-revision')).toBeNull();
    // The connection test sends no story text, so it works with both switches off.
    expect(aiSwitchRefusal({}, 'connection-test')).toBeNull();
  });

  it('refuses in the shared call path before any request leaves the app', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const messages = [{role: 'user' as const, content: `switch probe ${Math.random()}`}];

    await expect(new LLMService(ollama({})).complete({feature: 'assistant', messages})).rejects.toBeInstanceOf(AISwitchOffError);
    await expect(new LLMService(ollama({aiCoaching: true})).complete({messages})).rejects.toThrow(/not tagged/);
    const proseOff = new LLMService(ollama({aiCoaching: true})).stream({feature: 'scene-draft', messages});
    await expect(proseOff.next()).rejects.toThrow(/AI prose is off/);
    const coachingOff = new LLMService(ollama({aiProse: true})).stream({feature: 'canvas-brainstorm', messages});
    await expect(coachingOff.next()).rejects.toThrow(/AI coaching is off/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a request whose switch is on', async () => {
    const fetchMock = vi.fn(answerOllamaTags(async () => new Response(JSON.stringify({message: {content: 'ok'}})), ['switch-test:latest']));
    vi.stubGlobal('fetch', fetchMock);
    const response = await new LLMService(ollama({aiProse: true})).complete({
      feature: 'scene-revision',
      messages: [{role: 'user', content: `allowed ${Math.random()}`}],
      cache: false
    });
    expect(response.content).toBe('ok');
    expect(withoutTagLookups(fetchMock.mock.calls)).toHaveLength(1);
  });
});
