import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {
  contextSourceRefKey,
  resolveContextSourceRefs,
  type AssistantContextSourceRef
} from '../../services/assistant/contextSources';
import {sectionTokenLabel, type PromptBreakdown} from '../../services/llm/contextBudget';
import type {ModelContextSize} from '../../services/llm/modelContextSize';
import {PromptTokenSummary} from '../common/PromptTokenSummary';
import styles from '../../assets/components/AIAssistant.module.css';

interface AssistantContextSourcesProps {
  projectId: string;
  sources?: string[];
  sourceRefs?: AssistantContextSourceRef[];
  leftOutSources?: string[];
  promptBreakdown?: PromptBreakdown;
  modelContext?: ModelContextSize | null;
}

/**
 * The context one reply used (Slice 5.17). Each source card can be dismissed;
 * a card offers Open only when its Source Note or World Bible record still
 * exists in this project, so no card implies a link it cannot follow.
 * Dismissing hides the card here; the stored reply is unchanged.
 */
export function AssistantContextSources({
  projectId,
  sources = [],
  sourceRefs = [],
  leftOutSources = [],
  promptBreakdown,
  modelContext = null
}: AssistantContextSourcesProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [resolved, setResolved] = useState<ReadonlySet<string>>(() => new Set());
  const refsKey = sourceRefs.map(contextSourceRefKey).join('|');

  useEffect(() => {
    if (!refsKey) return;
    let cancelled = false;
    resolveContextSourceRefs(projectId, sourceRefs)
      .then((keys) => {
        if (!cancelled) setResolved(keys);
      })
      .catch((error) => console.warn('Unable to resolve assistant context sources.', error));
    return () => {
      cancelled = true;
    };
    // refsKey stands for sourceRefs, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, refsKey]);

  const refFor = (source: string) => {
    const ref = sourceRefs.find((candidate) => candidate.source === source);
    return ref && resolved.has(contextSourceRefKey(ref)) ? ref : null;
  };
  const open = (ref: AssistantContextSourceRef) =>
    ref.kind === 'source-note'
      ? navigate('/lore', {state: {focusLoreDocumentId: ref.id}})
      : navigate('/world-bible', {state: {focusEntityId: ref.id}});
  const dismiss = (key: string) => setDismissed((prev) => new Set(prev).add(key));

  const card = (source: string, key: string, detail?: string | null) => {
    const ref = refFor(source);
    return (
      <li key={key} className={styles.contextSourceCard}>
        <span className={styles.contextSourceLabel}>
          {source} {detail ? <small>{detail}</small> : null}
        </span>
        {ref && (
          <button type='button' onClick={() => open(ref)} aria-label={`Open ${source}`}>
            Open
          </button>
        )}
        <button type='button' onClick={() => dismiss(key)} aria-label={`Dismiss ${source}`}>
          Dismiss
        </button>
      </li>
    );
  };

  const used = sources.filter((source) => !dismissed.has(`used:${source}`));
  const leftOut = leftOutSources.filter((source) => !dismissed.has(`left-out:${source}`));
  return (
    <>
      {used.length > 0 && (
        <details className={styles.contextSources}>
          <summary>Sources used</summary>
          <ul>
            {used.map((source) => card(source, `used:${source}`, sectionTokenLabel(promptBreakdown, source)))}
          </ul>
          {promptBreakdown && <PromptTokenSummary breakdown={promptBreakdown} size={modelContext} />}
        </details>
      )}
      {leftOut.length > 0 && (
        <details className={styles.contextSources}>
          <summary>Left out to fit the model’s context</summary>
          <ul>{leftOut.map((source) => card(source, `left-out:${source}`))}</ul>
        </details>
      )}
    </>
  );
}
