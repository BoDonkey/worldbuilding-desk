import {describe, expect, it, vi} from 'vitest';
import type {ChapterCard, PlotPoint} from '../../entityTypes';
import {
  PROPOSAL_LIMITS,
  ProposalResponseError,
  adjacentMoves,
  applyPlanningProposal,
  buildProposalOutline,
  parsePlanningProposals,
  staleProposalMessage,
  type ProposalActions
} from './planningProposals';

const point = (id: string, cardId: string, order: number, title: string, notes = ''): PlotPoint => ({
  id, chapterCardId: cardId, title, notes, order, createdAt: 0, updatedAt: 0
});

const card = (id: string, order: number, title: string, plotPoints: PlotPoint[] = []): ChapterCard => ({
  id,
  projectId: 'p1',
  title,
  summary: `${title} summary.`,
  status: 'planned',
  order,
  plotPoints,
  createdAt: 0,
  updatedAt: 0
});

const board = (): ChapterCard[] => [
  card('a', 0, 'Arrival'),
  card('b', 1, 'Market', [point('b1', 'b', 0, 'Robbed'), point('b2', 'b', 1, 'Chase', 'Over rooftops')]),
  card('c', 2, 'Escape')
];

const parse = (proposals: unknown[], cards = board()) =>
  parsePlanningProposals(JSON.stringify({proposals}), buildProposalOutline(cards), cards);

const actions = () => ({
  createCard: vi.fn<ProposalActions['createCard']>(() => 'new'),
  moveCard: vi.fn<ProposalActions['moveCard']>(),
  updateCardSummary: vi.fn<ProposalActions['updateCardSummary']>(),
  addPlotPoint: vi.fn<ProposalActions['addPlotPoint']>(),
  updatePlotPoint: vi.fn<ProposalActions['updatePlotPoint']>(),
  movePlotPoint: vi.fn<ProposalActions['movePlotPoint']>(),
  createLinkedScene: vi.fn<ProposalActions['createLinkedScene']>(async () => {})
});

describe('buildProposalOutline', () => {
  it('keys every card and plot point in board order', () => {
    const outline = buildProposalOutline([...board()].reverse());
    expect(outline.content.indexOf('[C1] Chapter 1: Arrival')).toBeLessThan(outline.content.indexOf('[C2] Chapter 2: Market'));
    expect(outline.content).toContain('[C2.P2] Chase');
    expect(outline.content).toContain('Notes: Over rooftops');
    expect(outline.keys['C2.P1']).toEqual({cardId: 'b', plotPointId: 'b1'});
  });

  it('stays within its bound and does not key plot points it left out', () => {
    const big = Array.from({length: 80}, (_, index) =>
      card(`k${index}`, index, `Card ${index}`, [point(`k${index}p`, `k${index}`, 0, 'x'.repeat(150), 'n'.repeat(300))]));
    big.forEach((entry) => {
      entry.summary = 's'.repeat(900);
    });
    const outline = buildProposalOutline(big);
    expect(outline.content.length).toBeLessThanOrEqual(PROPOSAL_LIMITS.outlineChars);
    expect(outline.keys.C1).toEqual({cardId: 'k0'});
    expect(outline.keys['C1.P1']).toEqual({cardId: 'k0', plotPointId: 'k0p'});
    expect(outline.content).toContain('details left out to fit');
    const shortened = Object.keys(outline.keys).find((key) => !key.includes('.') && !outline.keys[`${key}.P1`]);
    expect(shortened).toBeDefined();
    expect(outline.keys.C80).toBeUndefined();
    expect(outline.content).toMatch(/later chapter cards not shown/);
  });
});

describe('parsePlanningProposals', () => {
  it('resolves keys to record ids for every kind', () => {
    const {proposals, dropped} = parse([
      {kind: 'reorder-cards', order: ['C3', 'C1', 'C2']},
      {kind: 'add-card', after: 'C1', title: 'Interlude', summary: 'A breath.'},
      {kind: 'revise-card-summary', card: 'c2', summary: 'She is robbed and gives chase.'},
      {kind: 'add-plot-point', card: 'C3', title: 'The gate'},
      {kind: 'revise-plot-point', plotPoint: 'C2.P2', title: 'Chase', notes: 'Through the tannery'},
      {kind: 'reorder-plot-points', card: 'C2', order: ['C2.P2', 'C2.P1']},
      {kind: 'plan-scene', card: 'C2', title: 'The theft', goal: 'Mara loses the letter.', plotPoints: ['C2.P1']}
    ]);
    expect(dropped).toEqual([]);
    expect(proposals.map((proposal) => proposal.kind)).toEqual([
      'reorder-cards', 'add-card', 'revise-card-summary', 'add-plot-point', 'revise-plot-point', 'reorder-plot-points', 'plan-scene'
    ]);
    expect(proposals[0]).toMatchObject({cardIds: ['c', 'a', 'b'], target: 'the board'});
    expect(proposals[1]).toMatchObject({afterCardId: 'a', target: 'after Chapter 1, Arrival'});
    expect(proposals[2]).toMatchObject({cardId: 'b', target: 'Chapter 2, Market'});
    expect(proposals[4]).toMatchObject({cardId: 'b', plotPointId: 'b2', target: 'plot point 2 of Chapter 2, Market'});
    expect(proposals[5]).toMatchObject({plotPointIds: ['b2', 'b1']});
    expect(proposals[6]).toMatchObject({cardId: 'b', plotPointIds: ['b1']});
  });

  it('drops unknown keys and keeps the valid proposals in a mixed batch', () => {
    const {proposals, dropped} = parse([
      {kind: 'revise-card-summary', card: 'C9', summary: 'x'},
      {kind: 'add-plot-point', card: 'C1', title: 'Valid one'},
      {kind: 'revise-plot-point', plotPoint: 'C1.P4', title: 'x'},
      {kind: 'reorder-plot-points', card: 'C2', order: ['C2.P1', 'C3.P1']},
      {kind: 'plan-scene', card: 'C1', title: 'S', goal: 'G', plotPoints: ['C2.P1']},
      {kind: 'delete-card', card: 'C1'},
      'not an object'
    ]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({kind: 'add-plot-point', cardId: 'a', title: 'Valid one'});
    expect(dropped).toEqual([
      'Proposal 1 was left out: it names a chapter card (C9) that is not on the board.',
      'Proposal 3 was left out: it names a plot point (C1.P4) that is not on the board.',
      'Proposal 4 was left out: it lists a plot point (C3.P1) that is not on C2.',
      'Proposal 5 was left out: it lists a plot point (C2.P1) that is not on C1.',
      'Proposal 6 was left out: it is not a kind of change the board supports.',
      'Proposal 7 was left out: it is not a proposal.'
    ]);
  });

  it('accepts only keys the outline showed, not raw record ids', () => {
    const {proposals, dropped} = parse([{kind: 'add-plot-point', card: 'a', title: 'By id'}]);
    expect(proposals).toEqual([]);
    expect(dropped[0]).toContain('names a chapter card (a)');
  });

  it('drops oversized and empty text instead of cutting it', () => {
    const {proposals, dropped} = parse([
      {kind: 'revise-card-summary', card: 'C1', summary: 'x'.repeat(PROPOSAL_LIMITS.summaryChars + 1)},
      {kind: 'add-card', after: null, title: '   '},
      {kind: 'plan-scene', card: 'C1', title: 'S', goal: 'g'.repeat(PROPOSAL_LIMITS.goalChars + 1)},
      {kind: 'add-plot-point', card: 'C1', title: 'Fine', reason: 'r'.repeat(PROPOSAL_LIMITS.reasonChars + 1)}
    ]);
    expect(proposals).toEqual([]);
    expect(dropped).toEqual([
      'Proposal 1 was left out: its summary is too long.',
      'Proposal 2 was left out: its title is empty.',
      'Proposal 3 was left out: its goal is too long.',
      'Proposal 4 was left out: its reason is too long.'
    ]);
  });

  it('drops reorders that skip, repeat, or keep the order, and edits that change nothing', () => {
    const {proposals, dropped} = parse([
      {kind: 'reorder-cards', order: ['C2', 'C1']},
      {kind: 'reorder-cards', order: ['C2', 'C1', 'C1']},
      {kind: 'reorder-cards', order: ['C1', 'C2', 'C3']},
      {kind: 'revise-card-summary', card: 'C1', summary: 'Arrival summary.'},
      {kind: 'revise-plot-point', plotPoint: 'C2.P2', title: 'Chase', notes: 'Over rooftops'}
    ]);
    expect(proposals).toEqual([]);
    expect(dropped.map((line) => line.replace(/^Proposal \d was left out: /, ''))).toEqual([
      'its new order does not list every card exactly once.',
      'its new order does not list every card exactly once.',
      'it does not change the order.',
      'it does not change the summary.',
      'it does not change the plot point.'
    ]);
  });

  it('caps the number of proposals', () => {
    const many = Array.from({length: PROPOSAL_LIMITS.proposals + 2}, (_, index) =>
      ({kind: 'add-plot-point', card: 'C1', title: `Point ${index}`}));
    const {proposals, dropped} = parse(many);
    expect(proposals).toHaveLength(PROPOSAL_LIMITS.proposals);
    expect(dropped).toHaveLength(2);
  });

  it('reads a fenced reply and rejects one that is not proposals', () => {
    const cards = board();
    const outline = buildProposalOutline(cards);
    const fenced = 'Here you go:\n```json\n{"proposals":[{"kind":"add-plot-point","card":"C1","title":"Gate"}]}\n```';
    expect(parsePlanningProposals(fenced, outline, cards).proposals).toHaveLength(1);
    expect(() => parsePlanningProposals('I think chapter two sags.', outline, cards)).toThrow(ProposalResponseError);
    expect(() => parsePlanningProposals('{"changes":[]}', outline, cards)).toThrow(ProposalResponseError);
  });
});

describe('staleProposalMessage', () => {
  it('drops a proposal whose target changed or went away since it was made', () => {
    const {proposals} = parse([
      {kind: 'revise-card-summary', card: 'C1', summary: 'New.'},
      {kind: 'revise-plot-point', plotPoint: 'C2.P1', title: 'Robbed blind'},
      {kind: 'reorder-cards', order: ['C3', 'C2', 'C1']},
      {kind: 'add-plot-point', card: 'C3', title: 'Gate'}
    ]);
    const [summary, plotPoint, reorder, addPoint] = proposals;
    const current = board();
    expect(proposals.map((proposal) => staleProposalMessage(proposal, current))).toEqual([null, null, null, null]);

    current[0]!.summary = 'The author rewrote this.';
    current[1]!.plotPoints[0]!.notes = 'Edited';
    current[1]!.order = 5;
    const withoutEscape = current.filter((entry) => entry.id !== 'c');
    expect(staleProposalMessage(summary!, current)).toBe(
      'Dropped "Revise a card summary": Chapter 1, Arrival changed after this proposal was made.'
    );
    expect(staleProposalMessage(plotPoint!, current)).toContain('changed after this proposal was made');
    expect(staleProposalMessage(reorder!, current)).toBe(
      'Dropped "Reorder chapter cards": The board changed after this proposal was made.'
    );
    expect(staleProposalMessage(addPoint!, withoutEscape)).toBe(
      'Dropped "Add a plot point": Chapter 3, Escape no longer exists.'
    );
  });

  it('is not stale when an unrelated part of the card changed', () => {
    const {proposals} = parse([{kind: 'revise-card-summary', card: 'C1', summary: 'New.'}]);
    const current = board();
    current[0]!.title = 'Arrival, renamed';
    current[0]!.updatedAt = 99;
    expect(staleProposalMessage(proposals[0]!, current)).toBeNull();
  });
});

describe('adjacentMoves', () => {
  it('turns one order into another with Move up steps', () => {
    const moves = adjacentMoves(['a', 'b', 'c', 'd'], ['d', 'b', 'a', 'c']);
    const working = ['a', 'b', 'c', 'd'];
    for (const move of moves) {
      const at = working.indexOf(move.id);
      working.splice(at, 1);
      working.splice(at + move.direction, 0, move.id);
    }
    expect(working).toEqual(['d', 'b', 'a', 'c']);
    expect(adjacentMoves(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});

describe('applyPlanningProposal', () => {
  it('applies each kind through the Corkboard actions only', async () => {
    const {proposals} = parse([
      {kind: 'reorder-cards', order: ['C2', 'C1', 'C3']},
      {kind: 'add-card', after: 'C1', title: 'Interlude', summary: 'A breath.'},
      {kind: 'revise-card-summary', card: 'C2', summary: 'Robbed and chasing.'},
      {kind: 'add-plot-point', card: 'C3', title: 'The gate', notes: 'Locked'},
      {kind: 'revise-plot-point', plotPoint: 'C2.P2', title: 'Chase', notes: 'Through the tannery'},
      {kind: 'reorder-plot-points', card: 'C2', order: ['C2.P2', 'C2.P1']},
      {kind: 'plan-scene', card: 'C2', title: 'The theft', goal: 'Mara loses the letter.', plotPoints: ['C2.P1']}
    ]);
    const spies = actions();
    for (const proposal of proposals) await applyPlanningProposal(proposal, board(), spies);

    expect(spies.moveCard.mock.calls).toEqual([
      ['b', -1],
      // The new card is appended (position 4 of 4) and moved up to sit after Arrival.
      ['new', -1],
      ['new', -1]
    ]);
    expect(spies.createCard).toHaveBeenCalledWith({title: 'Interlude', summary: 'A breath.'});
    expect(spies.updateCardSummary).toHaveBeenCalledWith('b', 'Robbed and chasing.');
    expect(spies.addPlotPoint).toHaveBeenCalledWith('c', {title: 'The gate', notes: 'Locked'});
    expect(spies.updatePlotPoint).toHaveBeenCalledWith('b', 'b2', {title: 'Chase', notes: 'Through the tannery'});
    expect(spies.movePlotPoint.mock.calls).toEqual([['b', 'b2', -1]]);
    expect(spies.createLinkedScene).toHaveBeenCalledWith(
      expect.objectContaining({id: 'b'}),
      'The theft',
      'Mara loses the letter.\nPlot points: Robbed.'
    );
  });

  it('puts an added card first when it has no card before it', async () => {
    const {proposals} = parse([{kind: 'add-card', after: null, title: 'Prologue'}]);
    const spies = actions();
    await applyPlanningProposal(proposals[0]!, board(), spies);
    expect(spies.moveCard.mock.calls).toEqual([['new', -1], ['new', -1], ['new', -1]]);
  });

  it('refuses a stale proposal without calling any action', async () => {
    const {proposals} = parse([{kind: 'revise-card-summary', card: 'C1', summary: 'New.'}]);
    const current = board();
    current[0]!.summary = 'Changed by the author.';
    const spies = actions();
    await expect(applyPlanningProposal(proposals[0]!, current, spies)).rejects.toThrow('changed after this proposal');
    expect(Object.values(spies).every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });
});
