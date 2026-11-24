import {z} from 'zod';
import type {ChapterCard, ChapterCardStatus, PlotPoint} from '../../entityTypes';
import {appendContextTrustInstructions} from '../llm/contextProvenance';

/*
 * Planning-chat proposals (Slice 4.86): a reply from the planning chat turned
 * into structured outline edits the author accepts one at a time.
 *
 * Models propose, this module validates, the author approves. The model sees
 * the board with short keys (C2, C2.P3) instead of record ids, and every key
 * it returns is resolved here against the cards the proposal was made from.
 * Each proposal keeps a basis: the part of the board it depends on (a summary,
 * a plot point's text, an order). Accepting re-reads that basis from the
 * current board, and a proposal whose basis changed is dropped instead of
 * applied. Nothing here touches canon, mechanics, state, or scene prose; the
 * only writes are the Corkboard's own card and plot-point actions, and an
 * empty scene linked to a card.
 */

/** Bounds on what a proposal may contain. Longer text is dropped, not cut. */
export const PROPOSAL_LIMITS = {
  proposals: 12,
  cardTitleChars: 120,
  summaryChars: 1_200,
  plotPointTitleChars: 160,
  notesChars: 800,
  sceneTitleChars: 120,
  goalChars: 600,
  reasonChars: 400,
  /** The reply being turned into proposals, as sent back to the model. */
  replyChars: 6_000,
  /** The keyed outline sent with a proposal request. */
  outlineChars: 24_000,
  outlineSummaryChars: 600,
  outlineNotesChars: 300
} as const;

export type PlanningProposalKind =
  | 'reorder-cards'
  | 'add-card'
  | 'revise-card-summary'
  | 'add-plot-point'
  | 'revise-plot-point'
  | 'reorder-plot-points'
  | 'plan-scene';

interface ProposalCommon {
  /** Local id for the list; not a record id. */
  id: string;
  /** Why the model suggests it, as the model put it. */
  reason: string;
  /** What it changes, named from the board it was made from: "Chapter 3, The Ford". */
  target: string;
  /** The board state this proposal depends on; see `proposalBasis`. */
  basis: string;
}

export type PlanningProposal = ProposalCommon & (
  | {kind: 'reorder-cards'; cardIds: string[]}
  | {kind: 'add-card'; afterCardId: string | null; title: string; summary: string}
  | {kind: 'revise-card-summary'; cardId: string; summary: string}
  | {kind: 'add-plot-point'; cardId: string; title: string; notes: string}
  | {kind: 'revise-plot-point'; cardId: string; plotPointId: string; title: string; notes: string}
  | {kind: 'reorder-plot-points'; cardId: string; plotPointIds: string[]}
  | {kind: 'plan-scene'; cardId: string; title: string; goal: string; plotPointIds: string[]}
);

export const PROPOSAL_KIND_LABELS: Record<PlanningProposalKind, string> = {
  'reorder-cards': 'Reorder chapter cards',
  'add-card': 'Add a chapter card',
  'revise-card-summary': 'Revise a card summary',
  'add-plot-point': 'Add a plot point',
  'revise-plot-point': 'Revise a plot point',
  'reorder-plot-points': 'Reorder plot points',
  'plan-scene': 'Plan a scene'
};

const STATUS_LABELS: Record<ChapterCardStatus, string> = {
  planned: 'planned',
  draft: 'drafting',
  written: 'written'
};

const clip = (value: string, limit: number): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
};

const sortedCards = (cards: ChapterCard[]): ChapterCard[] => [...cards].sort((a, b) => a.order - b.order);
const sortedPoints = (card: ChapterCard): PlotPoint[] => [...card.plotPoints].sort((a, b) => a.order - b.order);
const cardTitle = (card: ChapterCard): string => card.title.trim() || 'Untitled chapter';

/** A key the model may use, and what it stands for. */
export interface OutlineKey {
  cardId: string;
  plotPointId?: string;
}

export interface ProposalOutline {
  content: string;
  /** Only keys that were shown; a key the model was not shown is not accepted. */
  keys: Record<string, OutlineKey>;
}

/**
 * The whole board with keys, within `PROPOSAL_LIMITS.outlineChars`. Past the
 * limit a card is sent as its key and title only, and its plot points are not
 * shown, so they cannot be proposed against; past that, later cards are left
 * out and unkeyed (a reorder then cannot list every card, so none is accepted).
 */
export function buildProposalOutline(cards: ChapterCard[]): ProposalOutline {
  const ordered = sortedCards(cards);
  const keys: Record<string, OutlineKey> = {};
  const header = `The author's corkboard, ${ordered.length} chapter card${ordered.length === 1 ? '' : 's'} in order. Keys in brackets name each card and plot point:`;
  const parts = [header];
  let used = header.length;
  let full = true;
  let omitted = 0;
  ordered.forEach((card, index) => {
    if (omitted > 0) {
      omitted += 1;
      return;
    }
    const key = `C${index + 1}`;
    const titleLine = `[${key}] Chapter ${index + 1}: ${cardTitle(card)} (${STATUS_LABELS[card.status]})`;
    const pointKeys: Record<string, OutlineKey> = {};
    const lines = [
      titleLine,
      `  Summary: ${clip(card.summary, PROPOSAL_LIMITS.outlineSummaryChars) || '(no summary yet)'}`
    ];
    const points = sortedPoints(card);
    if (points.length === 0) lines.push('  Plot points: none yet');
    points.forEach((point, pointIndex) => {
      const pointKey = `${key}.P${pointIndex + 1}`;
      pointKeys[pointKey] = {cardId: card.id, plotPointId: point.id};
      lines.push(`  [${pointKey}] ${clip(point.title, PROPOSAL_LIMITS.plotPointTitleChars) || 'Untitled plot point'}`);
      const notes = clip(point.notes ?? '', PROPOSAL_LIMITS.outlineNotesChars);
      if (notes) lines.push(`     Notes: ${notes}`);
    });
    const scenes = card.sceneIds?.length ?? 0;
    lines.push(`  Linked scenes: ${scenes}`);
    const block = lines.join('\n');
    // Room is kept for the closing "not shown" line.
    const room = PROPOSAL_LIMITS.outlineChars - used - 64;
    if (full && block.length + 2 <= room) {
      parts.push(block);
      used += block.length + 2;
      keys[key] = {cardId: card.id};
      Object.assign(keys, pointKeys);
      return;
    }
    full = false;
    const short = `${titleLine} (details left out to fit; propose nothing about its plot points)`;
    if (short.length + 2 <= room) {
      parts.push(short);
      used += short.length + 2;
      keys[key] = {cardId: card.id};
      return;
    }
    omitted = 1;
  });
  if (omitted > 0) parts.push(`(${omitted} later chapter card${omitted === 1 ? '' : 's'} not shown; propose nothing about them)`);
  return {content: parts.join('\n\n'), keys};
}

const PROPOSAL_INSTRUCTIONS = `You turn a story-planning suggestion into structured edits to the author's corkboard. The author reviews each edit and accepts or dismisses it; nothing changes until they accept.

Reply with JSON only, in this shape: {"proposals":[ ... ]}. Each proposal is one of:
- {"kind":"reorder-cards","order":["C2","C1","C3"],"reason":"..."}: the new order of every card; list each card key exactly once.
- {"kind":"add-card","after":"C2","title":"...","summary":"...","reason":"..."}: a new chapter card after the given card; use "after":null to put it first.
- {"kind":"revise-card-summary","card":"C3","summary":"...","reason":"..."}: the card's full new summary.
- {"kind":"add-plot-point","card":"C3","title":"...","notes":"...","reason":"..."}: a plot point added at the end of the card.
- {"kind":"revise-plot-point","plotPoint":"C3.P2","title":"...","notes":"...","reason":"..."}: the plot point's full new title and notes.
- {"kind":"reorder-plot-points","card":"C3","order":["C3.P2","C3.P1"],"reason":"..."}: the new order of every plot point on that card; list each exactly once.
- {"kind":"plan-scene","card":"C3","title":"...","goal":"...","plotPoints":["C3.P1"],"reason":"..."}: one scene to write for this card, with what must happen in it and the plot points it covers. Split a card into several scenes by proposing one plan-scene each.

Rules:
- Use only the keys shown in brackets in the corkboard. Never invent a key.
- Propose only what the suggestion supports, at most ${PROPOSAL_LIMITS.proposals} proposals. Return {"proposals":[]} when it suggests no concrete change.
- Never delete cards or plot points, and never write manuscript prose. Titles are short; summaries, notes, and goals are plans, not prose.
- Keep each reason to one sentence.`;

/** System prompt for one proposal request. */
export function buildProposalSystemPrompt(): string {
  return appendContextTrustInstructions(PROPOSAL_INSTRUCTIONS);
}

/** The user message: the reply to turn into edits, and the question it answered. */
export function buildProposalRequest(reply: string, question: string | null): string {
  const asked = question?.trim() ? `The author asked: ${clip(question, 1_000)}\n\n` : '';
  return `${asked}Turn this planning suggestion into corkboard proposals:\n\n---\n${clip(reply, PROPOSAL_LIMITS.replyChars)}\n---`;
}

/** What a proposal request sends, for the route disclosure. */
export const PROPOSAL_MATERIAL =
  'the reply and your question, every chapter card (titles, summaries, plot points with notes, linked scene counts)';

const text = (limit: number) => z.string().trim().max(limit);
const reason = z.string().trim().max(PROPOSAL_LIMITS.reasonChars).optional().default('');
const key = z.string().trim().min(1).max(16);

const rawProposalSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('reorder-cards'), order: z.array(key).min(2).max(500), reason}),
  z.object({
    kind: z.literal('add-card'),
    after: key.nullable(),
    title: text(PROPOSAL_LIMITS.cardTitleChars).min(1),
    summary: text(PROPOSAL_LIMITS.summaryChars).optional().default(''),
    reason
  }),
  z.object({kind: z.literal('revise-card-summary'), card: key, summary: text(PROPOSAL_LIMITS.summaryChars).min(1), reason}),
  z.object({
    kind: z.literal('add-plot-point'),
    card: key,
    title: text(PROPOSAL_LIMITS.plotPointTitleChars).min(1),
    notes: text(PROPOSAL_LIMITS.notesChars).optional().default(''),
    reason
  }),
  z.object({
    kind: z.literal('revise-plot-point'),
    plotPoint: key,
    title: text(PROPOSAL_LIMITS.plotPointTitleChars).min(1),
    notes: text(PROPOSAL_LIMITS.notesChars).optional().default(''),
    reason
  }),
  z.object({kind: z.literal('reorder-plot-points'), card: key, order: z.array(key).min(2).max(500), reason}),
  z.object({
    kind: z.literal('plan-scene'),
    card: key,
    title: text(PROPOSAL_LIMITS.sceneTitleChars).min(1),
    goal: text(PROPOSAL_LIMITS.goalChars).min(1),
    plotPoints: z.array(key).max(100).optional().default([]),
    reason
  })
]);

type RawProposal = z.infer<typeof rawProposalSchema>;

export interface ProposalParseResult {
  proposals: PlanningProposal[];
  /** One plain sentence per proposal that was left out. */
  dropped: string[];
}

export class ProposalResponseError extends Error {
  constructor() {
    super('The reply could not be read as outline changes. Try Propose changes again.');
    this.name = 'ProposalResponseError';
  }
}

/** The JSON object in a reply, allowing a code fence or a sentence around it. */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ProposalResponseError();
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ProposalResponseError();
  }
}

const describeIssue = (issue: z.core.$ZodIssue | undefined): string => {
  if (!issue) return 'it does not match any kind of change';
  if (issue.path.length === 0) return 'it is not a proposal';
  const field = issue.path.at(-1);
  if (issue.code === 'too_big') return `its ${String(field ?? 'text')} is too long`;
  if (issue.code === 'too_small') return `its ${String(field ?? 'text')} is empty`;
  if (issue.code === 'invalid_union' || field === 'kind') return 'it is not a kind of change the board supports';
  return `its ${String(field ?? 'content')} is missing or malformed`;
};

/** "Chapter 3, The Ford", from the board the proposal was made against. */
function cardLabel(cards: ChapterCard[], cardId: string): string {
  const ordered = sortedCards(cards);
  const index = ordered.findIndex((card) => card.id === cardId);
  const card = ordered[index];
  return card ? `Chapter ${index + 1}, ${cardTitle(card)}` : 'a chapter card';
}

function plotPointLabel(cards: ChapterCard[], cardId: string, plotPointId: string): string {
  const card = cards.find((entry) => entry.id === cardId);
  const index = card ? sortedPoints(card).findIndex((point) => point.id === plotPointId) : -1;
  return `plot point ${index + 1} of ${cardLabel(cards, cardId)}`;
}

/**
 * What a proposal depends on, read from `cards`; null when its target is gone.
 * A proposal is current while this matches the basis it was made with.
 */
export function proposalBasis(proposal: PlanningProposal, cards: ChapterCard[]): string | null {
  const card = 'cardId' in proposal ? cards.find((entry) => entry.id === proposal.cardId) : undefined;
  switch (proposal.kind) {
    case 'reorder-cards':
      return sortedCards(cards).map((entry) => entry.id).join(',');
    case 'add-card':
      return proposal.afterCardId === null || cards.some((entry) => entry.id === proposal.afterCardId) ? 'present' : null;
    case 'revise-card-summary':
      return card ? card.summary : null;
    case 'add-plot-point':
      return card ? 'present' : null;
    case 'revise-plot-point': {
      const point = card?.plotPoints.find((entry) => entry.id === proposal.plotPointId);
      return point ? JSON.stringify([point.title, point.notes ?? '']) : null;
    }
    case 'reorder-plot-points':
      return card ? sortedPoints(card).map((point) => point.id).join(',') : null;
    case 'plan-scene': {
      if (!card) return null;
      const ids = new Set(card.plotPoints.map((point) => point.id));
      return proposal.plotPointIds.every((id) => ids.has(id)) ? 'present' : null;
    }
  }
}

/** Null when the proposal can still be accepted, otherwise why it was dropped. */
export function staleProposalMessage(proposal: PlanningProposal, cards: ChapterCard[]): string | null {
  const basis = proposalBasis(proposal, cards);
  if (basis === proposal.basis) return null;
  const label = `Dropped "${PROPOSAL_KIND_LABELS[proposal.kind]}"`;
  if (basis !== null) {
    const what = proposal.kind === 'reorder-cards' ? 'The board' : proposal.target.charAt(0).toUpperCase() + proposal.target.slice(1);
    return `${label}: ${what} changed after this proposal was made.`;
  }
  if (proposal.kind === 'add-card') return `${label}: the card it was to follow no longer exists.`;
  if (proposal.kind === 'plan-scene') return `${label}: ${proposal.target} or a plot point it covers no longer exists.`;
  return `${label}: ${proposal.target} no longer exists.`;
}

/** A proposal before it gets its list id and basis. */
type Resolved = PlanningProposal extends infer P ? (P extends PlanningProposal ? Omit<P, 'id' | 'basis'> : never) : never;

/** Resolves one parsed proposal's keys against the outline; a string is why it was dropped. */
function resolveProposal(raw: RawProposal, outline: ProposalOutline, cards: ChapterCard[]): Resolved | string {
  const cardKey = (value: string): string | null => {
    const entry = outline.keys[value.toUpperCase()];
    return entry && !entry.plotPointId ? entry.cardId : null;
  };
  const pointKey = (value: string): OutlineKey | null => {
    const entry = outline.keys[value.toUpperCase()];
    return entry?.plotPointId ? entry : null;
  };
  const unknownCard = (value: string) => `it names a chapter card (${value}) that is not on the board`;
  const unknownPoint = (value: string) => `it names a plot point (${value}) that is not on the board`;
  const sameSet = (left: string[], right: string[]) =>
    left.length === right.length && new Set(left).size === left.length && right.every((id) => left.includes(id));

  switch (raw.kind) {
    case 'reorder-cards': {
      const ids = raw.order.map(cardKey);
      const missing = raw.order.find((_, index) => !ids[index]);
      if (missing) return unknownCard(missing);
      const current = sortedCards(cards).map((card) => card.id);
      if (!sameSet(ids as string[], current)) return 'its new order does not list every card exactly once';
      if ((ids as string[]).every((id, index) => id === current[index])) return 'it does not change the order';
      return {kind: raw.kind, cardIds: ids as string[], reason: raw.reason, target: 'the board'};
    }
    case 'add-card': {
      const afterCardId = raw.after === null ? null : cardKey(raw.after);
      if (raw.after !== null && !afterCardId) return unknownCard(raw.after);
      const target = afterCardId ? `after ${cardLabel(cards, afterCardId)}` : 'at the start of the board';
      return {kind: raw.kind, afterCardId, title: raw.title, summary: raw.summary, reason: raw.reason, target};
    }
    case 'revise-card-summary': {
      const cardId = cardKey(raw.card);
      if (!cardId) return unknownCard(raw.card);
      if (cards.find((card) => card.id === cardId)?.summary.trim() === raw.summary) return 'it does not change the summary';
      return {kind: raw.kind, cardId, summary: raw.summary, reason: raw.reason, target: cardLabel(cards, cardId)};
    }
    case 'add-plot-point': {
      const cardId = cardKey(raw.card);
      if (!cardId) return unknownCard(raw.card);
      return {kind: raw.kind, cardId, title: raw.title, notes: raw.notes, reason: raw.reason, target: cardLabel(cards, cardId)};
    }
    case 'revise-plot-point': {
      const entry = pointKey(raw.plotPoint);
      if (!entry?.plotPointId) return unknownPoint(raw.plotPoint);
      const point = cards.find((card) => card.id === entry.cardId)?.plotPoints.find((item) => item.id === entry.plotPointId);
      if (point && point.title.trim() === raw.title && (point.notes ?? '').trim() === raw.notes) {
        return 'it does not change the plot point';
      }
      return {
        kind: raw.kind,
        cardId: entry.cardId,
        plotPointId: entry.plotPointId,
        title: raw.title,
        notes: raw.notes,
        reason: raw.reason,
        target: plotPointLabel(cards, entry.cardId, entry.plotPointId)
      };
    }
    case 'reorder-plot-points': {
      const cardId = cardKey(raw.card);
      if (!cardId) return unknownCard(raw.card);
      const entries = raw.order.map(pointKey);
      const missing = raw.order.find((_, index) => entries[index]?.cardId !== cardId);
      if (missing) return `it lists a plot point (${missing}) that is not on ${raw.card}`;
      const ids = entries.map((entry) => entry!.plotPointId!);
      const card = cards.find((entry) => entry.id === cardId)!;
      const current = sortedPoints(card).map((point) => point.id);
      if (!sameSet(ids, current)) return 'its new order does not list every plot point on the card exactly once';
      if (ids.every((id, index) => id === current[index])) return 'it does not change the order';
      return {kind: raw.kind, cardId, plotPointIds: ids, reason: raw.reason, target: cardLabel(cards, cardId)};
    }
    case 'plan-scene': {
      const cardId = cardKey(raw.card);
      if (!cardId) return unknownCard(raw.card);
      const entries = raw.plotPoints.map(pointKey);
      const missing = raw.plotPoints.find((_, index) => entries[index]?.cardId !== cardId);
      if (missing) return `it lists a plot point (${missing}) that is not on ${raw.card}`;
      return {
        kind: raw.kind,
        cardId,
        title: raw.title,
        goal: raw.goal,
        plotPointIds: [...new Set(entries.map((entry) => entry!.plotPointId!))],
        reason: raw.reason,
        target: cardLabel(cards, cardId)
      };
    }
  }
}

/**
 * Parses and validates a proposal reply against the board it was made from.
 * A batch may mix valid and invalid proposals: each invalid one is dropped
 * with a reason and the rest are kept. Throws `ProposalResponseError` when
 * the reply is not a proposal object at all.
 */
export function parsePlanningProposals(
  content: string,
  outline: ProposalOutline,
  cards: ChapterCard[]
): ProposalParseResult {
  const parsed = extractJson(content);
  const list = z.object({proposals: z.array(z.unknown())}).safeParse(parsed);
  if (!list.success) throw new ProposalResponseError();

  const proposals: PlanningProposal[] = [];
  const dropped: string[] = [];
  list.data.proposals.forEach((item, index) => {
    const label = `Proposal ${index + 1}`;
    if (index >= PROPOSAL_LIMITS.proposals) {
      dropped.push(`${label} was left out: only ${PROPOSAL_LIMITS.proposals} proposals are shown at once.`);
      return;
    }
    const result = rawProposalSchema.safeParse(item);
    if (!result.success) {
      dropped.push(`${label} was left out: ${describeIssue(result.error.issues[0])}.`);
      return;
    }
    const resolved = resolveProposal(result.data, outline, cards);
    if (typeof resolved === 'string') {
      dropped.push(`${label} was left out: ${resolved}.`);
      return;
    }
    const proposal = {...resolved, id: `proposal-${index + 1}`, basis: ''} as PlanningProposal;
    proposal.basis = proposalBasis(proposal, cards) ?? '';
    proposals.push(proposal);
  });
  return {proposals, dropped};
}

/** One adjacent move: the existing Move up / Move down actions. */
export interface AdjacentMove {
  id: string;
  direction: -1 | 1;
}

/** Adjacent moves that turn `current` into `target`, both the same ids. */
export function adjacentMoves(current: string[], target: string[]): AdjacentMove[] {
  const working = [...current];
  const moves: AdjacentMove[] = [];
  target.forEach((id, index) => {
    let at = working.indexOf(id);
    while (at > index) {
      [working[at - 1], working[at]] = [working[at]!, working[at - 1]!];
      moves.push({id, direction: -1});
      at -= 1;
    }
  });
  return moves;
}

/** The Corkboard actions a proposal may use; all come from `useWorkspaceCorkboard`. */
export interface ProposalActions {
  createCard: (initial: {title: string; summary: string}) => string | undefined;
  moveCard: (cardId: string, direction: -1 | 1) => void;
  updateCardSummary: (cardId: string, summary: string) => void;
  addPlotPoint: (cardId: string, initial: {title: string; notes: string}) => void;
  updatePlotPoint: (cardId: string, plotPointId: string, patch: {title: string; notes: string}) => void;
  movePlotPoint: (cardId: string, plotPointId: string, direction: -1 | 1) => void;
  /** Creates an empty scene titled `title` and links it to the card. */
  createLinkedScene: (card: ChapterCard, title: string, goal: string) => Promise<void>;
}

/**
 * Applies one accepted proposal. Call only after the author confirms, and
 * only after `staleProposalMessage` returned null for the current `cards`.
 */
export async function applyPlanningProposal(
  proposal: PlanningProposal,
  cards: ChapterCard[],
  actions: ProposalActions
): Promise<void> {
  const stale = staleProposalMessage(proposal, cards);
  if (stale) throw new Error(stale);
  const ordered = sortedCards(cards);
  switch (proposal.kind) {
    case 'reorder-cards':
      for (const move of adjacentMoves(ordered.map((card) => card.id), proposal.cardIds)) actions.moveCard(move.id, move.direction);
      return;
    case 'add-card': {
      const id = actions.createCard({title: proposal.title, summary: proposal.summary});
      if (!id) throw new Error('The chapter card could not be added.');
      const position = proposal.afterCardId === null ? 0 : ordered.findIndex((card) => card.id === proposal.afterCardId) + 1;
      for (let at = ordered.length; at > position; at -= 1) actions.moveCard(id, -1);
      return;
    }
    case 'revise-card-summary':
      actions.updateCardSummary(proposal.cardId, proposal.summary);
      return;
    case 'add-plot-point':
      actions.addPlotPoint(proposal.cardId, {title: proposal.title, notes: proposal.notes});
      return;
    case 'revise-plot-point':
      actions.updatePlotPoint(proposal.cardId, proposal.plotPointId, {title: proposal.title, notes: proposal.notes});
      return;
    case 'reorder-plot-points': {
      const card = ordered.find((entry) => entry.id === proposal.cardId)!;
      const current = sortedPoints(card).map((point) => point.id);
      for (const move of adjacentMoves(current, proposal.plotPointIds)) {
        actions.movePlotPoint(proposal.cardId, move.id, move.direction);
      }
      return;
    }
    case 'plan-scene': {
      const card = ordered.find((entry) => entry.id === proposal.cardId)!;
      const points = sortedPoints(card).filter((point) => proposal.plotPointIds.includes(point.id));
      const covers = points.map((point) => point.title.trim()).filter(Boolean);
      const goal = covers.length > 0 ? `${proposal.goal}\nPlot points: ${covers.join('; ')}.` : proposal.goal;
      await actions.createLinkedScene(card, proposal.title, goal);
      return;
    }
  }
}
