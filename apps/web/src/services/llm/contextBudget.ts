/**
 * Context budget (Slice 4.71). Each kind of context gets a share of the room
 * the model's context leaves after the instructions, the conversation, and
 * the reply; what does not fit is left out, lowest priority first, and every
 * item left out is reported so the author can see it.
 */

/** Estimated high on purpose: about three characters per token, one per non-ASCII character. */
export function estimateTextTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) ascii += 1;
    else other += 1;
  }
  return Math.ceil(ascii / 3) + other;
}

/** Highest priority first. */
export const CONTEXT_SECTION_ORDER = [
  'author-selection',
  'canon-record',
  'accepted-facts',
  'dialogue-style',
  'story-state',
  'pending-proposals',
  'linked-source-note',
  'source-note',
  'scene-draft',
  'rules',
  'linked-record',
  'other'
] as const;

export type ContextSectionKind = (typeof CONTEXT_SECTION_ORDER)[number];

/** Relative share of the budget each section is guaranteed before leftovers are shared out. */
const SECTION_WEIGHT: Record<ContextSectionKind, number> = {
  'author-selection': 3,
  'canon-record': 3,
  'accepted-facts': 3,
  'dialogue-style': 1,
  'story-state': 2,
  'pending-proposals': 1,
  'linked-source-note': 2,
  'source-note': 2,
  'scene-draft': 2,
  rules: 1,
  'linked-record': 1,
  other: 1
};

/**
 * Even a model with a very large context gets at most this much project
 * context: hosted providers charge per token, and the app sent far less before
 * budgets existed.
 */
export const MAX_CONTEXT_BUDGET_TOKENS = 24_000;
/**
 * Room kept for the reply when the request names no reply length: a quarter
 * of the context, at least 768 (above the local server's 512-token minimum
 * reply, 4.75) and at most 2,048.
 */
export const DEFAULT_REPLY_RESERVE_TOKENS = 2_048;
export const MIN_REPLY_RESERVE_TOKENS = 768;
const SAFETY_MARGIN_TOKENS = 256;

/** Tokens available for project context, never negative. */
export function contextBudgetTokens(params: {
  contextTokens: number;
  /** Instructions, conversation, and anything else sent regardless. */
  fixedTokens: number;
  replyTokens?: number;
}): number {
  const reply =
    params.replyTokens ??
    Math.min(DEFAULT_REPLY_RESERVE_TOKENS, Math.max(MIN_REPLY_RESERVE_TOKENS, Math.floor(params.contextTokens / 4)));
  const room = params.contextTokens - params.fixedTokens - reply - SAFETY_MARGIN_TOKENS;
  return Math.max(0, Math.min(MAX_CONTEXT_BUDGET_TOKENS, room));
}

export interface BudgetItem<T> {
  value: T;
  section: ContextSectionKind;
  text: string;
  /** Higher is kept first within a section; items without one keep their order. */
  relevance?: number;
}

export interface BudgetedItem<T> extends BudgetItem<T> {
  tokens: number;
}

export interface ContextFit<T> {
  kept: BudgetedItem<T>[];
  dropped: BudgetedItem<T>[];
  budgetTokens: number;
  usedTokens: number;
}

const sectionRank = (section: ContextSectionKind) => CONTEXT_SECTION_ORDER.indexOf(section);

/**
 * Keeps what fits. First each section fills its own share, most relevant item
 * first; then the room left over goes to the remaining items in priority
 * order. Kept items stay in the order they were given.
 */
export function fitContextToBudget<T>(items: BudgetItem<T>[], budgetTokens: number): ContextFit<T> {
  const budget = Math.max(0, Math.floor(budgetTokens));
  const measured = items.map((item, index) => ({...item, tokens: estimateTextTokens(item.text), index}));
  const sections = [...new Set(measured.map((item) => item.section))];
  const totalWeight = sections.reduce((sum, section) => sum + SECTION_WEIGHT[section], 0);

  const byPriority = [...measured].sort(
    (a, b) =>
      sectionRank(a.section) - sectionRank(b.section) ||
      (b.relevance ?? 0) - (a.relevance ?? 0) ||
      a.index - b.index
  );

  const kept = new Set<number>();
  let used = 0;
  const sectionUsed = new Map<ContextSectionKind, number>();
  for (const item of byPriority) {
    const share = totalWeight > 0 ? Math.floor((budget * SECTION_WEIGHT[item.section]) / totalWeight) : 0;
    const inSection = sectionUsed.get(item.section) ?? 0;
    if (inSection + item.tokens <= share && used + item.tokens <= budget) {
      kept.add(item.index);
      sectionUsed.set(item.section, inSection + item.tokens);
      used += item.tokens;
    }
  }
  for (const item of byPriority) {
    if (!kept.has(item.index) && used + item.tokens <= budget) {
      kept.add(item.index);
      used += item.tokens;
    }
  }

  const strip = ({index, ...item}: (typeof measured)[number]): BudgetedItem<T> => {
    void index;
    return item;
  };
  return {
    kept: measured.filter((item) => kept.has(item.index)).map(strip),
    dropped: byPriority.filter((item) => !kept.has(item.index)).map(strip),
    budgetTokens: budget,
    usedTokens: used
  };
}

/** The source label of an assistant context chunk, as `contextProvenance` writes it, as a section. */
export function sectionForContextSource(source: string): ContextSectionKind {
  if (source.startsWith('Accepted canon: linked World Bible record')) return 'linked-record';
  if (source.startsWith('Accepted canon: World Bible record')) return 'canon-record';
  if (source.startsWith('Accepted canon fact')) return 'accepted-facts';
  if (source.startsWith('Accepted canon')) return 'canon-record';
  if (source.startsWith('Linked Source Note')) return 'linked-source-note';
  if (source.startsWith('General Source Note')) return 'source-note';
  if (source.startsWith('Scene draft')) return 'scene-draft';
  if (source.startsWith('Rules reference')) return 'rules';
  if (source.startsWith('Pending proposal')) return 'pending-proposals';
  return 'other';
}

export interface ContextChunkLike {
  content: string;
  source: string;
  relevance?: number;
}

/**
 * Fits `LLMRequest.context` chunks, as `buildSystemPromptWithContext` will
 * render them, into the budget. A chunk's section comes from its source label
 * unless `sectionOf` names one. Without a known context size everything is kept.
 */
export function fitContextChunks<C extends ContextChunkLike>(params: {
  chunks: C[];
  contextTokens: number | null;
  /** The system prompt and messages, sent regardless. */
  fixedText: string[];
  replyTokens?: number;
  sectionOf?: (chunk: C) => ContextSectionKind | undefined;
}): {kept: C[]; dropped: C[]; budgetTokens: number | null} {
  if (params.contextTokens === null) return {kept: params.chunks, dropped: [], budgetTokens: null};
  const fixedTokens = params.fixedText.reduce((sum, text) => sum + estimateTextTokens(text) + 8, 0);
  const budget = contextBudgetTokens({contextTokens: params.contextTokens, fixedTokens, replyTokens: params.replyTokens});
  const fit = fitContextToBudget(
    params.chunks.map((chunk) => ({
      value: chunk,
      section: params.sectionOf?.(chunk) ?? sectionForContextSource(chunk.source),
      text: `\n[Source: ${chunk.source}]\n${chunk.content}\n`,
      relevance: chunk.relevance
    })),
    budget
  );
  return {kept: fit.kept.map((item) => item.value), dropped: fit.dropped.map((item) => item.value), budgetTokens: budget};
}
