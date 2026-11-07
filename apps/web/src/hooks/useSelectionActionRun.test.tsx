import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings, SelectionAction} from '../entityTypes';
import {useSelectionActionRun} from './useSelectionActionRun';
import {getConsultationBudgetStatus} from '../services/editor';

const mocks = vi.hoisted(() => ({stream: vi.fn()}));

vi.mock('../services/llm/LLMService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/llm/LLMService')>();
  return {
    LLMService: class extends actual.LLMService {
      stream = mocks.stream;
    }
  };
});

const action = (id: string, output: 'replace' | 'note'): SelectionAction => ({
  id, name: output === 'replace' ? 'Tighten' : 'Check', instructions: 'Do it.',
  includeScene: true, includeWorldBible: false, output, enabled: true
});

const aiSettings = {
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}},
  promptTools: [],
  defaultToolIds: [],
  aiCoaching: true,
  aiProse: true,
  selectionActions: [action('r', 'replace'), action('n', 'note')]
} as unknown as ProjectAISettings;

const selection = {selectedText: 'Alpha', passage: 'Alpha', from: 1, to: 6};

function setup() {
  const setPendingAIInsert = vi.fn();
  const onSceneRevisionPreview = vi.fn();
  const hook = renderHook(() =>
    useSelectionActionRun({
      projectId: 'project-actions',
      aiSettings,
      documentId: 'scene-1',
      sceneTitle: 'Opening',
      content: '<p>Alpha content</p>',
      documents: [],
      setPendingAIInsert,
      onSceneRevisionPreview
    })
  );
  return {hook, setPendingAIInsert, onSceneRevisionPreview};
}

describe('useSelectionActionRun (5.19)', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.stream.mockReset();
  });

  it('turns a rewrite into a scene revision preview marked as AI text, and spends one rewrite', async () => {
    mocks.stream.mockImplementation(async function* () {
      yield '"Omega"';
    });
    const {hook, setPendingAIInsert, onSceneRevisionPreview} = setup();
    expect(hook.result.current.menu?.actions.map((entry) => entry.id)).toEqual(['r', 'n']);
    await act(async () => hook.result.current.menu?.onRun('r', selection));
    await vi.waitFor(() => expect(setPendingAIInsert).toHaveBeenCalled());
    const insert = setPendingAIInsert.mock.calls[0][0];
    expect(insert.revision).toMatchObject({
      projectId: 'project-actions', documentId: 'scene-1', sourceContent: '<p>Alpha content</p>',
      selectedText: 'Alpha', range: {from: 1, to: 6}, text: 'Omega'
    });
    expect(insert.provenance.origin).toBe('ai-action');
    expect(onSceneRevisionPreview).toHaveBeenCalled();
    const request = mocks.stream.mock.calls[0][0];
    expect(request.feature).toBe('ai-action-replace');
    expect(request.messages[0].content).toContain('Alpha content');
    expect(getConsultationBudgetStatus('project-actions', 20).byFeature).toEqual(
      expect.arrayContaining([expect.objectContaining({feature: 'ai-action-replace', count: 1})])
    );
  });

  it('opens a note in the reader and never prepares an edit', async () => {
    mocks.stream.mockImplementation(async function* () {
      yield 'No contradictions.';
    });
    const {hook, setPendingAIInsert} = setup();
    await act(async () => hook.result.current.menu?.onRun('n', selection));
    await vi.waitFor(() => expect(hook.result.current.note?.content).toBe('No contradictions.'));
    expect(hook.result.current.note?.question).toBe('Check: “Alpha”');
    expect(mocks.stream.mock.calls[0][0].feature).toBe('ai-action-note');
    expect(setPendingAIInsert).not.toHaveBeenCalled();
  });
});
