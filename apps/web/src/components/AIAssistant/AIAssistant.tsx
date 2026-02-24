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
import type {ProjectAISettings} from '../../entityTypes';

interface AIAssistantProps {
  projectId: string;
  aiConfig?: ProjectAISettings;
  context?: {
    type: 'document' | 'rule' | 'character';
    id: string;
    selectedText?: string;
  };
  onInsert?: (text: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  projectId,
  aiConfig,
  context,
  onInsert
}) => {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [memoryCache, setMemoryCache] = useState<MemoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const llmService = useRef<LLMService | null>(null);
  const ragService = useRef<RAGProvider | null>(null);
  const shodhService = useRef<ShodhMemoryProvider | null>(null);

  const promptManager = useRef(new PromptManager());


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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

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

  const handleSend = async () => {
    if (!input.trim()) return;
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

    const userMessage: LLMMessage = {role: 'user', content: input};
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      // Get relevant context from RAG
      const [ragResults, shodhChunks] = await Promise.all([
        ragService.current ? ragService.current.search(input, 3) : [],
        buildMemoryChunks(input)
      ]);

      const ragChunks = ragResults.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.documentTitle,
        relevance: r.score
      }));
      const contextChunks = [...shodhChunks, ...ragChunks];

      // Add selected text context if available
      if (context?.selectedText) {
        contextChunks.unshift({
          content: context.selectedText,
          source: 'Selected text',
          relevance: 1.0
        });
      }

      const basePrompt = await promptManager.current.getPrompt(context?.type || 'document');


      // Stream response
      let assistantMessage = '';
      setMessages((prev) => [...prev, {role: 'assistant', content: ''}]);

      for await (const chunk of llmService.current.stream({
        messages: [userMessage],
        context: contextChunks,
        systemPrompt: basePrompt
      })) {
        assistantMessage += chunk;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {role: 'assistant', content: assistantMessage}
        ]);
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
  };

  const handleInsert = () => {
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (lastAssistantMessage && onInsert) {
      onInsert(lastAssistantMessage.content);
    }
  };

  return (
    <div className={styles.container}>
      {providerError && (
        <div className={styles.notice}>
          <p>{providerError}</p>
        </div>
      )}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={styles[msg.role]}>
            <div className={styles.messageContent}>{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
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
