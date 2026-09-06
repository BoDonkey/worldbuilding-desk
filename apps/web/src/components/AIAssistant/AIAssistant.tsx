import React, {useState, useRef, useEffect, useCallback, useId} from 'react';
import styles from '../../assets/components/AIAssistant.module.css';
import {LLMService} from '../../services/llm/LLMService';
import type {RAGProvider} from '../../services/rag/RAGService';
import {getRAGService} from '../../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../../services/shodh/ShodhMemoryService';
import {getShodhService} from '../../services/shodh/getShodhService';
import {SHODH_MEMORIES_EVENT} from '../../services/shodh/shodhEvents';
import type {LLMContextChunk, LLMMessage} from '../../services/llm/types';
import {useAssistantConversation} from '../../hooks/useAssistantConversation';
import {
  appendContextTrustInstructions,
  buildRagContextChunks
} from '../../services/llm/contextProvenance';
import {PromptManager} from '../../services/prompts/PromptManager';
import {buildUnverifiedFactualAnswer} from '../../services/assistant/factualQuestionBoundary';
import {
  getTemporalCustodySubject,
  resolveTemporalCustodyAnswer
} from '../../services/assistant/temporalCustody';
import {getDocumentsByProject} from '../../writingStorage';
import type {ProjectAISettings, PromptTool, ProjectMode} from '../../entityTypes';
import {
  getContextInstruction,
  getContextLabel,
  getDirectSavedFactAnswer,
  getMemoryQueryTerms,
  getShodhTrustLabel,
  requiresProjectGrounding,
  selectWorldBibleContextForPrompt,
  stripAssistantThinking
} from './AIAssistant.helpers';

interface AIAssistantProps {
  projectId: string;
  aiConfig?: ProjectAISettings;
  projectMode?: ProjectMode;
  context?: {
    type: 'document' | 'rule' | 'rules' | 'character' | 'world-bible';
    id: string;
    selectedText?: string;
  };
  onInsert?: (text: string) => void;
  onCaptureSourceNote?: (text: string) => void;
  onAssistantSelectionChange?: (text: string) => void;
  queuedPrompt?: string | null;
  onQueuedPromptConsumed?: () => void;
  consultationModel?: string;
  consultationMaxTokens?: number;
  showContextPreview?: boolean;
  parentProjectId?: string;
  inheritRag?: boolean;
  inheritShodh?: boolean;
}

const getContextSourceSummaries = (chunks: LLMContextChunk[]): string[] =>
  Array.from(
    new Map(
      chunks
        .map((chunk) => chunk.source.trim())
        .filter(Boolean)
        .map((source) => [source.toLowerCase(), source])
    ).values()
  );

export const AIAssistant: React.FC<AIAssistantProps> = ({
  projectId,
  aiConfig,
  projectMode = 'litrpg',
  context,
  onInsert,
  onCaptureSourceNote,
  onAssistantSelectionChange,
  queuedPrompt,
  onQueuedPromptConsumed,
  consultationModel,
  consultationMaxTokens,
  showContextPreview = true,
  parentProjectId,
  inheritRag = false,
  inheritShodh = false
}) => {
  const [messages, setMessages] = useAssistantConversation(projectId);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [memoryCache, setMemoryCache] = useState<MemoryEntry[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [contextStatus, setContextStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const contextStatusId = useId();
  const messagesRef = useRef<HTMLDivElement>(null);

  const llmService = useRef<LLMService | null>(null);
  const ragService = useRef<RAGProvider | null>(null);
  const shodhService = useRef<ShodhMemoryProvider | null>(null);
  const consumedQueuedPromptRef = useRef<string | null>(null);

  const promptManager = useRef(new PromptManager());

  const selectedText = context?.selectedText?.trim() ?? '';
  const selectedTextPreview =
    selectedText.length > 700 ? `${selectedText.slice(0, 700).trim()}...` : selectedText;

  const syncMemoryCache = useCallback(async () => {
    if (!shodhService.current) return;
    try {
      const list = await shodhService.current.listMemories();
      setMemoryCache(list);
    } catch (error) {
      console.warn('Failed to load Shodh memories', error);
    }
  }, []);

  useEffect(() => {
    promptManager.current.init();
  }, []);

  useEffect(() => {
    if (!aiConfig) {
      llmService.current = null;
      setProviderError(
        'AI provider is not configured. Add an API key in Settings.'
      );
      return;
    }

    try {
      llmService.current = new LLMService(aiConfig);
      setProviderError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid AI configuration.';
      setProviderError(message);
      llmService.current = null;
    }
  }, [aiConfig]);

  useEffect(() => {
    const enabledTools = (aiConfig?.promptTools ?? []).filter((tool) => tool.enabled);
    const enabledIds = new Set(enabledTools.map((tool) => tool.id));
    const modeDefaults = aiConfig?.defaultToolIdsByMode?.[projectMode] ?? aiConfig?.defaultToolIds ?? [];
    const defaults = modeDefaults.filter((id) => enabledIds.has(id));
    setSelectedToolIds(defaults);
  }, [aiConfig, projectMode]);

  useEffect(() => {
    let cancelled = false;
    ragService.current = null;
    shodhService.current = null;
    setMemoryCache([]);
    setContextStatus('loading');
    Promise.all([
      getRAGService({projectId, parentProjectId, inheritFromParent: inheritRag}),
      getShodhService({projectId, parentProjectId, inheritFromParent: inheritShodh})
    ])
      .then(([rag, shodh]) => {
        if (!cancelled) {
          ragService.current = rag;
          shodhService.current = shodh;
          setContextStatus('ready');
          void syncMemoryCache();
        }
      })
      .catch((error) => {
        console.error('Failed to initialize project context', error);
        if (!cancelled) setContextStatus('error');
      });

    return () => {
      cancelled = true;
      ragService.current = null;
      shodhService.current = null;
    };
  }, [inheritRag, inheritShodh, parentProjectId, projectId, syncMemoryCache]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<MemoryEntry[] | undefined>;
      if (Array.isArray(custom.detail)) {
        setMemoryCache(custom.detail);
      } else {
        void syncMemoryCache();
      }
    };
    window.addEventListener(SHODH_MEMORIES_EVENT, handler);
    return () => {
      window.removeEventListener(SHODH_MEMORIES_EVENT, handler);
    };
  }, [syncMemoryCache]);

  const scrollMessagesToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const element = messagesRef.current;
      if (!element) return;
      element.scrollTop = element.scrollHeight;
    });
  }, []);

  const handleAssistantSelectionChange = useCallback(() => {
    if (!onAssistantSelectionChange) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';
    const anchorNode = selection?.anchorNode;
    const focusNode = selection?.focusNode;
    const messagesElement = messagesRef.current;
    if (
      !selectedText ||
      !messagesElement ||
      !anchorNode ||
      !focusNode ||
      !messagesElement.contains(anchorNode) ||
      !messagesElement.contains(focusNode)
    ) {
      onAssistantSelectionChange('');
      return;
    }

    onAssistantSelectionChange(stripAssistantThinking(selectedText));
  }, [onAssistantSelectionChange]);

  const buildMemoryChunks = useCallback(
    async (query: string) => {
      let allMemories = memoryCache;
      if (allMemories.length === 0 && shodhService.current) {
        allMemories = await shodhService.current.listMemories();
        setMemoryCache(allMemories);
      }
      if (allMemories.length === 0) {
        return [];
      }

      const docMatches = context?.id
        ? allMemories.filter((memory) => memory.documentId === context.id)
        : [];
      const queryTerms = getMemoryQueryTerms(query);
      const queryMatches = allMemories
        .filter((memory) => memory.documentId !== context?.id)
        .map((memory) => {
          const haystack = `${memory.title} ${memory.summary} ${
            memory.tags?.join(' ') ?? ''
          }`.toLowerCase();
          const matchedTerms = queryTerms.filter((term) => haystack.includes(term));
          return {
            memory,
            relevance: queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0
          };
        })
        .filter((entry) => entry.relevance > 0)
        .sort((left, right) => right.relevance - left.relevance);

      const ordered: MemoryEntry[] = [];
      const seen = new Set<string>();
      const pushUnique = (memory: MemoryEntry) => {
        if (seen.has(memory.id)) return;
        seen.add(memory.id);
        ordered.push(memory);
      };

      docMatches.forEach(pushUnique);
      queryMatches.forEach(({memory}) => pushUnique(memory));

      return ordered.slice(0, 3).map((memory) => ({
        content: memory.summary,
        source: `${getShodhTrustLabel(memory.tags)} (Shodh summary) - ${memory.title || 'Memory'} (${
          memory.projectId === projectId ? 'Local' : 'Parent'
        })`,
        relevance:
          memory.documentId === context?.id
            ? 1
            : queryMatches.find((entry) => entry.memory.id === memory.id)?.relevance ?? 0
      }));
    },
    [context?.id, memoryCache, projectId]
  );

  const handleSendPrompt = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    if (!llmService.current) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            providerError ||
            'AI provider unavailable. Check your settings and try again.'
        }
      ]);
      return;
    }
    if (contextStatus !== 'ready') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            contextStatus === 'error'
              ? 'Project context could not be loaded. Reopen the assistant or rebuild project context before asking a project question.'
              : 'Project context is still loading. Please try again in a moment.'
        }
      ]);
      return;
    }

    const contextLabel = getContextLabel(context?.type);
    const promptContext =
      context?.type === 'world-bible'
        ? selectWorldBibleContextForPrompt(selectedText, promptText)
        : selectedText;
    const selectedTextInstruction = selectedText
      ? getContextInstruction(context?.type, contextLabel)
      : '';
    const displayedUserMessage: LLMMessage = {role: 'user', content: promptText};
    const requestUserMessage: LLMMessage = {
      role: 'user',
      content: selectedTextInstruction
        ? `${selectedTextInstruction}\n\n${contextLabel}:\n"""\n${promptContext}\n"""\n\nAuthor request: ${promptText}`
        : promptText
    };
    setMessages((prev) => [...prev, displayedUserMessage]);
    setInput('');
    setIsStreaming(true);
    scrollMessagesToBottom();

    try {
      // Get relevant context from RAG
      const groundingRequired = requiresProjectGrounding(
        promptText,
        Boolean(selectedText)
      );
      const needsOrderedScenes = Boolean(getTemporalCustodySubject(promptText));
      const [ragResults, shodhChunks, orderedScenes] = await Promise.all([
        ragService.current
          ? ragService.current.search(promptText, groundingRequired ? 20 : 3)
          : [],
        buildMemoryChunks(promptText),
        needsOrderedScenes
          ? getDocumentsByProject(projectId).catch((error) => {
              console.warn('Unable to load ordered saved scenes for custody grounding.', error);
              return [];
            })
          : []
      ]);

      const directSavedFact =
        resolveTemporalCustodyAnswer(promptText, orderedScenes, ragResults) ??
        getDirectSavedFactAnswer(promptText, ragResults);
      if (directSavedFact) {
        const directChunks = await buildRagContextChunks(
          projectId,
          directSavedFact.results
        );
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: directSavedFact.content,
            contextSources: getContextSourceSummaries(directChunks)
          }
        ]);
        scrollMessagesToBottom();
        return;
      }

      if (groundingRequired) {
        const unverified = buildUnverifiedFactualAnswer(ragResults);
        const reviewedChunks = await buildRagContextChunks(
          projectId,
          unverified.results
        );
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: unverified.content,
            contextSources: getContextSourceSummaries(reviewedChunks)
          }
        ]);
        scrollMessagesToBottom();
        return;
      }

      const ragChunks = await buildRagContextChunks(projectId, ragResults.slice(0, 3));
      const contextChunks = [...shodhChunks, ...ragChunks];

      // Add selected text context if available
      if (selectedText) {
        contextChunks.unshift({
          content: promptContext,
          source: contextLabel,
          relevance: 1.0
        });
      }
      const contextSources = getContextSourceSummaries(contextChunks);

      const promptType = context?.type === 'rule' ? 'rules' : context?.type || 'document';
      const basePrompt = await promptManager.current.getPrompt(promptType);
      const activeTools = ((aiConfig?.promptTools ?? []) as PromptTool[])
        .filter((tool) => tool.enabled && selectedToolIds.includes(tool.id));
      const toolPrompt =
        activeTools.length > 0
          ? `\n\nActive Prompt Tools:\n${activeTools
              .map(
                (tool) =>
                  `- [${tool.kind.toUpperCase()}] ${tool.name}: ${tool.content}`
              )
              .join('\n')}`
          : '';
      const composedPrompt = appendContextTrustInstructions(`${basePrompt}${toolPrompt}`);


      // Stream response
      let rawAssistantMessage = '';
      setMessages((prev) => [
        ...prev,
        {role: 'assistant', content: '', contextSources}
      ]);
      scrollMessagesToBottom();

      for await (const chunk of llmService.current.stream({
        messages: [requestUserMessage],
        context: contextChunks,
        systemPrompt: composedPrompt,
        model: consultationModel?.trim() || undefined,
        maxTokens: consultationMaxTokens,
        think: false
      })) {
        rawAssistantMessage += chunk;
        const assistantMessage = stripAssistantThinking(rawAssistantMessage);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...(prev[prev.length - 1]?.role === 'assistant'
              ? prev[prev.length - 1]
              : {role: 'assistant' as const, contextSources}),
            content: assistantMessage
          }
        ]);
        scrollMessagesToBottom();
      }
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages((prev) => [
        ...prev,
        {role: 'assistant', content: 'Error: Failed to generate response.'}
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [
    buildMemoryChunks,
    consultationMaxTokens,
    consultationModel,
    context?.type,
    contextStatus,
    projectId,
    providerError,
    scrollMessagesToBottom,
    setMessages,
    selectedToolIds,
    selectedText,
    aiConfig?.promptTools
  ]);

  const handleSend = async () => {
    await handleSendPrompt(input);
  };

  useEffect(() => {
    const next = queuedPrompt?.trim() ?? '';
    if (!next) return;
    if (isStreaming) return;
    if (contextStatus !== 'ready') return;
    if (consumedQueuedPromptRef.current === next) return;
    consumedQueuedPromptRef.current = next;
    void handleSendPrompt(next).finally(() => {
      onQueuedPromptConsumed?.();
    });
  }, [queuedPrompt, handleSendPrompt, isStreaming, contextStatus, onQueuedPromptConsumed]);

  const getLastAssistantMessage = () =>
    [...messages].reverse().find((m) => m.role === 'assistant');

  const handleInsert = () => {
    const lastAssistantMessage = getLastAssistantMessage();
    if (lastAssistantMessage && onInsert) {
      onInsert(stripAssistantThinking(lastAssistantMessage.content));
    }
  };

  const handleCaptureSourceNote = () => {
    const lastAssistantMessage = getLastAssistantMessage();
    if (lastAssistantMessage && onCaptureSourceNote) {
      onCaptureSourceNote(stripAssistantThinking(lastAssistantMessage.content));
    }
  };

  return (
    <div className={styles.container}>
      {showContextPreview && selectedText && (
        <div className={styles.contextCard}>
          <div className={styles.contextHeader}>
            <div className={styles.contextTitle}>Selected text</div>
            <div className={styles.contextHint}>Used as reference for your prompt</div>
          </div>
          <p className={styles.contextText}>{selectedTextPreview}</p>
        </div>
      )}
      {(aiConfig?.promptTools?.filter((tool) => tool.enabled).length ?? 0) > 0 && (
        <div className={styles.toolsBar}>
          <div className={styles.toolsHeading}>Prompt Tools</div>
          <div className={styles.toolsList}>
            {aiConfig?.promptTools
              ?.filter((tool) => tool.enabled)
              .map((tool) => (
                <label key={tool.id} className={styles.toolChip}>
                  <input
                    type='checkbox'
                    checked={selectedToolIds.includes(tool.id)}
                    onChange={(e) =>
                      setSelectedToolIds((prev) =>
                        e.target.checked
                          ? [...new Set([...prev, tool.id])]
                          : prev.filter((id) => id !== tool.id)
                      )
                    }
                  />
                  <span>{tool.name}</span>
                </label>
              ))}
          </div>
        </div>
      )}
      {providerError && (
        <div className={styles.notice}>
          <p>{providerError}</p>
        </div>
      )}
      <div
        className={styles.messages}
        ref={messagesRef}
        onMouseUp={handleAssistantSelectionChange}
        onKeyUp={handleAssistantSelectionChange}
      >
        {messages.map((msg, i) => (
          <div key={i} className={styles[msg.role]}>
            <div className={styles.messageContent}>{msg.content}</div>
            {msg.role === 'assistant' && msg.contextSources?.length ? (
              <details className={styles.contextSources}>
                <summary>Sources used</summary>
                <ul>
                  {msg.contextSources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder='Ask for help expanding, rewriting, or creating content...'
          disabled={isStreaming || contextStatus !== 'ready'}
          aria-describedby={contextStatusId}
        />
        <div id={contextStatusId} className={styles.contextStatus} role='status'>
          {contextStatus === 'loading'
            ? 'Loading project context…'
            : contextStatus === 'error'
              ? 'Project context unavailable. Reopen this assistant or rebuild context.'
              : 'Project context ready.'}
        </div>
        <div className={styles.actions}>
          <button
            onClick={handleSend}
            disabled={isStreaming || contextStatus !== 'ready' || !input.trim()}
          >
            Send
          </button>
          {onInsert && (
            <button onClick={handleInsert} disabled={isStreaming}>
              Preview scene revision
            </button>
          )}
          {onCaptureSourceNote && (
            <button onClick={handleCaptureSourceNote} disabled={isStreaming}>
              Save as Source Note
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
