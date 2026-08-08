import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AIAssistant} from './AIAssistant';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  stream: vi.fn()
}));

vi.mock('../../services/rag/getRAGService', () => ({
  getRAGService: vi.fn(async () => ({
    init: vi.fn(),
    setEntityVocabulary: vi.fn(),
    deleteDocument: vi.fn(),
    indexDocument: vi.fn(),
    search: mocks.search,
    getDiagnostics: vi.fn()
  }))
}));

vi.mock('../../services/shodh/getShodhService', () => ({
  getShodhService: vi.fn(async () => ({
    listMemories: vi.fn(async () => []),
    captureAutoMemory: vi.fn(),
    deleteMemoriesForDocument: vi.fn()
  }))
}));

vi.mock('../../services/llm/LLMService', () => ({
  LLMService: class {
    async *stream() {
      mocks.stream();
      yield 'This should not be used.';
    }
  }
}));

describe('AIAssistant factual lookup integration', () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.stream.mockReset();
    mocks.search.mockResolvedValue([
      {
        score: 2,
        chunk: {
          id: 'sera-world-0',
          documentId: 'sera',
          documentTitle: 'Sera Kestrel',
          content: 'Sera Kestrel description: Junior delver.',
          metadata: {type: 'worldbible'}
        }
      },
      {
        score: 1.4,
        chunk: {
          id: 'sera-occupation-0',
          documentId: 'canon-fact:occupation',
          documentTitle: 'Sera Kestrel',
          content: 'Sera Kestrel occupation: cartographer',
          metadata: {type: 'canon_fact', tags: ['canon_fact', 'occupation']}
        }
      },
      {
        score: 1.2,
        chunk: {
          id: 'working-notes-0',
          documentId: 'lore:working-notes',
          documentTitle: 'Working Notes',
          content: 'Earlier draft idea: Sera was a smuggler.',
          metadata: {type: 'lore'}
        }
      }
    ]);
  });

  it('answers D-1 from accepted canon without invoking the provider', async () => {
    render(
      <AIAssistant
        projectId='project-a'
        aiConfig={{
          provider: 'ollama',
          configs: {},
          promptTools: [],
          defaultToolIds: []
        }}
      />
    );

    await screen.findByText('Project context ready.');
    fireEvent.change(screen.getByRole('textbox'), {
      target: {value: 'What did Sera do before she became a delver?'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));

    await screen.findByText('Sera was a cartographer before becoming a delver.');
    expect(mocks.search).toHaveBeenCalledWith(
      'What did Sera do before she became a delver?',
      20
    );
    expect(mocks.stream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sources used'));
    await waitFor(() => {
      expect(screen.getByText('Accepted canon fact - Sera Kestrel')).toBeVisible();
    });
  });
});
