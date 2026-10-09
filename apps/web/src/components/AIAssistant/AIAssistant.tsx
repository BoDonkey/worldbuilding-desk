import React, {useState, useRef, useEffect, useCallback, useId} from 'react';
import {Link} from 'react-router';
import styles from '../../assets/components/AIAssistant.module.css';
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
import type {LoreFactProposal, ProjectAISettings, PromptTool, ProjectMode, WritingDocument} from '../../entityTypes';
import {
  PENDING_PROPOSAL_INSTRUCTION,
  appendPendingProposalNote,
  buildPendingProposalChunks,
  findPendingProposalsForQuestion
} from '../../services/assistant/pendingProposalContext';
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
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {resolveResponseTokenLimit} from '../../services/llm/modelRun';
import {getCraftLibraryService} from '../../services/craft/getCraftLibraryService';
import {
  buildCraftContextChunks,
  buildCraftLibrarySearchQuery,
  buildWritingCoachPrompt,
  dedupeCraftCitations,
  type WritingCoachScope
} from '../../services/coach/writingCoachConsultation';
import {CraftCitationList} from '../CraftCitationList';
import {describeError} from '../../services/errors';
import {useStatusAnnouncement} from '../../hooks/useStatusAnnouncement';
import {
  filterCanonFactResultsForScene,
  isCanonFactMemoryValidAtScene
} from '../../services/lore/canonicalFactValidity';
import {buildAITextProvenance, type AITextProvenance} from '../../services/editor/aiTextProvenance';
import {useAssistantRequestPolicy} from '../../hooks/useAssistantRequestPolicy';

interface AIAssistantProps {
  projectId: string;
  aiConfig?: ProjectAISettings;
  projectMode?: ProjectMode;
  context?: {
    type: 'document' | 'rule' | 'rules' | 'character' | 'world-bible';
    id: string;
    selectedText?: string;
  };
  /** `provenance` is present only when the inserted text was written by a model. */
  onInsert?: (text: string, provenance?: AITextProvenance) => void;
  onCaptureSourceNote?: (text: string) => void;
  /** Full text of the currently open scene, used only as writing-coach evidence when nothing
   * is selected. Never sent to the ordinary project assistant prompt. */
  sceneText?: string;
  onAssistantSelectionChange?: (text: string) => void;
  queuedPrompt?: string | null;
  onQueuedPromptConsumed?: () => void;
  consultationModel?: string;
  consultationMaxTokens?: number;
  showContextPreview?: boolean;
  parentProjectId?: string;
  inheritRag?: boolean;
  inheritShodh?: boolean;
  /** Separate conversation history for this surface (the Workspace drawer leaves it unset). */
  conversationScope?: string;
  /**
   * Present only when the author asked to discuss pending proposals (1.4). The
   * model sees them labeled "Pending proposal, not canon"; deterministic answers
   * stay accepted-canon only and list matching proposals separately.
   */
  pendingProposals?: {proposals: LoreFactProposal[]; sourceTitleById: Map<string, string>} | null;
  placeholder?: string;
  /**
   * When set, nothing is sent and this explains why (for example, pending
   * proposals the author asked to include are still loading). The typed
   * question is kept.
   */
  sendBlockedReason?: string | null;
  /** The writing coach needs a scene or selection; surfaces without one hide it. */
  showWritingCoach?: boolean;
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
  sceneText,
  onAssistantSelectionChange,
  queuedPrompt,
  onQueuedPromptConsumed,
  consultationModel,
  consultationMaxTokens,
  showContextPreview = true,
  parentProjectId,
  inheritRag = false,
  inheritShodh = false,
  conversationScope,
  pendingProposals = null,
  placeholder = 'Ask for help expanding, rewriting, or creating content...',
  sendBlockedReason = null,
  showWritingCoach = true
}) => {
  const [messages, setMessages] = useAssistantConversation(projectId, conversationScope);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const aiProvider = aiConfig?.provider;
  const requestPolicy = useAssistantRequestPolicy({
    projectId,
    aiConfig,
    sentMaterial: 'your request and the selected project context'
  });
  const {budget, modelRun, providerIssue, disclosure, run: runModelRequest} = requestPolicy;
  const modelReplyProvenance = useCallback(
    (modelOverride?: string): AITextProvenance => {
      const provenance = buildAITextProvenance('scene-revision', aiConfig, budget.route);
      const model = modelOverride?.trim();
      return model ? {...provenance, model} : provenance;
    },
    [aiConfig, budget.route]
  );
  const announceStatus = useStatusAnnouncement();
  const [memoryCache, setMemoryCache] = useState<MemoryEntry[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [contextStatus, setContextStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const contextStatusId = useId();
  const messagesRef = useRef<HTMLDivElement>(null);

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
      console.warn('Failed to load project memory', error);
    }
  }, []);

  useEffect(() => {
    promptManager.current.init();
  }, []);

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
    async (query: string, orderedScenes: WritingDocument[]) => {
      let allMemories = memoryCache;
      if (allMemories.length === 0 && shodhService.current) {
        allMemories = await shodhService.current.listMemories();
        setMemoryCache(allMemories);
      }
      if (allMemories.length === 0) {
        return [];
      }
      allMemories = allMemories.filter((memory) =>
        isCanonFactMemoryValidAtScene(memory.tags, context?.type === 'document' ? context.id : undefined, orderedScenes)
      );

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
        source: `${getShodhTrustLabel(memory.tags)} - ${memory.title || 'Memory'} (${
          memory.projectId === projectId ? 'Local' : 'Parent'
        })`,
        relevance:
          memory.documentId === context?.id
            ? 1
            : queryMatches.find((entry) => entry.memory.id === memory.id)?.relevance ?? 0
      }));
    },
    [context?.id, context?.type, memoryCache, projectId]
  );

  const handleSendPrompt = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    if (sendBlockedReason) return;
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
    announceStatus('Assistant is responding.');
    scrollMessagesToBottom();

    try {
      // Get relevant indexed context
      const groundingRequired = requiresProjectGrounding(
        promptText,
        Boolean(selectedText)
      );
      const needsOrderedScenes =
        Boolean(getTemporalCustodySubject(promptText)) ||
        groundingRequired ||
        context?.type === 'document';
      const orderedScenes = needsOrderedScenes
        ? await getDocumentsByProject(projectId).catch((error) => {
            console.warn('Unable to load ordered saved scenes for grounding.', error);
            return [];
          })
        : [];
      const [unfilteredRagResults, shodhChunks] = await Promise.all([
        ragService.current
          ? ragService.current.search(promptText, groundingRequired ? 20 : 3)
          : [],
        buildMemoryChunks(promptText, orderedScenes)
      ]);
      const ragResults = filterCanonFactResultsForScene(
        unfilteredRagResults,
        context?.type === 'document' ? context.id : undefined,
        orderedScenes
      );

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
            content: pendingProposals
              ? appendPendingProposalNote(
                  directSavedFact.content,
                  findPendingProposalsForQuestion(promptText, pendingProposals.proposals)
                )
              : directSavedFact.content,
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
            content: pendingProposals
              ? appendPendingProposalNote(
                  unverified.content,
                  findPendingProposalsForQuestion(promptText, pendingProposals.proposals)
                )
              : unverified.content,
            contextSources: getContextSourceSummaries(reviewedChunks)
          }
        ]);
        scrollMessagesToBottom();
        return;
      }

      const ragChunks = await buildRagContextChunks(projectId, ragResults.slice(0, 3));
      const pendingChunks = pendingProposals
        ? buildPendingProposalChunks(pendingProposals.proposals, pendingProposals.sourceTitleById)
        : [];
      const contextChunks = [...shodhChunks, ...ragChunks, ...pendingChunks];

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
      const composedPrompt = appendContextTrustInstructions(
        `${basePrompt}${toolPrompt}${pendingChunks.length > 0 ? `\n\n${PENDING_PROPOSAL_INSTRUCTION}` : ''}`
      );


      // Stream response
      // Stamped at generation time, so an insert later records the model that wrote it.
      const replyProvenance = modelReplyProvenance(consultationModel);
      setMessages((prev) => [
        ...prev,
        {role: 'assistant', content: '', contextSources, provenance: replyProvenance}
      ]);
      scrollMessagesToBottom();

      const outcome = await runModelRequest({
        feature: 'assistant',
        request: {
          messages: [requestUserMessage],
          context: contextChunks,
          systemPrompt: composedPrompt,
          model: consultationModel?.trim() || undefined,
          maxTokens: resolveResponseTokenLimit(aiProvider, consultationMaxTokens)
        },
        failureMessage: 'The assistant could not generate a response.',
        onUpdate: ({answer}) => {
          const assistantMessage = stripAssistantThinking(answer);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              ...(prev[prev.length - 1]?.role === 'assistant'
                ? prev[prev.length - 1]
                : {role: 'assistant' as const, contextSources, provenance: replyProvenance}),
              content: assistantMessage
            }
          ]);
          scrollMessagesToBottom();
        }
      });
      if (!outcome.ok) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...(prev[prev.length - 1]?.role === 'assistant'
              ? prev[prev.length - 1]
              : {role: 'assistant' as const, contextSources, provenance: replyProvenance}),
            content: outcome.message
          }
        ]);
      }
    } catch (error) {
      console.error('AI request failed:', error);
      const message = describeError(error, 'Project context could not be prepared. Try again.', {
        context: 'assistant context'
      });
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant'
          ? [...prev.slice(0, -1), {...last, content: message}]
          : [...prev, {role: 'assistant', content: message}];
      });
    } finally {
      setIsStreaming(false);
      announceStatus('Assistant reply finished.');
    }
  }, [
    aiProvider,
    modelReplyProvenance,
    announceStatus,
    buildMemoryChunks,
    consultationMaxTokens,
    consultationModel,
    context?.id,
    context?.type,
    contextStatus,
    projectId,
    scrollMessagesToBottom,
    setMessages,
    selectedToolIds,
    selectedText,
    aiConfig?.promptTools,
    pendingProposals,
    sendBlockedReason,
    runModelRequest
  ]);

  const handleSend = async () => {
    await handleSendPrompt(input);
  };

  useEffect(() => {
    const next = queuedPrompt?.trim() ?? '';
    if (!next) return;
    if (isStreaming) return;
    if (contextStatus !== 'ready' || sendBlockedReason) return;
    if (consumedQueuedPromptRef.current === next) return;
    consumedQueuedPromptRef.current = next;
    void handleSendPrompt(next).finally(() => {
      onQueuedPromptConsumed?.();
    });
  }, [queuedPrompt, handleSendPrompt, isStreaming, contextStatus, sendBlockedReason, onQueuedPromptConsumed]);

  const getLastAssistantMessage = () =>
    [...messages].reverse().find((m) => m.role === 'assistant');

  const handleInsert = () => {
    const lastAssistantMessage = getLastAssistantMessage();
    if (lastAssistantMessage && onInsert) {
      // App-written replies (answers from accepted canon, notices) carry no provenance and
      // insert unmarked; model replies insert as AI text.
      onInsert(stripAssistantThinking(lastAssistantMessage.content), lastAssistantMessage.provenance);
    }
  };

  const handleCaptureSourceNote = () => {
    const lastAssistantMessage = getLastAssistantMessage();
    if (lastAssistantMessage && onCaptureSourceNote) {
      onCaptureSourceNote(stripAssistantThinking(lastAssistantMessage.content));
    }
  };

  const coachEvidence = selectedText || sceneText?.trim() || '';
  const coachScope: WritingCoachScope = selectedText ? 'selection' : 'scene';
  const coachEvidenceLabel = selectedText ? 'Selected passage' : 'Current scene';
  const inspectorSettings = aiConfig?.inspectorSettings;
  const coachConsultationEnabled = inspectorSettings?.enableAIConsultation !== false;

  const handleAskCoach = useCallback(async () => {
    if (!coachEvidence) return;
    if (!coachConsultationEnabled) {
      setMessages((prev) => [
        ...prev,
        {role: 'assistant', content: 'AI consultation is disabled in Settings.'}
      ]);
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content:
          coachScope === 'selection'
            ? 'Ask the writing coach about the selected passage.'
            : 'Ask the writing coach about the current scene.'
      }
    ]);
    setIsStreaming(true);
    announceStatus('Assistant is responding.');
    scrollMessagesToBottom();

    try {
      const craftLibrary = await getCraftLibraryService();
      const searchQuery = buildCraftLibrarySearchQuery(coachEvidence);
      const craftResults = await craftLibrary.search(searchQuery, 4);
      const craftContext = buildCraftContextChunks(craftResults);
      const craftCitations = dedupeCraftCitations(craftResults);
      const {systemPrompt, userPrompt} = buildWritingCoachPrompt({
        scope: coachScope,
        evidenceLabel: coachEvidenceLabel,
        evidenceText: coachEvidence
      });

      const coachProvenance = modelReplyProvenance();
      setMessages((prev) => [...prev, {role: 'assistant', content: '', craftCitations, provenance: coachProvenance}]);
      scrollMessagesToBottom();

      const outcome = await runModelRequest({
        feature: 'writing-coach',
        request: {
          messages: [{role: 'user', content: userPrompt}],
          context: craftContext,
          systemPrompt,
          model: inspectorSettings?.lowCostModel?.trim() || undefined,
          maxTokens: resolveResponseTokenLimit(aiProvider, inspectorSettings?.maxResponseTokens)
        },
        failureMessage: 'The writing coach could not be reached. Try again.',
        onUpdate: ({answer}) => {
          const assistantMessage = stripAssistantThinking(answer);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              ...(prev[prev.length - 1]?.role === 'assistant'
                ? prev[prev.length - 1]
                : {role: 'assistant' as const, craftCitations, provenance: coachProvenance}),
              content: assistantMessage
            }
          ]);
          scrollMessagesToBottom();
        }
      });
      if (!outcome.ok) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...(prev[prev.length - 1]?.role === 'assistant'
              ? prev[prev.length - 1]
              : {role: 'assistant' as const, craftCitations, provenance: coachProvenance}),
            content: outcome.message
          }
        ]);
      }
    } catch (error) {
      console.error('Writing coach request failed:', error);
      const message = describeError(
        error,
        'The writing coach could not prepare its references. Try again.',
        {context: 'writing coach references'}
      );
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant'
          ? [...prev.slice(0, -1), {...last, content: message}]
          : [...prev, {role: 'assistant', content: message}];
      });
    } finally {
      setIsStreaming(false);
      announceStatus('Assistant reply finished.');
    }
  }, [
    aiProvider,
    modelReplyProvenance,
    runModelRequest,
    announceStatus,
    coachConsultationEnabled,
    coachEvidence,
    coachEvidenceLabel,
    coachScope,
    inspectorSettings?.lowCostModel,
    inspectorSettings?.maxResponseTokens,
    scrollMessagesToBottom,
    setMessages
  ]);

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
      {providerIssue && (
        <div className={styles.notice}>
          <p>
            {providerIssue} <Link to='/settings'>Open Settings</Link>
          </p>
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
            {msg.role === 'assistant' && msg.craftCitations?.length ? (
              <details className={styles.contextSources}>
                <summary>Craft reference material (not your canon)</summary>
                <CraftCitationList citations={msg.craftCitations} />
              </details>
            ) : null}
          </div>
        ))}
      </div>

      <ModelRunProgress run={modelRun} className={styles.runProgress} />

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
          placeholder={placeholder}
          disabled={isStreaming || contextStatus !== 'ready'}
          aria-describedby={contextStatusId}
        />
        <div id={contextStatusId} className={styles.contextStatus} role='status'>
          {contextStatus === 'loading'
            ? 'Loading project context…'
            : contextStatus === 'error'
              ? 'Project context unavailable. Reopen this assistant or rebuild context.'
              : sendBlockedReason ?? 'Project context ready.'}
        </div>
        <div className={styles.actions}>
          <button
            onClick={handleSend}
            disabled={isStreaming || contextStatus !== 'ready' || Boolean(sendBlockedReason) || !input.trim()}
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
          {showWritingCoach && (
            <button
              onClick={() => void handleAskCoach()}
              disabled={isStreaming || contextStatus !== 'ready' || !coachEvidence}
              title={coachEvidence ? undefined : 'Select text or open a scene first'}
            >
              Ask the writing coach
            </button>
          )}
        </div>
        {disclosure && <p className={styles.disclosure}>{disclosure}</p>}
        <ConsultationBudgetNotice
          status={budget.status}
          isLocal={budget.isLocal}
          onGrantMore={budget.grantMore}
          hidden={Boolean(providerIssue)}
        />
      </div>
    </div>
  );
};
