import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {WritingDocument} from '../../entityTypes';
import {useWorkspaceUiStore} from '../../store/workspaceUiStore';
import {WorkspaceAITextReportModal} from './WorkspaceAITextReportModal';

const marked = (text: string) =>
  `<span data-ai-text="character-scene" data-ai-provider="ollama" data-ai-model="qwen3:8b" data-ai-at="5">${text}</span>`;
const doc = (id: string, title: string, content: string, order: number): WritingDocument => ({
  id, projectId: 'p', title, content, order, createdAt: 1, updatedAt: 1
});
const documents = [
  doc('one', 'Opening', '<p>Mine only.</p>', 0),
  doc('two', 'Storm', `<p>Saved. ${marked('Old saved words')}</p>`, 1)
];

describe('WorkspaceAITextReportModal', () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState(), true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the open scene as edited, opens a listed scene, and copies a plain-text record', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
    const onOpenScene = vi.fn();
    render(
      <WorkspaceAITextReportModal
        documents={documents}
        selectedId='one'
        selectedTitle='Opening'
        selectedContent={`<p>Mine. ${marked('Two new')}</p>`}
        onOpenScene={onOpenScene}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => useWorkspaceUiStore.getState().openAITextReport());
    expect(screen.getByRole('dialog', {name: 'AI text report'})).toBeTruthy();
    expect(screen.getByTestId('ai-text-report-summary').textContent).toBe(
      '5 words in 2 passages, across 2 of 2 scenes. The manuscript has 7 words in all.'
    );
    expect(screen.getByText(/Character scene · Ollama \(Local\) · qwen3:8b: 5 words in 2 passages/)).toBeTruthy();
    expect(screen.getByText(/Some publishing platforms ask/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'Copy report'}));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('- Storm: 3 words in 1 passage of 4 words'));

    fireEvent.click(screen.getByRole('button', {name: 'Storm'}));
    expect(onOpenScene).toHaveBeenCalledWith(documents[1]);
    expect(useWorkspaceUiStore.getState().isAITextReportOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so plainly when nothing is marked', () => {
    render(
      <WorkspaceAITextReportModal
        documents={[documents[0]]}
        selectedId={null}
        selectedTitle=''
        selectedContent=''
        onOpenScene={vi.fn()}
      />
    );
    act(() => useWorkspaceUiStore.getState().openAITextReport());
    expect(screen.getByTestId('ai-text-report-summary').textContent).toBe('No marked AI text in 1 scene.');
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(useWorkspaceUiStore.getState().isAITextReportOpen).toBe(false);
  });
});
