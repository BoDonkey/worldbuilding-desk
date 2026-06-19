import React, {useState, useRef, useEffect, useCallback} from 'react';
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
import type {LLMMessage} from '../../services/llm/types';
import {PromptManager} from '../../services/prompts/PromptManager';
import type {ProjectAISettings, PromptTool, ProjectMode} from '../../entityTypes';

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
  onAssistantSelectionChange?: (text: string) => void;
  queuedPrompt?: string | null;
  onQueuedPromptConsumed?: () => void;
  consultationModel?: string;
  consultationMaxTokens?: number;
  showContextPreview?: boolean;
}

export const stripAssistantThinking = (content: string): string =>
  content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trimStart();

export const AIAssistant: React.FC<AIAssistantProps> = ({
  projectId,
  aiConfig,
  projectMode = 'litrpg',
  context,
  onInsert,
  onAssistantSelectionChange,
  queuedPrompt,
  onQueuedPromptConsumed,
  consultationModel,
  consultationMaxTokens,
  showContextPreview = true
}) => {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [memoryCache, setMemoryCache] = useState<MemoryEntry[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
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
  }, [projectId]);

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
    Promise.all([getRAGService(projectId), getShodhService(projectId)]).then(
      ([rag, shodh]) => {
        if (!cancelled) {
          ragService.current = rag;
          shodhService.current = shodh;
          void syncMemoryCache();
        }
      }
    );

    return () => {
      cancelled = true;
      ragService.current = null;
      shodhService.current = null;
    };
  }, [projectId, syncMemoryCache]);

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
      const normalizedQuery = query.trim().toLowerCase();
      const queryMatches =
        normalizedQuery.length > 2
          ? allMemories.filter((memory) => {
              if (memory.documentId === context?.id) return false;
              const haystack = `${memory.title} ${memory.summary} ${
                memory.tags?.join(' ') ?? ''
              }`.toLowerCase();
              return haystack.includes(normalizedQuery);
            })
          : [];

      const ordered: MemoryEntry[] = [];
      const seen = new Set<string>();
      const pushUnique = (memory: MemoryEntry) => {
        if (seen.has(memory.id)) return;
        seen.add(memory.id);
        ordered.push(memory);
      };

      docMatches.forEach(pushUnique);
      queryMatches.forEach(pushUnique);
      allMemories
        .filter((memory) => !seen.has(memory.id))
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach(pushUnique);

      return ordered.slice(0, 3).map((memory) => ({
        content: memory.summary,
        source: `${memory.title || 'Memory'} (${
          memory.projectId === projectId ? 'Local' : 'Parent'
        } Shodh)`,
        relevance: memory.documentId === context?.id ? 1 : 0.85
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

    const selectedTextInstruction = selectedText
      ? 'The author has highlighted text in the editor. The selected text is available as reference context below. Use it when the author asks about the selection or uses phrases like "this", "these", "it", "them", "the characters", or "the locations". Do not assume the author wants expansion; answer the task they ask for.'
      : '';
    const displayedUserMessage: LLMMessage = {role: 'user', content: promptText};
    const requestUserMessage: LLMMessage = {
      role: 'user',
      content: selectedTextInstruction
        ? `${selectedTextInstruction}\n\nSelected text:\n"""\n${selectedText}\n"""\n\nAuthor request: ${promptText}`
        : promptText
    };
    setMessages((prev) => [...prev, displayedUserMessage]);
    setInput('');
    setIsStreaming(true);
    scrollMessagesToBottom();

    try {
      // Get relevant context from RAG
      const [ragResults, shodhChunks] = await Promise.all([
        ragService.current ? ragService.current.search(promptText, 3) : [],
        buildMemoryChunks(promptText)
      ]);

      const ragChunks = ragResults.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.documentTitle,
        relevance: r.score
      }));
      const contextChunks = [...shodhChunks, ...ragChunks];

      // Add selected text context if available
      if (selectedText) {
        contextChunks.unshift({
          content: selectedText,
          source: 'Selected text',
          relevance: 1.0
        });
      }

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
      const composedPrompt = `${basePrompt}${toolPrompt}`;


      // Stream response
      let rawAssistantMessage = '';
      setMessages((prev) => [...prev, {role: 'assistant', content: ''}]);
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
          {role: 'assistant', content: assistantMessage}
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
    context?.id,
    context?.type,
    projectId,
    providerError,
    scrollMessagesToBottom,
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
    if (consumedQueuedPromptRef.current === next) return;
    consumedQueuedPromptRef.current = next;
    void handleSendPrompt(next).finally(() => {
      onQueuedPromptConsumed?.();
    });
  }, [queuedPrompt, handleSendPrompt, isStreaming, onQueuedPromptConsumed]);

  const handleInsert = () => {
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (lastAssistantMessage && onInsert) {
      onInsert(stripAssistantThinking(lastAssistantMessage.content));
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
          disabled={isStreaming}
        />
        <div className={styles.actions}>
          <button onClick={handleSend} disabled={isStreaming || !input.trim()}>
            Send
          </button>
          {onInsert && (
            <button onClick={handleInsert} disabled={isStreaming}>
              Insert
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
