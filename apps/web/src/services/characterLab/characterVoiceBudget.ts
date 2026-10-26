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

type Ref = {context: number; section: number; item: number | 'notice' | null};

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
        // The header and worst-case omission note are their own highest-priority item, so the
        // explanatory text is paid for before any individual fact is admitted.
        items.push({
          value: {context: contextIndex, section: sectionIndex, item: 'notice'},
          section: 'accepted-facts',
          text: `${header}(${section.items.length} more accepted facts left out to fit the model's context.)\n`,
          relevance: Number.POSITIVE_INFINITY
        });
        section.items.forEach((item, itemIndex) =>
          items.push({
            value: {context: contextIndex, section: sectionIndex, item: itemIndex},
            section: 'accepted-facts',
            text: `${item.text}\n`,
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
  const keptFactNotices = new Set<string>();
  const keptItems = new Map<string, Set<number>>();
  fit.kept.forEach(({value}) => {
    const key = `${value.context}:${value.section}`;
    if (value.item === null) keptWhole.add(key);
    else if (value.item === 'notice') keptFactNotices.add(key);
    else keptItems.set(key, (keptItems.get(key) ?? new Set()).add(value.item));
  });

  const fitted = contexts.map((context, contextIndex) => ({
    ...context,
    sections: context.sections.flatMap((section, sectionIndex): CharacterVoiceSection[] => {
      const key = `${contextIndex}:${sectionIndex}`;
      if (section.kind === 'accepted-facts' && section.items && section.items.length > 0) {
        if (!keptFactNotices.has(key)) return [];
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

  const omitted = fit.dropped.flatMap(({value, tokens}) => {
    const section = contexts[value.context]!.sections[value.section]!;
    if (value.item === 'notice') return [];
    return [{
      source: section.source,
      detail: value.item === null ? '' : section.items![value.item]!.text.replace(/^- /, ''),
      tokens
    }];
  });
  fit.kept.forEach(({value, tokens}) => {
    if (typeof value.item !== 'number' || keptFactNotices.has(`${value.context}:${value.section}`)) return;
    const section = contexts[value.context]!.sections[value.section]!;
    const item = section.items![value.item]!;
    omitted.push({source: section.source, detail: item.text.replace(/^- /, ''), tokens});
  });
  const usedTokens = fitted.reduce(
    (total, context) =>
      total +
      context.sections.reduce(
        (contextTotal, section) =>
          contextTotal + estimateTextTokens(`[Source: ${section.source}]\n${section.content}\n\n`),
        0
      ),
    0
  );
  return {contexts: fitted, omitted, budgetTokens: Math.max(0, Math.floor(budgetTokens)), usedTokens};
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
