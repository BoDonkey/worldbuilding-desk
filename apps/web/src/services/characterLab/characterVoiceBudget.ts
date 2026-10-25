import {
  buildPromptBreakdown,
  contextBudgetTokens,
  estimateTextTokens,
  fitContextToBudget,
  messageTokens,
  type PromptBreakdown,
  type BudgetItem,
  type ContextSectionKind
} from '../llm/contextBudget';
import {type CharacterVoiceContext, type CharacterVoiceSection} from './characterVoiceContext';

/** What the budget left out, for the author to see. */
export interface OmittedContext {
  /** The section's source label, as shown to the model. */
  source: string;
  /** The fact line when single facts were left out; empty for a whole section. */
  detail: string;
  tokens: number;
}

export interface FittedVoiceContexts {
  contexts: CharacterVoiceContext[];
  omitted: OmittedContext[];
  budgetTokens: number;
  usedTokens: number;
}

type Ref = {context: number; section: number; item: number | null};

const SECTION_FOR_KIND: Record<CharacterVoiceSection['kind'], ContextSectionKind> = {
  'canon-record': 'canon-record',
  'accepted-facts': 'accepted-facts',
  'dialogue-style': 'dialogue-style',
  'story-state': 'story-state',
  'linked-record': 'linked-record'
};

/**
 * Fits the grounding of one or more characters into the context budget
 * (Slice 4.71). Accepted facts are weighed one at a time; every other section
 * is kept or left out whole. Characters share the budget, earlier characters
 * first within the same priority, so the point-of-view character goes first.
 */
export function fitCharacterVoiceContexts(contexts: CharacterVoiceContext[], budgetTokens: number): FittedVoiceContexts {
  const items: BudgetItem<Ref>[] = [];
  contexts.forEach((context, contextIndex) => {
    context.sections.forEach((section, sectionIndex) => {
      const header = `[Source: ${section.source}]\n`;
      if (section.kind === 'accepted-facts' && section.items && section.items.length > 0) {
        // The section header is counted with the first fact.
        section.items.forEach((item, itemIndex) =>
          items.push({
            value: {context: contextIndex, section: sectionIndex, item: itemIndex},
            section: 'accepted-facts',
            text: `${itemIndex === 0 ? header : ''}${item.text}\n`,
            relevance: item.rank
          })
        );
      } else {
        items.push({
          value: {context: contextIndex, section: sectionIndex, item: null},
          section: SECTION_FOR_KIND[section.kind],
          text: `${header}${section.content}\n\n`
        });
      }
    });
  });

  const fit = fitContextToBudget(items, budgetTokens);
  const keptWhole = new Set<string>();
  const keptItems = new Map<string, Set<number>>();
  fit.kept.forEach(({value}) => {
    const key = `${value.context}:${value.section}`;
    if (value.item === null) keptWhole.add(key);
    else keptItems.set(key, (keptItems.get(key) ?? new Set()).add(value.item));
  });

  const fitted = contexts.map((context, contextIndex) => ({
    ...context,
    sections: context.sections.flatMap((section, sectionIndex): CharacterVoiceSection[] => {
      const key = `${contextIndex}:${sectionIndex}`;
      if (section.kind === 'accepted-facts' && section.items && section.items.length > 0) {
        const kept = section.items.filter((_, index) => keptItems.get(key)?.has(index));
        const left = section.items.length - kept.length;
        // Tell the model facts exist that it was not given, so it does not settle them itself.
        const note = `(${left} ${kept.length > 0 ? 'more ' : ''}accepted ${left === 1 ? 'fact' : 'facts'} left out to fit the model's context.)`;
        return [
          {
            ...section,
            content: [...kept.map((item) => item.text), ...(left > 0 ? [note] : [])].join('\n'),
            provenance: kept.map((item) => item.provenance),
            items: kept
          }
        ];
      }
      return keptWhole.has(key) ? [section] : [];
    })
  }));

  const omitted = fit.dropped.map(({value, tokens}) => {
    const section = contexts[value.context]!.sections[value.section]!;
    return {
      source: section.source,
      detail: value.item === null ? '' : section.items![value.item]!.text.replace(/^- /, ''),
      tokens
    };
  });
  return {contexts: fitted, omitted, budgetTokens: fit.budgetTokens, usedTokens: fit.usedTokens};
}

/**
 * Builds a prompt whose character grounding fits the model's context. The
 * prompt is built once with the grounding emptied to measure what is sent
 * regardless (instructions, the conversation), and once with what fits.
 * Without a known context size nothing is left out.
 */
export function buildBudgetedVoicePrompt<P extends {systemPrompt: string; messages: ReadonlyArray<{content: string}>}>(params: {
  contexts: CharacterVoiceContext[];
  contextTokens: number | null;
  replyTokens?: number;
  build: (contexts: CharacterVoiceContext[]) => P;
}): {prompt: P; fit: FittedVoiceContexts | null; breakdown: PromptBreakdown} {
  const bare = params.build(params.contexts.map((context) => ({...context, sections: []})));
  const fit =
    params.contextTokens === null
      ? null
      : fitCharacterVoiceContexts(
          params.contexts,
          contextBudgetTokens({
            contextTokens: params.contextTokens,
            fixedTokens: estimateTextTokens(bare.systemPrompt) + 8 + messageTokens(bare.messages),
            replyTokens: params.replyTokens
          })
        );
  const sent = fit?.contexts ?? params.contexts;
  const prompt = params.build(sent);
  // Instructions are the prompt without any grounding; the sections are counted as sent.
  const breakdown = buildPromptBreakdown({
    instructions: bare.systemPrompt,
    messages: prompt.messages,
    sections: sent.flatMap((context) => context.sections)
  });
  return {prompt, fit, breakdown};
}
