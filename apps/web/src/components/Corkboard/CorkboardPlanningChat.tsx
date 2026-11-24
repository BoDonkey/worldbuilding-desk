import {useState} from 'react';
import type {ChapterCard, ProjectAISettings, WritingDocument} from '../../entityTypes';
import {useCorkboardPlanningChat} from '../../hooks/useCorkboardPlanningChat';
import {
  useCorkboardPlanningProposals,
  type CorkboardProposalActions
} from '../../hooks/useCorkboardPlanningProposals';
import {PLANNING_LIMITS, PLANNING_SCOPE_LABELS, type PlanningChatScope} from '../../services/corkboard/planningChat';
import {OFF_COACHING_NOTE, readAISwitches} from '../../services/llm/aiSwitches';
import {AssistantContextSources} from '../AIAssistant/AssistantContextSources';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {CorkboardPlanningProposals} from './CorkboardPlanningProposals';
import corkboardStyles from '../../styles/CorkboardRoute.module.css';
import styles from './CorkboardPlanningChat.module.css';

const SCOPES: PlanningChatScope[] = ['board', 'card'];

interface CorkboardPlanningChatProps {
  projectId: string;
  aiConfig: ProjectAISettings | undefined;
  cards: ChapterCard[];
  documents: WritingDocument[];
  /** The card selected on the board; This card is about it. */
  selectedCard: ChapterCard | null;
  /** The Corkboard's own actions; only an accepted proposal calls them. */
  actions: CorkboardProposalActions;
}

/**
 * Talk through the outline (Slice 4.85). Replies are conversation only. Propose
 * changes on a reply (4.86) turns it into outline edits that change the board
 * only when the author confirms each one; nothing here touches canon or prose.
 */
export function CorkboardPlanningChat({projectId, aiConfig, cards, documents, selectedCard, actions}: CorkboardPlanningChatProps) {
  const chat = useCorkboardPlanningChat({projectId, aiConfig, cards, documents});
  const {policy, scope, messages} = chat;
  const proposals = useCorkboardPlanningProposals({projectId, aiConfig, cards, documents, policy, actions});
  const isProposing = Object.values(proposals.batches).some((batch) => batch.status === 'loading');
  const isSending = chat.isSending || isProposing;
  const [input, setInput] = useState('');
  const coachingOn = readAISwitches(aiConfig).coaching;
  const cardTitle = selectedCard?.title.trim() || 'Untitled chapter';
  const scopeReady = scope === 'board' ? cards.length > 0 : Boolean(selectedCard);
  const canSend = coachingOn && !policy.providerIssue && scopeReady && !isSending && Boolean(input.trim());

  const submit = () => {
    if (!canSend) return;
    const prompt = input;
    setInput('');
    void chat.send(prompt, selectedCard?.id ?? null);
  };

  return (
    <section className={`${corkboardStyles.panel} ${styles.chat}`} aria-labelledby='corkboard-planning-chat'>
      <div className={corkboardStyles.panelHeader}>
        <div>
          <span className={corkboardStyles.derivedEyebrow}>Author-triggered, model-assisted, author-approved</span>
          <h2 id='corkboard-planning-chat' className={corkboardStyles.panelTitle}>Planning chat</h2>
        </div>
        {messages.length > 0 && (
          <button
            type='button'
            onClick={() => {
              chat.clear();
              proposals.clear();
            }}
            disabled={isSending}
          >
            Clear conversation
          </button>
        )}
      </div>

      {!coachingOn ? (
        <p className={corkboardStyles.emptyState}>{OFF_COACHING_NOTE}</p>
      ) : (
        <>
          <p className={styles.hint}>
            Talk through the chapter arc or plan a scene. Replies are suggestions only. Propose changes
            turns a reply into edits to the board, and nothing changes until you confirm each one. The
            World Bible and your manuscript text never change from this chat.
          </p>

          <fieldset className={styles.scope}>
            <legend>Ask about</legend>
            {SCOPES.map((option) => (
              <label key={option} className={styles.scopeOption}>
                <input
                  type='radio'
                  name='planning-chat-scope'
                  value={option}
                  checked={scope === option}
                  onChange={() => chat.setScope(option)}
                  disabled={isSending}
                />
                {option === 'card' && selectedCard
                  ? `${PLANNING_SCOPE_LABELS.card}: ${cardTitle}`
                  : PLANNING_SCOPE_LABELS[option]}
              </label>
            ))}
            <label className={styles.scopeOption}>
              <input
                type='checkbox'
                checked={chat.includeSceneExcerpts}
                onChange={(event) => chat.setIncludeSceneExcerpts(event.target.checked)}
                disabled={isSending}
              />
              Include the opening of each linked scene (up to {PLANNING_LIMITS.excerptChars} characters each)
            </label>
          </fieldset>

          {messages.length > 0 && (
            <ol className={styles.messages} aria-label='Planning conversation' aria-live='polite'>
              {messages.map((message, index) => (
                <li
                  key={index}
                  className={message.role === 'user' ? styles.userMessage : styles.replyMessage}
                >
                  <span className={styles.speaker}>{message.role === 'user' ? 'You' : 'Planning chat'}</span>
                  <div className={styles.messageText}>
                    {message.content || (chat.isSending && index === messages.length - 1 ? '…' : '')}
                  </div>
                  {message.role === 'assistant' && (message.contextSources?.length ?? 0) > 0 && (
                    <AssistantContextSources
                      projectId={projectId}
                      sources={message.contextSources}
                      sourceRefs={message.contextSourceRefs}
                      leftOutSources={message.leftOutSources}
                      promptBreakdown={message.promptBreakdown}
                      modelContext={message.modelContext}
                    />
                  )}
                  {message.role === 'assistant' && message.content.trim() && (
                    proposals.batches[index] ? (
                      <CorkboardPlanningProposals
                        batch={proposals.batches[index]}
                        cards={cards}
                        onAccept={(proposal) => proposals.accept(index, proposal)}
                        onDismiss={(proposalId) => proposals.dismiss(index, proposalId)}
                      />
                    ) : !(chat.isSending && !isProposing && index === messages.length - 1) && (
                      <div className={corkboardStyles.actionRow}>
                        <button
                          type='button'
                          onClick={() => {
                            const previous = messages[index - 1];
                            void proposals.propose(index, message.content, previous?.role === 'user' ? previous.content : null);
                          }}
                          disabled={isSending || Boolean(policy.providerIssue)}
                        >
                          Propose changes
                        </button>
                      </div>
                    )
                  )}
                </li>
              ))}
            </ol>
          )}

          <ModelRunProgress run={policy.modelRun} />

          {policy.providerIssue ? (
            <p className={corkboardStyles.coachError} role='alert'>{policy.providerIssue}</p>
          ) : (
            <form className={styles.form} onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}>
              <label className={corkboardStyles.field}>
                Message
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={scope === 'board'
                    ? 'Where does the middle of the book sag? What does chapter 3 set up?'
                    : 'What scenes does this chapter need? Does it earn its ending?'}
                  rows={3}
                />
              </label>
              <div className={corkboardStyles.actionRow}>
                <button type='submit' disabled={!canSend}>{isSending ? 'Thinking…' : 'Send'}</button>
                {!scopeReady && (
                  <span className={styles.hint}>
                    {scope === 'board' ? 'Add a chapter card first.' : 'Select a chapter card first.'}
                  </span>
                )}
              </div>
              {policy.disclosure && <p className={styles.hint}>{policy.disclosure}</p>}
              {messages.some((message) => message.role === 'assistant') && proposals.disclosure && proposals.disclosure !== policy.disclosure && (
                <p className={styles.hint}>Propose changes: {proposals.disclosure}</p>
              )}
            </form>
          )}

          <ConsultationBudgetNotice
            status={policy.budget.status}
            isLocal={policy.budget.isLocal}
            onGrantMore={policy.budget.grantMore}
            hidden={Boolean(policy.providerIssue)}
          />
        </>
      )}
    </section>
  );
}
