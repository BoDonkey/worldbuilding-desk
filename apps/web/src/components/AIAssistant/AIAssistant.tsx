import React, {useState, useRef, useEffect} from 'react';
import styles from '../../assets/components/AIAssistant.module.css';
import {LLMService} from '../../services/llm/LLMService';
import {RAGService} from '../../services/rag/RAGService';
import type {LLMMessage} from '../../services/llm/types';
import { PromptManager } from '../../services/prompts/PromptManager';

interface AIAssistantProps {
  projectId: string;
  context?: {
    type: 'document' | 'rule' | 'character';
    id: string;
    selectedText?: string;
  };
  onInsert?: (text: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  projectId,
  context,
  onInsert
}) => {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const llmService = useRef<LLMService | null>(null);
  const ragService = useRef<RAGService | null>(null);

  const promptManager = useRef(new PromptManager());


  useEffect(() => {
    promptManager.current.init();
  }, []);

  useEffect(() => {
    // Initialize services
    const apiKey = localStorage.getItem('anthropic_api_key');
    const embeddingKey = localStorage.getItem('openai_api_key');

    if (apiKey) {
      llmService.current = new LLMService(apiKey);
    }

    if (embeddingKey) {
      ragService.current = new RAGService(embeddingKey);
      ragService.current.init(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !llmService.current) return;

    const userMessage: LLMMessage = {role: 'user', content: input};
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      // Get relevant context from RAG
      const ragResults = ragService.current
        ? await ragService.current.search(input, 3)
        : [];

      const contextChunks = ragResults.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.documentTitle,
        relevance: r.score
      }));

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
