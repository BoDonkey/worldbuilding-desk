import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import type {ComponentProps} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {getConsultationBudgetStatus} from '../../services/editor';
import {clearModelContextSizeCache} from '../../services/llm/modelContextSize';
import {AIAssistant} from './AIAssistant';

const mocks = vi.hoisted(() => ({
  getDocumentsByProject: vi.fn(),
  getEntitiesByProject: vi.fn(),
  getAliasesByProject: vi.fn(),
  search: vi.fn(),
  stream: vi.fn()
}));

vi.mock('../../services/storage/repositories/entityStorage', () => ({
  getEntitiesByProject: mocks.getEntitiesByProject
}));

vi.mock('../../services/storage/repositories/aliasStorage', () => ({
  getAliasesByProject: mocks.getAliasesByProject
}));

vi.mock('../../services/storage/repositories/writingStorage', () => ({
  getDocumentsByProject: mocks.getDocumentsByProject
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

vi.mock('../../services/craft/getCraftLibraryService', () => ({
  getCraftLibraryService: vi.fn(async () => ({
    search: vi.fn(async () => [])
  }))
}));

vi.mock('../../services/llm/LLMService', () => ({
  LLMService: class {
    async *stream(request: unknown) {
      mocks.stream(request);
      yield 'This should not be used.';
    }
  }
}));

const hostedSettings: ProjectAISettings = {
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}},
  promptTools: [],
  defaultToolIds: [],
  inspectorSettings: {
    enableAIConsultation: true,
    maxConsultationsPerDay: 1,
    maxContextChars: 1800,
    maxResponseTokens: 500,
    lowCostModel: ''
  }
};

const renderAssistant = (props: ComponentProps<typeof AIAssistant>) =>
  render(
    <MemoryRouter>
      <AIAssistant {...props} />
    </MemoryRouter>
  );

describe('AIAssistant factual lookup integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.getDocumentsByProject.mockReset();
    mocks.getDocumentsByProject.mockResolvedValue([]);
    mocks.getEntitiesByProject.mockReset();
    mocks.getEntitiesByProject.mockResolvedValue([
      {id: 'sera', projectId: 'p', categoryId: 'characters', name: 'Sera Kestrel', fields: {}, links: [], createdAt: 1, updatedAt: 1},
      {id: 'brannic', projectId: 'p', categoryId: 'characters', name: 'Brannic', fields: {}, links: [], createdAt: 1, updatedAt: 1}
    ]);
    mocks.getAliasesByProject.mockReset();
    mocks.getAliasesByProject.mockResolvedValue([
      {id: 'alias-sera', projectId: 'p', targetId: 'sera', targetType: 'entity', alias: 'Sera', createdAt: 1, updatedAt: 1}
    ]);
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
    renderAssistant({
      projectId: 'project-a',
      aiConfig: {
          provider: 'ollama',
          configs: {},
          promptTools: [],
          defaultToolIds: []
      }
    });

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
    expect(getConsultationBudgetStatus('project-a', 20).used).toBe(0);
    fireEvent.click(screen.getByText('Sources used'));
    await waitFor(() => {
      expect(screen.getByText('Accepted canon fact - Sera Kestrel')).toBeVisible();
    });
  });

  it('answers D-4 from ordered saved custody evidence without invoking the provider', async () => {
    mocks.getDocumentsByProject.mockResolvedValue([
      {
        id: 'chapter-three',
        projectId: 'project-d4',
        title: 'Chapter Three — The Weighing House',
        content: 'Odessa tapped the desk. "The Key goes into my deep vault."',
        order: 3,
        createdAt: 3,
        updatedAt: 3
      },
      {
        id: 'chapter-four',
        projectId: 'project-d4',
        title: 'Chapter Four — Sorrowsteel',
        content:
          "Signed out of Odessa's deep vault that morning, the Key had gone back into Brannic's breast pocket after.",
        order: 4,
        createdAt: 4,
        updatedAt: 4
      },
      {
        id: 'chapter-five',
        projectId: 'project-d4',
        title: 'Chapter Five — The Hollow Court',
        content:
          'Sera came down the antechamber slowly.\n\nShe stopped at the gate. She pressed the Emberglass Key into the lock.',
        order: 5,
        createdAt: 5,
        updatedAt: 5
      }
    ]);
    mocks.search.mockResolvedValue([
      {
        score: 2,
        chunk: {
          id: 'chapter-three-0',
          documentId: 'chapter-three',
          documentTitle: 'Chapter Three — The Weighing House',
          content: 'The Key goes into my deep vault.',
          metadata: {type: 'scene'}
        }
      },
      {
        score: 1.8,
        chunk: {
          id: 'invented-note-0',
          documentId: 'lore:invented-note',
          documentTitle: 'Loose Notes',
          content: "The Emberglass Key is kept in the Archivist's vault.",
          metadata: {type: 'lore'}
        }
      }
    ]);
    renderAssistant({
      projectId: 'project-d4',
      aiConfig: {
          provider: 'ollama',
          configs: {},
          promptTools: [],
          defaultToolIds: []
      }
    });

    await screen.findByText('Project context ready.');
    fireEvent.change(screen.getByRole('textbox'), {
      target: {value: 'Where is the Emberglass Key kept?'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));

    await screen.findByText(/designated storage.*Odessa's deep vault/i);
    expect(screen.getByText(/Brannic has it in a pocket/i)).toBeVisible();
    expect(screen.getByText(/Sera uses it/i)).toBeVisible();
    expect(screen.getByText(/current custody is uncertain/i)).toBeVisible();
    expect(mocks.search).toHaveBeenCalledWith(
      'Where is the Emberglass Key kept?',
      20
    );
    expect(mocks.getDocumentsByProject).toHaveBeenCalledWith('project-d4');
    expect(mocks.stream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sources used'));
    expect(screen.getByText('Scene draft - Chapter Three — The Weighing House')).toBeVisible();
    expect(screen.getByText('Scene draft - Chapter Four — Sorrowsteel')).toBeVisible();
    expect(screen.getByText('Scene draft - Chapter Five — The Hollow Court')).toBeVisible();
  });

  it('sends nothing while a send is blocked, keeps the question, and explains why', async () => {
    const props: ComponentProps<typeof AIAssistant> = {
      projectId: 'project-blocked',
      aiConfig: {provider: 'ollama', configs: {}, promptTools: [], defaultToolIds: []},
      sendBlockedReason: 'Loading pending proposals… Send is available once they are ready.'
    };
    const {rerender} = renderAssistant(props);

    await screen.findByText('Loading pending proposals… Send is available once they are ready.');
    const input = screen.getByRole('textbox');
    fireEvent.change(input, {target: {value: 'Help me think through the spy rumor.'}});
    expect(screen.getByRole('button', {name: 'Send'})).toBeDisabled();
    fireEvent.keyDown(input, {key: 'Enter'});
    expect(input).toHaveValue('Help me think through the spy rumor.');
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <AIAssistant {...props} sendBlockedReason={null} />
      </MemoryRouter>
    );
    await screen.findByText('Project context ready.');
    expect(screen.getByRole('button', {name: 'Send'})).toBeEnabled();
  });

  it('never sends an unsupported factual question to the creative provider', async () => {
    mocks.search.mockResolvedValue([
      {
        score: 2,
        chunk: {
          id: 'chapter-five-0',
          documentId: 'chapter-five',
          documentTitle: 'Chapter Five — The Hollow Court',
          content:
            'They took an impression of the vault tag. The Emberglass Key remained the subject of argument.',
          metadata: {type: 'scene'}
        }
      }
    ]);
    renderAssistant({
      projectId: 'project-unknown-fact',
      aiConfig: {
          provider: 'ollama',
          configs: {},
          promptTools: [],
          defaultToolIds: []
      }
    });

    await screen.findByText('Project context ready.');
    fireEvent.change(screen.getByRole('textbox'), {
      target: {value: 'Who stole the Emberglass Key?'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));

    await screen.findByText(/couldn't verify an explicit answer/i);
    expect(screen.getByText(/won't invent one/i)).toBeVisible();
    expect(mocks.search).toHaveBeenCalledWith('Who stole the Emberglass Key?', 20);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  const send = (value: string) => {
    fireEvent.change(screen.getByRole('textbox'), {target: {value}});
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
  };
  const ollama: ProjectAISettings = {provider: 'ollama', configs: {}, promptTools: [], defaultToolIds: []};

  it('carries a follow-up subject forward from the previous turn and shows what it assumed (1.4b)', async () => {
    renderAssistant({projectId: 'project-follow-up', aiConfig: ollama});
    await screen.findByText('Project context ready.');

    send('Who is Sera?');
    await screen.findByText(/couldn't verify an explicit answer/i);
    send('What is her occupation?');

    await screen.findByText(
      "Answering about Sera Kestrel, from your previous question. Sera Kestrel's accepted occupation is cartographer."
    );
    expect(mocks.search).toHaveBeenLastCalledWith("What is Sera Kestrel's occupation?", 20);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('asks which record is meant instead of answering an ambiguous follow-up (1.4b)', async () => {
    renderAssistant({projectId: 'project-ambiguous', aiConfig: ollama});
    await screen.findByText('Project context ready.');

    send('Did Sera ever meet Brannic?');
    await screen.findByText(/couldn't verify an explicit answer/i);
    mocks.search.mockClear();
    send('And his rank?');

    await screen.findByText(/could be about Sera Kestrel or Brannic, so I haven't answered it/);
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('gates an instruction-phrased factual request instead of sending it to the provider (1.4b)', async () => {
    renderAssistant({projectId: 'project-instruction', aiConfig: hostedSettings, showWritingCoach: false});
    await screen.findByText('Project context ready.');

    send('Remind me where the ledger is kept');

    await screen.findByText(/won't invent one/i);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(getConsultationBudgetStatus('project-instruction', 1).used).toBe(0);
  });

  it('never carries a subject across conversations (1.4b)', async () => {
    const first = renderAssistant({projectId: 'project-scoped', aiConfig: ollama, conversationScope: 'ask'});
    await screen.findByText('Project context ready.');
    send('Who is Sera?');
    await screen.findByText(/couldn't verify an explicit answer/i);
    first.unmount();

    renderAssistant({projectId: 'project-scoped', aiConfig: ollama});
    await screen.findByText('Project context ready.');
    mocks.search.mockClear();
    send('What is her occupation?');

    await screen.findByText(/couldn't verify an explicit answer/i);
    expect(screen.queryByText(/Answering about/)).not.toBeInTheDocument();
    expect(mocks.search).toHaveBeenCalledWith('What is her occupation?', 20);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('discloses, records, and blocks ordinary hosted assistant requests', async () => {
    mocks.search.mockResolvedValue([]);
    renderAssistant({
      projectId: 'project-budget',
      aiConfig: hostedSettings,
      showWritingCoach: false
    });

    await screen.findByText('Project context ready.');
    expect(screen.getByText(/to Anthropic’s servers/)).toBeVisible();
    expect(screen.getByText(/Costs 1 of this project's 1 daily AI consultations/)).toBeVisible();

    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Brainstorm a tense harbor scene.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));

    await screen.findByText('This should not be used.');
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(getConsultationBudgetStatus('project-budget', 1)).toMatchObject({
      used: 1,
      remaining: 0,
      exhausted: true
    });
    expect(getConsultationBudgetStatus('project-budget', 1).byFeature).toContainEqual({
      feature: 'assistant',
      label: 'Writing assistant',
      count: 1
    });
    expect(await screen.findByRole('button', {name: 'Add 10 more for today'})).toBeVisible();

    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Brainstorm one more turn.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));

    await screen.findByText(/used all 1 AI consultations/i);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it('attributes the embedded writing coach to writing-coach', async () => {
    renderAssistant({
      projectId: 'project-coach-budget',
      aiConfig: hostedSettings,
      sceneText: 'Sera waits beside the locked harbor gate.'
    });

    await screen.findByText('Project context ready.');
    fireEvent.click(screen.getByRole('button', {name: 'Ask the writing coach'}));
    await screen.findByText('This should not be used.');

    expect(getConsultationBudgetStatus('project-coach-budget', 1).byFeature).toContainEqual({
      feature: 'writing-coach',
      label: 'Writing coach',
      count: 1
    });
  });
  it('opens a coach reply in a wide reading view and returns focus on close', async () => {
    renderAssistant({
      projectId: 'project-coach-reader',
      aiConfig: hostedSettings,
      sceneText: 'Sera waits beside the locked harbor gate.'
    });

    await screen.findByText('Project context ready.');
    expect(screen.queryByRole('button', {name: 'Expand reply in a reading view'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Ask the writing coach'}));
    await screen.findByText('This should not be used.');
    const expand = await screen.findByRole('button', {name: 'Expand reply in a reading view'});
    expand.focus();
    fireEvent.click(expand);

    const dialog = screen.getByRole('dialog', {name: 'Assistant reply'});
    expect(dialog).toHaveTextContent('This should not be used.');
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(screen.queryByRole('dialog', {name: 'Assistant reply'})).toBeNull();
    expect(expand).toHaveFocus();
  });
  it('offers Clear on the selected text card only when the host can clear it', async () => {
    const onClearContext = vi.fn();
    const context = {type: 'document' as const, id: 'scene-1', selectedText: 'Sera waits.'};
    const {rerender} = renderAssistant({
      projectId: 'project-clear-context',
      aiConfig: hostedSettings,
      context,
      sceneText: 'Sera waits. The gate stays shut.',
      onClearContext
    });

    await screen.findByText('Project context ready.');
    expect(screen.getByText('Sera waits.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Clear selected text'}));
    expect(onClearContext).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <AIAssistant
          projectId='project-clear-context'
          aiConfig={hostedSettings}
          context={context}
          sceneText='Sera waits. The gate stays shut.'
        />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', {name: 'Clear selected text'})).toBeNull();
  });

  describe('context budget (4.71)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      clearModelContextSizeCache();
    });

    it('leaves out what does not fit a small local model, lowest priority first, and says so', async () => {
      clearModelContextSizeCache();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url === 'http://localhost:5001/props'
            ? ({ok: true, json: async () => ({n_ctx: 2048})} as Response)
            : ({ok: false, json: async () => ({})} as Response)
        )
      );
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
          score: 1.9,
          chunk: {
            id: 'harbor-notes-0',
            documentId: 'lore:harbor-notes',
            documentTitle: 'Harbor Notes',
            content: `Harbor rumor. ${'The tide bell rings twice at dusk. '.repeat(120)}`,
            metadata: {type: 'lore'}
          }
        }
      ]);
      renderAssistant({
        projectId: 'project-context-budget',
        aiConfig: {...hostedSettings, provider: 'local-openai', configs: {'local-openai': {}}},
        showWritingCoach: false
      });

      await screen.findByText('Project context ready.');
      fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Brainstorm a tense harbor scene with Sera Kestrel.'}});
      fireEvent.click(screen.getByRole('button', {name: 'Send'}));

      await screen.findByText('This should not be used.');
      const [[request]] = mocks.stream.mock.calls as unknown as Array<[{context: Array<{source: string}>}]>;
      expect(request.context.map((chunk) => chunk.source)).toEqual(['Accepted canon: World Bible record - Sera Kestrel']);
      expect(screen.getByText('Left out to fit the model’s context')).toBeInTheDocument();
      expect(screen.getByText('General Source Note: project reference, not automatically canon - Harbor Notes')).toBeInTheDocument();
      // 4.72: the sources sent carry token counts, and the prompt is totalled against the model.
      expect(screen.getByLabelText('Prompt size')).toHaveTextContent(/^Prompt: about [\d,]+ tokens of the model’s 2,048 \(instructions ~[\d,]+, conversation ~[\d,]+, project context ~[\d,]+\)\. About [\d,]+ left for the reply\.$/);
      // Only what was sent is counted: the one source kept is the whole project context.
      const sourceTokens = screen.getByText(/^~\d+ tokens$/).textContent!.replace(/\D/g, '');
      expect(screen.getByLabelText('Prompt size')).toHaveTextContent(`project context ~${sourceTokens})`);
    });
  });
});
