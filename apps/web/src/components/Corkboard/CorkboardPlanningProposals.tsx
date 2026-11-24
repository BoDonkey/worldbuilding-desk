import type {ChapterCard} from '../../entityTypes';
import type {ProposalBatch} from '../../hooks/useCorkboardPlanningProposals';
import {PROPOSAL_KIND_LABELS, type PlanningProposal} from '../../services/corkboard/planningProposals';
import {AIProposalPreview} from '../common/AIProposalPreview';
import styles from './CorkboardPlanningChat.module.css';

const cardName = (cards: ChapterCard[], cardId: string): string =>
  cards.find((card) => card.id === cardId)?.title.trim() || 'Untitled chapter';

function findPoint(cards: ChapterCard[], cardId: string, plotPointId: string) {
  return cards.find((card) => card.id === cardId)?.plotPoints.find((point) => point.id === plotPointId);
}

/** What the proposal would change, in the author's terms. */
function ProposalBody({proposal, cards}: {proposal: PlanningProposal; cards: ChapterCard[]}) {
  switch (proposal.kind) {
    case 'reorder-cards':
      return (
        <ol className={styles.proposalList} aria-label='Proposed card order'>
          {proposal.cardIds.map((id) => <li key={id}>{cardName(cards, id)}</li>)}
        </ol>
      );
    case 'reorder-plot-points':
      return (
        <ol className={styles.proposalList} aria-label='Proposed plot point order'>
          {proposal.plotPointIds.map((id) => (
            <li key={id}>{findPoint(cards, proposal.cardId, id)?.title.trim() || 'Untitled plot point'}</li>
          ))}
        </ol>
      );
    case 'add-card':
      return <p>{proposal.title}{proposal.summary ? `\n\n${proposal.summary}` : ''}</p>;
    case 'revise-card-summary':
      return <p>{proposal.summary}</p>;
    case 'add-plot-point':
    case 'revise-plot-point':
      return <p>{proposal.title}{proposal.notes ? `\n\n${proposal.notes}` : ''}</p>;
    case 'plan-scene': {
      const covers = proposal.plotPointIds
        .map((id) => findPoint(cards, proposal.cardId, id)?.title.trim())
        .filter(Boolean);
      return (
        <p>
          {`Scene: ${proposal.title}\nGoal: ${proposal.goal}`}
          {covers.length > 0 ? `\nCovers: ${covers.join('; ')}` : ''}
          {'\n\nAccepting creates an empty scene linked to this card. Draft this scene starts from this goal.'}
        </p>
      );
    }
  }
}

function currentText(proposal: PlanningProposal, cards: ChapterCard[]): string | undefined {
  if (proposal.kind === 'revise-card-summary') {
    return cards.find((card) => card.id === proposal.cardId)?.summary.trim() || '(no summary yet)';
  }
  if (proposal.kind === 'revise-plot-point') {
    const point = findPoint(cards, proposal.cardId, proposal.plotPointId);
    return point ? `${point.title}${point.notes ? `\n\n${point.notes}` : ''}` : undefined;
  }
  return undefined;
}

interface CorkboardPlanningProposalsProps {
  batch: ProposalBatch;
  cards: ChapterCard[];
  onAccept: (proposal: PlanningProposal) => Promise<void>;
  onDismiss: (proposalId: string) => void;
}

/** The proposals made from one reply; each is accepted or dismissed on its own. */
export function CorkboardPlanningProposals({batch, cards, onAccept, onDismiss}: CorkboardPlanningProposalsProps) {
  if (batch.status === 'loading') return <p className={styles.hint} role='status'>Proposing changes…</p>;
  if (batch.status === 'error') return <p className={styles.hint} role='alert'>{batch.error}</p>;
  return (
    <div className={styles.proposals} aria-label='Proposed outline changes'>
      {batch.proposals.length > 0 && (
        <p className={styles.hint}>Nothing on the board changes until you confirm a proposal.</p>
      )}
      {batch.proposals.map((proposal) => (
        <AIProposalPreview
          key={proposal.id}
          title={`${PROPOSAL_KIND_LABELS[proposal.kind]}: ${proposal.target}`}
          beforeText={currentText(proposal, cards)}
          onDismiss={() => onDismiss(proposal.id)}
          onConfirm={() => onAccept(proposal)}
        >
          <ProposalBody proposal={proposal} cards={cards} />
          {proposal.reason && <span className={styles.hint}>Why: {proposal.reason}</span>}
        </AIProposalPreview>
      ))}
      {batch.notices.length > 0 && (
        <ul className={styles.notices} aria-label='Proposals left out'>
          {batch.notices.map((notice, index) => <li key={index}>{notice}</li>)}
        </ul>
      )}
    </div>
  );
}
